import { Fr } from '@aztec/foundation/fields';
import { isAztecAddressStruct, parseSignedInt } from './utils.mjs';

export function decodeFromAbi(typ, buffer) {
  return new AbiDecoder(typ, buffer.slice()).decode();
}

export class FunctionSignatureDecoder {
  constructor(name, parameters, includeNames = false) {
    this.name = name;
    this.parameters = parameters;
    this.includeNames = includeNames;
    this.separator = includeNames ? ', ' : ',';
  }

  getParameterType(param) {
    switch (param.kind) {
      case 'field': return 'Field';
      case 'integer':
        if (param.sign === 'signed') throw new Error('Unsupported type: signed integer');
        return `u${param.width}`;
      case 'boolean': return 'bool';
      case 'array': return `[${this.getParameterType(param.type)};${param.length}]`;
      case 'string': return `str<${param.length}>`;
      case 'struct': return `(${param.fields.map(f => this.decodeParameter(f)).join(this.separator)})`;
      default: throw new Error(`Unsupported type: ${param}`);
    }
  }

  decodeParameter(param) {
    const type = this.getParameterType(param.type);
    return this.includeNames ? `${param.name}: ${type}` : type;
  }

  decode() {
    return `${this.name}(${this.parameters.map(p => this.decodeParameter(p)).join(this.separator)})`;
  }
}

export function decodeFunctionSignature(name, parameters) {
  return new FunctionSignatureDecoder(name, parameters).decode();
}

export function decodeFunctionSignatureWithParameterNames(name, parameters) {
  return new FunctionSignatureDecoder(name, parameters, true).decode();
}