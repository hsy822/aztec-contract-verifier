import { poseidon2HashAccumulate } from '@aztec/foundation/crypto';
import { Fr } from '@aztec/foundation/fields';

export class FunctionSelector {
  constructor(fr) {
    this.fr = fr;
  }

  static async fromNameAndParameters(name, params) {
    const signature = `${name}(${params.map(p => getTypeName(p.type)).join(',')})`;
    const utf8 = Buffer.from(signature, 'utf-8');

    // split into 31-byte chunks and wrap in Frs
    const chunks = [];
    for (let i = 0; i < utf8.length; i += Fr.SIZE_IN_BYTES - 1) {
      const chunk = Buffer.alloc(Fr.SIZE_IN_BYTES);
      utf8.slice(i, i + Fr.SIZE_IN_BYTES - 1).copy(chunk, 1); // skip first byte
      chunks.push(Fr.fromBuffer(chunk));
    }

    const selectorFr = await poseidon2HashAccumulate(chunks);
    return new FunctionSelector(selectorFr);
  }

  toField() {
    return this.fr;
  }

  toString() {
    return this.fr.toString(); // already includes 0x prefix
  }
}

function getTypeName(type) {
  switch (type.kind) {
    case 'field':
      return 'Field';
    case 'boolean':
      return 'bool';
    case 'integer':
      return `${type.sign === 'signed' ? 'i' : 'u'}${type.width}`;
    case 'array':
      return `[${getTypeName(type.type)};${type.length}]`;
    case 'string':
      return `str[${type.length}]`;
    case 'tuple':
      return `(${type.fields.map(getTypeName).join(',')})`;
    case 'struct':
      return `(${type.fields.map(f => `${f.name}: ${getTypeName(f.type)}`).join(', ')})`;
    default:
      return 'unknown';
  }
}
