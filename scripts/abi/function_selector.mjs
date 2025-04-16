import { fromHex, toBigIntBE } from '@aztec/foundation/bigint-buffer';
import { poseidon2HashBytes, randomBytes } from '@aztec/foundation/crypto';
import { hexSchemaFor } from '@aztec/foundation/schemas';
import { BufferReader, FieldReader, TypeRegistry } from '@aztec/foundation/serialize';

import { decodeFunctionSignature } from './decoder.mjs';
import { Selector } from './selector.mjs';

export class FunctionSelector extends Selector {
  static fromBuffer(buffer) {
    const reader = BufferReader.asReader(buffer);
    const value = Number(toBigIntBE(reader.readBytes(Selector.SIZE)));
    return new FunctionSelector(value);
  }

  static fromField(fr) {
    return new FunctionSelector(Number(fr.toBigInt()));
  }

  static fromFields(fields) {
    const reader = FieldReader.asReader(fields);
    return FunctionSelector.fromField(reader.readField());
  }

  static async fromSignature(signature) {
    if (/\s/.test(signature)) {
      throw new Error('Signature cannot contain whitespace');
    }
    const hash = await poseidon2HashBytes(Buffer.from(signature));
    const bytes = hash.toBuffer().slice(-Selector.SIZE);
    return FunctionSelector.fromBuffer(bytes);
  }

  static fromString(selector) {
    const buf = fromHex(selector);
    if (buf.length !== Selector.SIZE) {
      throw new Error(`Invalid FunctionSelector length ${buf.length} (expected ${Selector.SIZE}).`);
    }
    return FunctionSelector.fromBuffer(buf);
  }

  static empty() {
    return new FunctionSelector(0);
  }

  static fromNameAndParameters(args, maybeParameters) {
    const { name, parameters } =
      typeof args === 'string' ? { name: args, parameters: maybeParameters } : args;
    const signature = decodeFunctionSignature(name, parameters);
    return this.fromSignature(signature);
  }

  static random() {
    return FunctionSelector.fromBuffer(randomBytes(Selector.SIZE));
  }

  toJSON() {
    return this.toString();
  }

  static get schema() {
    return hexSchemaFor(FunctionSelector);
  }
}

TypeRegistry.register('FunctionSelector', FunctionSelector);
