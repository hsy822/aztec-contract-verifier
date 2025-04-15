import { poseidon2HashAccumulate } from '@aztec/foundation/crypto';
import { vkAsFieldsMegaHonk } from '@aztec/foundation/crypto';

export async function hashVK(vkBuffer) {
  const fields = await vkAsFieldsMegaHonk(vkBuffer);
  return poseidon2HashAccumulate(fields);
}

export { vkAsFieldsMegaHonk };
