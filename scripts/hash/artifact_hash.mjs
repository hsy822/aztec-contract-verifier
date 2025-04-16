import { sha256 } from '@aztec/foundation/crypto';
import { Fr, reduceFn } from '@aztec/foundation/fields';
import { numToUInt8 } from '@aztec/foundation/serialize';

import { FunctionSelector } from '../abi/function_selector.mjs';
import { FunctionType } from '../abi/abi.mjs';
import {
   ContractArtifact,
    FunctionArtifact,
} from '../abi/contract_artifact.mjs';

const VERSION = 1;
const sha256Fr = reduceFn(sha256, Fr);

export async function computeArtifactHash(artifact) {
  if ('privateFunctionRoot' in artifact) {
    const { privateFunctionRoot, utilityFunctionRoot, metadataHash } = artifact;
    return sha256Fr(
      Buffer.concat([
        numToUInt8(VERSION),
        privateFunctionRoot.toBuffer(),
        utilityFunctionRoot.toBuffer(),
        metadataHash.toBuffer(),
      ])
    );
  }
  const preimage = await computeArtifactHashPreimage(artifact);
  return computeArtifactHash(preimage);
}

export async function computeArtifactHashPreimage(artifact) {
  const privateFunctionRoot = await computeFunctionTreeRoot(artifact, FunctionType.PRIVATE);
  const utilityFunctionRoot = await computeFunctionTreeRoot(artifact, FunctionType.UTILITY);
  const metadataHash = computeArtifactMetadataHash(artifact);
  return { privateFunctionRoot, utilityFunctionRoot, metadataHash };
}

export function computeArtifactMetadataHash(artifact) {
  return sha256Fr(Buffer.from(JSON.stringify({ name: artifact.name, outputs: artifact.outputs }), 'utf-8'));
}

async function computeFunctionTreeRoot(artifact, fnType) {
  const leaves = await computeFunctionLeaves(artifact, fnType);
  if (leaves.length === 0) return Fr.ZERO;
  while ((leaves.length & (leaves.length - 1)) !== 0) leaves.push(Fr.ZERO);
  while (leaves.length > 1) {
    const next = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const input = Buffer.concat([leaves[i].toBuffer(), leaves[i + 1].toBuffer()]);
      next.push(sha256Fr(input));
    }
    leaves.splice(0, leaves.length, ...next);
  }
  return leaves[0];
}

async function computeFunctionLeaves(artifact, fnType) {
  const fns = artifact.functions.filter(f => f.functionType === fnType);
  const decorated = await Promise.all(
    fns.map(async f => ({
      selector: await FunctionSelector.fromNameAndParameters(f.name, f.parameters),
      metadataHash: computeFunctionMetadataHash(f),
      bytecodeHash: sha256Fr(f.bytecode),
    }))
  );
  decorated.sort((a, b) => a.selector.toField().cmp(b.selector.toField()));
  return decorated.map(({ selector, metadataHash, bytecodeHash }) => {
    return sha256Fr(
      Buffer.concat([
        numToUInt8(VERSION),
        selector.toBuffer(),
        metadataHash.toBuffer(),
        bytecodeHash.toBuffer(),
      ])
    );
  });
}

function computeFunctionMetadataHash(fn) {
  return sha256Fr(Buffer.from(JSON.stringify(fn.returnTypes ?? []), 'utf-8'));
}