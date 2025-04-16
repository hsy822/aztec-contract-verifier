import { jsonParseWithSchema, jsonStringify } from '@aztec/foundation/json-rpc';
import {
  ABIParameterSchema as ABIParameter,
  AbiTypeSchema as AbiType,
  AbiValueSchema as AbiValue,
  ContractArtifactSchema,
  ContractNoteSchema,
  FunctionAbiSchema,
  FunctionArtifactSchema as FunctionArtifact,
  FunctionType,
} from '../abi/abi.mjs';
import {
  AZTEC_INITIALIZER_ATTRIBUTE,
  AZTEC_INTERNAL_ATTRIBUTE,
  AZTEC_PRIVATE_ATTRIBUTE,
  AZTEC_PUBLIC_ATTRIBUTE,
  AZTEC_UTILITY_ATTRIBUTE,
  AZTEC_VIEW_ATTRIBUTE,
} from '../noir/index.mjs';

export function contractArtifactToBuffer(artifact) {
  return Buffer.from(jsonStringify(artifact), 'utf-8');
}

export function contractArtifactFromBuffer(buffer) {
  return jsonParseWithSchema(buffer.toString('utf-8'), ContractArtifactSchema);
}

// export all helper functions here (like loadContractArtifact, generateContractArtifact, etc.)
// This version assumes their implementation is handled elsewhere or inline if needed

export { FunctionType, ContractArtifactSchema as ContractArtifact, FunctionArtifact };
