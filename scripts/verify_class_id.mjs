#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { poseidon2Hash } from '@zkpassport/poseidon2';

program
  .requiredOption('--artifact <path>', 'Path to the contract artifact JSON')
  .parse(process.argv);

const { artifact } = program.opts();

const VERSION = 1;
const GeneratorIndex = {
  CONTRACT_LEAF: 1,
  FUNCTION_LEAF: 2,
};
const MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS = 4096;

class Fr {
  static SIZE_IN_BYTES = 32;
  static ZERO = new Fr(0n);

  constructor(value) {
    this.value = BigInt(value);
  }

  static fromBuffer(buffer) {
    return new Fr(BigInt('0x' + buffer.toString('hex')));
  }

  toNumber() {
    return Number(this.value);
  }

  toBuffer() {
    const hex = this.value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  }
}

function chunk(buffer, size) {
  const result = [];
  for (let i = 0; i < buffer.length; i += size) {
    result.push(buffer.slice(i, i + size));
  }
  return result;
}

function bufferAsFields(input, targetLength) {
  const encoded = [
    new Fr(input.length),
    ...chunk(input, Fr.SIZE_IN_BYTES - 1).map(c => {
      const fieldBytes = Buffer.alloc(Fr.SIZE_IN_BYTES);
      Buffer.from(c).copy(fieldBytes, 1);
      return Fr.fromBuffer(fieldBytes);
    }),
  ];
  if (encoded.length > targetLength) {
    throw new Error(`Input buffer exceeds maximum size: got ${encoded.length} but max is ${targetLength}`);
  }
  return [...encoded, ...Array(targetLength - encoded.length).fill(Fr.ZERO)];
}

function poseidon2HashWithSeparator(inputs, generator) {
  const inputBigInts = inputs.map(i => i instanceof Fr ? i.value : BigInt(i));
  return new Fr(poseidon2Hash([BigInt(generator), ...inputBigInts]));
}

function poseidon2HashAccumulate(inputs) {
  const CHUNK_SIZE = 16;
  let result = inputs.slice(0, CHUNK_SIZE).map(i => i instanceof Fr ? i.value : BigInt(i));
  for (let i = CHUNK_SIZE; i < inputs.length; i += CHUNK_SIZE) {
    const chunk = inputs.slice(i, i + CHUNK_SIZE).map(i => i instanceof Fr ? i.value : BigInt(i));
    result = [poseidon2Hash([...result, ...chunk])];
  }
  return new Fr(result[0]);
}

async function sha256Fr(input) {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(input).digest();
  return new Fr(BigInt('0x' + hash.toString('hex')));
}

function normalizeType(type) {
  if (!type || typeof type !== 'object') return 'unknown';
  if (type.kind === 'field' || type.kind === 'boolean') return type.kind;
  if (type.kind === 'array') return `${normalizeType(type.type)}[]`;
  if (type.kind === 'struct') return `struct ${type.path}`;
  if (type.kind === 'tuple') return `(${type.fields.map(normalizeType).join(',')})`;
  if (type.kind === 'integer') return type.sign === 'signed' ? `i${type.width}` : `u${type.width}`;
  return type.kind || 'unknown';
}

async function computeFunctionSelector(name, parameters = []) {
  const signature = `${name}(${parameters.map(p => normalizeType(p.type)).join(',')})`;
  const hashInput = Buffer.from(signature, 'utf8');
  const chunks = chunk(hashInput, Fr.SIZE_IN_BYTES);
  const fields = chunks.map(Fr.fromBuffer);
  const hash = poseidon2Hash(fields.map(f => f.value));
  return new Fr(BigInt('0x' + hash.slice(-4).toString('hex')));
}

function parseVkFieldsMegaHonk(base64) {
  const buffer = Buffer.from(base64, 'base64');
  const chunks = chunk(buffer, Fr.SIZE_IN_BYTES);
  return chunks.map(Fr.fromBuffer);
}

function computeVkHash(base64) {
  if (!base64 || typeof base64 !== 'string') return Fr.ZERO;
  const fields = parseVkFieldsMegaHonk(base64);
  return poseidon2HashAccumulate(fields);
}

