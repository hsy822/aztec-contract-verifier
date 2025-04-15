import { Fr } from '@aztec/foundation/fields';

export function bufferAsFields(buffer, targetLength) {
  const chunkSize = Fr.SIZE_IN_BYTES - 1;
  const fields = [new Fr(buffer.length)];

  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = Buffer.alloc(Fr.SIZE_IN_BYTES);
    buffer.slice(i, i + chunkSize).copy(chunk, 1); // offset 1
    fields.push(Fr.fromBuffer(chunk));
  }

  if (fields.length > targetLength) {
    throw new Error(`Buffer too long: ${fields.length} > ${targetLength}`);
  }

  return [...fields, ...Array(targetLength - fields.length).fill(Fr.ZERO)];
}
