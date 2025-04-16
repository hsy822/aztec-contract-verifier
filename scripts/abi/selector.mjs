import { toBufferBE } from '@aztec/foundation/bigint-buffer';
import { Fr } from '@aztec/foundation/fields';
import { bufferToHex } from '@aztec/foundation/string';
import { inspect } from 'util';

export class Selector {
  static SIZE = 4;

  constructor(value) {
    if (value > 2 ** (Selector.SIZE * 8) - 1) {
      throw new Error(`Selector must fit in ${Selector.SIZE} bytes (got value ${value}).`);
    }
    this.value = value;
  }

  isEmpty() {
    return this.value === 0;
  }

  toBuffer(bufferSize = Selector.SIZE) {
    return toBufferBE(BigInt(this.value), bufferSize);
  }

  toString() {
    return bufferToHex(this.toBuffer());
  }

  [inspect.custom]() {
    return `Selector<${this.toString()}>`;
  }

  equals(other) {
    return this.value === other.value;
  }

  toField() {
    return new Fr(BigInt(this.value));
  }
}
