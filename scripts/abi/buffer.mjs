import { Fr } from '@aztec/foundation/fields';
import chunk from 'lodash.chunk';

export function bufferAsFields(input, targetLength) {
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

export function bufferFromFields(fields) {
  const [length, ...payload] = fields;
  return Buffer.concat(payload.map(f => f.toBuffer().subarray(1))).subarray(0, length.toNumber());
}
