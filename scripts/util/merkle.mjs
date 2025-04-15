import { Fr } from '@aztec/foundation/fields';
import { poseidon2HashWithSeparator } from '@aztec/foundation/crypto';

export async function computeMerkleRoot(leaves, generator) {
  if (leaves.length === 0) return Fr.ZERO;

  let nodes = [...leaves];
  const targetLength = 2 ** Math.ceil(Math.log2(nodes.length));
  while (nodes.length < targetLength) nodes.push(Fr.ZERO);

  while (nodes.length > 1) {
    const next = [];
    for (let i = 0; i < nodes.length; i += 2) {
      next.push(poseidon2HashWithSeparator([nodes[i], nodes[i + 1]], generator));
    }
    nodes = await Promise.all(next);
  }

  return nodes[0];
}
