#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { Fr } from '@aztec/foundation/fields';
import { poseidon2HashWithSeparator, poseidon2HashAccumulate, sha256 } from '@aztec/foundation/crypto';
import { FunctionSelector } from './abi/function_selector.mjs';
import { bufferAsFields } from './abi/buffer.mjs';
import { hashVK } from './hash/vk.mjs';
import { computeMerkleRoot } from './util/merkle.mjs';
import { generateContractArtifact } from './util/generate_artifact.mjs';
import { MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS, GeneratorIndex } from '@aztec/constants';
import { loadContractArtifact } from '@aztec/aztec.js';
import { reduceFn } from '@aztec/foundation/fields';

program
  .requiredOption('--artifact <path>', 'Path to the compiled contract artifact (.json)')
  .parse(process.argv);

const { artifact: artifactPath } = program.opts();

const sha256Fr = reduceFn(sha256, Fr);

async function computeClassId(artifact) {

  console.log('🧪 structs:', Object.keys(artifact.outputs.structs));
console.log('🧪 globals:', Object.keys(artifact.outputs.globals));

  const artifactHash = sha256Fr(Buffer.from(JSON.stringify({
    name: artifact.name, // ✅ 여기
    outputs: {
      structs: artifact.outputs.structs, // ✅ 여기!
      globals: artifact.outputs.globals, // ✅ 여기!
    },
  }), 'utf-8'));

  console.log('📦 artifactHash =', artifactHash.toString());

  const privateFns = artifact.functions.filter(fn => fn.functionType === 'private');
  const privateLeaves = await Promise.all(
    privateFns.map(async fn => {
      const selector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters ?? []);
      const vkBuf = fn.verificationKey ? Buffer.from(fn.verificationKey, 'base64') : null;
      const vkHash = vkBuf ? await hashVK(vkBuf) : Fr.ZERO;

      console.log(`🔒 privateFn ${fn.name}`);
      console.log(`  selector = ${selector.toField().toString()}`);
      console.log(`  vkHash   = ${vkHash.toString()}`);

      return poseidon2HashWithSeparator([selector.toField(), vkHash], GeneratorIndex.FUNCTION_LEAF);
    })
  );

  const privateFunctionsRoot = await computeMerkleRoot(privateLeaves, GeneratorIndex.FUNCTION_LEAF);
  console.log('🌲 privateFunctionsRoot =', privateFunctionsRoot.toString());

  const publicFn = artifact.functions.find(fn => fn.functionType === 'public');
  let publicBytecodeCommitment = Fr.ZERO;

  if (publicFn?.bytecode) {
    const bytecode = Buffer.from(publicFn.bytecode, 'base64');
    const fields = bufferAsFields(bytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
    const len = Math.ceil(fields[0].toNumber() / (Fr.SIZE_IN_BYTES - 1));
    const relevantFields = fields.slice(0, len + 1);
    publicBytecodeCommitment = await poseidon2HashAccumulate(relevantFields);

    console.log('🧱 public bytecode commitment input fields:');
    relevantFields.forEach((f, i) => console.log(`  [${i}] = ${f.toString()}`));
  }

  console.log('💾 publicBytecodeCommitment =', publicBytecodeCommitment.toString());

  console.log('🔎 classId inputs:');
console.log('artifactHash       =', artifactHash.toString());
console.log('privateFunctionsRoot =', privateFunctionsRoot.toString());
console.log('publicBytecodeCommitment =', publicBytecodeCommitment.toString());

  const classId = await poseidon2HashWithSeparator(
    [artifactHash, privateFunctionsRoot, publicBytecodeCommitment],
    GeneratorIndex.CONTRACT_LEAF,
  );

  console.log('✅ FINAL classId =', classId.toString());
  return classId;
}

(async () => {
  try {
    const fullPath = path.resolve(artifactPath);
    const rawJson = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const artifact = generateContractArtifact(rawJson);
    const classId = await computeClassId(artifact);
    console.log(`✅ Computed Contract Class ID: ${classId.toString()}`);
  } catch (err) {
    console.error('❌ Error computing class ID:', err);
    process.exit(1);
  }
})();
