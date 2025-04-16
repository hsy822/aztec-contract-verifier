import { toBigIntBE } from '@aztec/foundation/bigint-buffer';
import { randomInt } from '@aztec/foundation/crypto';
import { Fr } from '@aztec/foundation/fields';
import { hexSchemaFor } from '@aztec/foundation/schemas';
import { BufferReader, TypeRegistry } from '@aztec/foundation/serialize';

import { Selector } from './selector.mjs';

export class NoteSelector extends Selector {
  static fromBuffer(buffer) {
    const reader = BufferReader.asReader(buffer);
    const value = Number(toBigIntBE(reader.readBytes(Selector.SIZE)));
    if (value >= 1 << 7) {
      throw new Error(`Invalid note selector: ${value}`);
    }
    return new NoteSelector(value);
  }

  static fromString(buf) {
    const withoutPrefix = buf.replace(/^0x/i, '').slice(-8);
    const buffer = Buffer.from(withoutPrefix, 'hex');
    return NoteSelector.fromBuffer(buffer);
  }

  static fromField(fr) {
    return new NoteSelector(Number(fr.toBigInt()));
  }

  static empty() {
    return new NoteSelector(0);
  }

  static random() {
    const value = randomInt(1 << 7);
    return NoteSelector.fromField(new Fr(value));
  }

  toJSON() {
    return this.toString();
  }

  static get schema() {
    return hexSchemaFor(NoteSelector);
  }
}

TypeRegistry.register('NoteSelector', NoteSelector);