#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { Fr, reduceFn } from '@aztec/foundation/fields';
import {
  poseidon2HashWithSeparator,
  poseidon2HashAccumulate,
  sha256,
} from '@aztec/foundation/crypto';
import { FunctionSelector } from './abi/function_selector.mjs';
import { bufferAsFields } from './abi/buffer.mjs';
import { hashVK } from './hash/vk.mjs';
import { computeMerkleRoot } from './util/merkle.mjs';
import {
  MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS,
  GeneratorIndex,
} from '@aztec/constants';
import { loadContractArtifact } from '@aztec/aztec.js';
import { computeArtifactHash } from './hash/artifact_hash.mjs';

program
  .requiredOption('--artifact <path>', 'Path to the compiled contract artifact (.json)')
  .parse(process.argv);

const { artifact: artifactPath } = program.opts();
const sha256Fr = reduceFn(sha256, Fr);

export async function computeClassId(artifact) {
  console.log(`\n🔍 Starting contract verification...`);
  console.log(`   → Contract: ${artifact.name}`);
  console.log(`   → Number of functions: ${artifact.functions.length}`);

  // 1. Metadata hash
  const metadataHash = sha256Fr(
    Buffer.from(JSON.stringify({ name: artifact.name, outputs: artifact.outputs }), 'utf-8')
  );

  // 2. Private function Merkle root
  const privateFns = artifact.functions.filter(fn => fn.functionType === 'private');
  const privateFnObjs = await Promise.all(
    privateFns.map(async fn => {
      const selector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters ?? []);
      const vkBuf = fn.verificationKey ? Buffer.from(fn.verificationKey, 'base64') : null;
      const vkHash = vkBuf ? await hashVK(vkBuf) : Fr.ZERO;
      return { selector, vkHash };
    })
  );

  privateFnObjs.sort((a, b) => a.selector.toField().cmp(b.selector.toField()));

  const privateLeaves = await Promise.all(
    privateFnObjs.map(fn =>
      poseidon2HashWithSeparator([fn.selector.toField(), fn.vkHash], GeneratorIndex.FUNCTION_LEAF)
    )
  );
  const privateFunctionRoot = await computeMerkleRoot(privateLeaves, GeneratorIndex.FUNCTION_LEAF);

  // 3. Utility function Merkle root (not required for class ID but computed)
  const utilityFns = artifact.functions.filter(fn => fn.functionType === 'utility');
  let utilityFunctionRoot = Fr.ZERO;
  if (utilityFns.length > 0) {
    const utilityFnObjs = await Promise.all(
      utilityFns.map(async fn => {
        const selector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters ?? []);
        const vkHash = Fr.ZERO;
        return poseidon2HashWithSeparator([selector.toField(), vkHash], GeneratorIndex.FUNCTION_LEAF);
      })
    );
    utilityFunctionRoot = await computeMerkleRoot(utilityFnObjs, GeneratorIndex.FUNCTION_LEAF);
  }

  // 4. Artifact hash
  const artifactHash = await computeArtifactHash(artifact);

  // 5. Public bytecode commitment
  const publicFn = artifact.functions.find(fn => fn.functionType === 'public');
  let publicBytecodeCommitment = Fr.ZERO;
  if (publicFn?.bytecode) {
    const bytecode = Buffer.from(publicFn.bytecode, 'base64');
    const fields = bufferAsFields(bytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
    const byteLength = fields[0].toNumber();
    const chunkSize = Fr.SIZE_IN_BYTES - 1;
    const fieldLen = Math.ceil(byteLength / chunkSize);
    const slice = fields.slice(0, fieldLen + 1);
    publicBytecodeCommitment = await poseidon2HashAccumulate(slice);
  }

  // 6. Final class ID
  const classId = await poseidon2HashWithSeparator(
    [artifactHash, privateFunctionRoot, publicBytecodeCommitment],
    GeneratorIndex.CONTRACT_LEAF
  );

  console.log('\n✅ Class ID calculation completed.');
  console.log(`   → Artifact hash:             ${artifactHash.toString()}`);
  console.log(`   → Private function root:     ${privateFunctionRoot.toString()}`);
  console.log(`   → Public bytecode commitment: ${publicBytecodeCommitment.toString()}`);
  console.log(`\n🔑 Computed Contract Class ID: ${classId.toString()}`);
  console.warn('\n⚠️  Note: This tool currently calculates the class ID only.');
  console.warn('   It does NOT yet compare against a deployed contract.');
  console.warn('   That feature will be added in a future release.\n');

  return classId;
}

(async () => {
  try {
    const fullPath = path.resolve(artifactPath);
    const rawJson = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const artifact = loadContractArtifact(rawJson);
    await computeClassId(artifact);
  } catch (err) {
    console.error('❌ Error during verification:', err);
    process.exit(1);
  }
})();