function computeLeaf(selector, vkHash) {
  return poseidon2HashWithSeparator([selector, vkHash], GeneratorIndex.FUNCTION_LEAF);
}

function computeMerkleRoot(leaves) {
  if (leaves.length === 0) return Fr.ZERO;
  let nodes = [...leaves];
  while (nodes.length & (nodes.length - 1)) {
    nodes.push(nodes[nodes.length - 1]);
  }
  while (nodes.length > 1) {
    const next = [];
    for (let i = 0; i < nodes.length; i += 2) {
      next.push(poseidon2HashWithSeparator([nodes[i], nodes[i + 1]], 0));
    }
    nodes = next;
  }
  return nodes[0];
}

async function computeFunctionArtifactHash(fn) {
  const selector = await computeFunctionSelector(fn.name, fn.parameters || []);
  const bytecodeHash = await sha256Fr(Buffer.from(fn.bytecode || '', 'base64'));
  const metadataHash = await sha256Fr(Buffer.from(JSON.stringify(fn.returnTypes || []), 'utf8'));
  return sha256Fr(Buffer.concat([
    Buffer.from([VERSION]),
    selector.toBuffer(),
    metadataHash.toBuffer(),
    bytecodeHash.toBuffer(),
  ]));
}

async function computeArtifactFunctionTreeRoot(json, fnType) {
  const leaves = await Promise.all(
    json.functions
      .filter(f => f.functionType === fnType)
      .map(computeFunctionArtifactHash)
  );
  return computeMerkleRoot(leaves);
}

async function computeArtifactHash(json) {
  const privateFunctionRoot = await computeArtifactFunctionTreeRoot(json, 'private');
  const utilityFunctionRoot = await computeArtifactFunctionTreeRoot(json, 'utility');
  const metadataHash = await sha256Fr(Buffer.from(JSON.stringify({ name: json.name, outputs: json.outputs || [] }), 'utf8'));
  return sha256Fr(Buffer.concat([
    Buffer.from([VERSION]),
    privateFunctionRoot.toBuffer(),
    utilityFunctionRoot.toBuffer(),
    metadataHash.toBuffer(),
  ]));
}

async function computePrivateFunctionRoot(json) {
  const privateFns = json.functions.filter(fn => fn.functionType === 'private');
  const leaves = await Promise.all(privateFns.map(async fn => {
    const selector = await computeFunctionSelector(fn.name, fn.parameters || []);
    const vkHash = computeVkHash(fn.verificationKey);
    return computeLeaf(selector, vkHash);
  }));
  return computeMerkleRoot(leaves);
}

async function computePublicBytecodeCommitment(json) {
  const publicFns = json.functions.filter(fn => fn.functionType === 'public');
  if (publicFns.length > 1) throw new Error(`❌ Contract should contain at most one public function. Received ${publicFns.length}.`);
  if (publicFns.length === 0 || !publicFns[0].bytecode) return Fr.ZERO;
  const packedBytecode = Buffer.from(publicFns[0].bytecode, 'base64');
  const encodedBytecode = bufferAsFields(packedBytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
  const bytecodeLength = Math.ceil(encodedBytecode[0].toNumber() / (Fr.SIZE_IN_BYTES - 1));
  if (bytecodeLength === 0) return Fr.ZERO;
  return poseidon2HashAccumulate(encodedBytecode.slice(0, bytecodeLength + 1));
}

async function computeClassId(json) {
  const artifactHash = await computeArtifactHash(json);
  const privateFunctionsRoot = await computePrivateFunctionRoot(json);
  const publicBytecodeCommitment = await computePublicBytecodeCommitment(json);
  const classId = poseidon2HashWithSeparator(
    [artifactHash, privateFunctionsRoot, publicBytecodeCommitment],
    GeneratorIndex.CONTRACT_LEAF
  );
  return classId;
}

(async () => {
  try {
    const artifactPath = path.resolve(artifact);
    const json = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const classId = await computeClassId(json);
    console.log(`✅ Local Contract Class ID: 0x${classId.value.toString(16)}`);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
})();
