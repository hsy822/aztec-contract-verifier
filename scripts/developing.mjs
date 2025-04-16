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
  console.log('\n🔍 Artifact name:', artifact.name);
  console.log('🔍 Total functions:', artifact.functions.length);
  console.log('🔍 outputs keys:', Object.keys(artifact.outputs));
  console.log('🔍 structs:', Object.keys(artifact.outputs.structs));
  console.log('🔍 globals:', Object.keys(artifact.outputs.globals));

  artifact.functions.forEach((fn, idx) => {
    console.log(`  🔸 Function[${idx}]: name="${fn.name}", type="${fn.functionType}", bytecode?=${!!fn.bytecode}, vk?=${!!fn.verificationKey}`);
  });

  const rawFunctions = artifact.outputs.structs.functions;
  const sortedFunctions = [...rawFunctions].sort((a, b) => a.path.localeCompare(b.path));

  console.log('\n📋 artifact.outputs.structs.functions paths (정렬 전):');
  rawFunctions.forEach(f => console.log(` - ${f.path}`));

  console.log('\n📋 sortedOutputs.structs.functions paths (정렬 후):');
  sortedFunctions.forEach(f => console.log(` - ${f.path}`));

  // ✅ 1. metadataHash
  const metadataHash = sha256Fr(
    Buffer.from(JSON.stringify({ name: artifact.name, outputs: artifact.outputs }), 'utf-8')
  );

  console.log('📦 metadataHash =', metadataHash.toString());
  
  // ✅ 2. privateFunctionsRoot
  const privateFns = artifact.functions.filter(fn => fn.functionType === 'private');
  const privateFnObjs = await Promise.all(
    privateFns.map(async fn => {
      const selector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters ?? []);
      const vkBuf = fn.verificationKey ? Buffer.from(fn.verificationKey, 'base64') : null;
      const vkHash = vkBuf ? await hashVK(vkBuf) : Fr.ZERO;
      return { name: fn.name, selector, vkHash };
    }),
  );

  console.log('\n📋 🔄 privateFns Before:');
  privateFnObjs.forEach((fn, i) => {
    console.log(`  [${i}] name="${fn.name}" selector=${fn.selector.toField().toString()}, vkHash=${fn.vkHash.toString()}`);
  });

  privateFnObjs.sort((a, b) => a.selector.toField().cmp(b.selector.toField()));

  console.log('\n📋 ✅ privateFns After:');
  privateFnObjs.forEach((fn, i) => {
    console.log(`  [${i}] name="${fn.name}" selector=${fn.selector.toField().toString()}, vkHash=${fn.vkHash.toString()}`);
  });

  const privateLeaves = await Promise.all(
    privateFnObjs.map(fn =>
      poseidon2HashWithSeparator([fn.selector.toField(), fn.vkHash], GeneratorIndex.FUNCTION_LEAF),
    ),
  );

  const privateFunctionRoot = await computeMerkleRoot(privateLeaves, GeneratorIndex.FUNCTION_LEAF);
  console.log('🌲 privateFunctionsRoot =', privateFunctionRoot.toString());

  // ✅ 3. utilityFunctionsRoot
  const utilityFns = artifact.functions.filter(fn => fn.functionType === 'utility');
  let utilityFunctionRoot = Fr.ZERO;
  if (utilityFns.length > 0) {
    const utilityFnObjs = await Promise.all(
      utilityFns.map(async fn => {
        const selector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters ?? []);
        const vkHash = Fr.ZERO;
        return poseidon2HashWithSeparator([selector.toField(), vkHash], GeneratorIndex.FUNCTION_LEAF);
      }),
    );
    utilityFunctionRoot = await computeMerkleRoot(utilityFnObjs, GeneratorIndex.FUNCTION_LEAF);
  }
  console.log('🧩 utilityFunctionRoot =', utilityFunctionRoot.toString());

  // ✅ 4. artifactHash
  const artifactHash = await computeArtifactHash(artifact);
  console.log('📦 artifactHash =', artifactHash.toString());

  // ✅ 5. public bytecode commitment
  const publicFn = artifact.functions.find(fn => fn.functionType === 'public');
  let publicBytecodeCommitment = Fr.ZERO;
  if (publicFn?.bytecode) {
    const bytecode = Buffer.from(publicFn.bytecode, 'base64');
    const fields = bufferAsFields(bytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
    const byteLength = fields[0].toNumber();
    const chunkSize = Fr.SIZE_IN_BYTES - 1;
    const fieldLen = Math.ceil(byteLength / chunkSize);

    if (fieldLen === 0) {
      publicBytecodeCommitment = Fr.ZERO;
    } else {
      const slice = fields.slice(0, fieldLen + 1);
      console.log(`🧱 publicBytecodeCommitment input fields (${slice.length}):`);
      slice.forEach((f, i) => console.log(`    [${i}] = ${f.toString()}`));
      publicBytecodeCommitment = await poseidon2HashAccumulate(slice);
    }
  }
  console.log('💾 publicBytecodeCommitment =', publicBytecodeCommitment.toString());

  // ✅ 6. classId
  console.log('\n🔎 classId inputs:');
  console.log('artifactHash             =', artifactHash.toString());
  console.log('privateFunctionRoot      =', privateFunctionRoot.toString());
  console.log('publicBytecodeCommitment =', publicBytecodeCommitment.toString());

  const classId = await poseidon2HashWithSeparator(
    [artifactHash, privateFunctionRoot, publicBytecodeCommitment],
    GeneratorIndex.CONTRACT_LEAF,
  );

  console.log('✅ FINAL classId =', classId.toString());
  return classId;
}

(async () => {
  try {
    const fullPath = path.resolve(artifactPath);
    const rawJson = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const artifact = loadContractArtifact(rawJson);
    const classId = await computeClassId(artifact);
    console.log(`\n✅ Computed Contract Class ID: ${classId.toString()}`);
  } catch (err) {
    console.error('❌ Error computing class ID:', err);
    process.exit(1);
  }
})();
