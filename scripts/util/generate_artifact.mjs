import { Fr } from '@aztec/foundation/fields';
import { FunctionType } from '@aztec/aztec.js';

function getFunctionTypeFromAttributes(attrs) {
  if (attrs.includes('private')) return FunctionType.PRIVATE;
  if (attrs.includes('public')) return FunctionType.PUBLIC;
  if (attrs.includes('utility')) return FunctionType.UTILITY;
  return 'unknown';
}

function retainBytecode(fn) {
  const type = fn.functionType || getFunctionTypeFromAttributes(fn.custom_attributes || []);
  return type !== FunctionType.PUBLIC || fn.name === 'public_dispatch';
}

function processOutputStructs(structsRaw) {
  const structs = (structsRaw.functions || []).filter(s => s.kind === 'struct');
  structs.sort((a, b) => (a.path > b.path ? 1 : -1));
  return structs;
}

function convertStructArrayToRecord(structArray) {
  const record = {};
  for (const s of structArray) {
    if (s.kind === 'struct') {
      record[s.path] = s.fields;
    }
  }
  return record;
}

function extractReturnTypes(contractName, fnName, structs) {
  const path = `${contractName}::${fnName}_abi`;
  const s = structs.find(s => s.path === path);
  if (!s) return [];
  const returnField = s.fields.find(f => f.name === 'return_type');
  return returnField ? [returnField.type] : [];
}

export function generateContractArtifact(input) {
  const name = input.name;
  const fileMap = input.file_map || {};
  const structsArray = processOutputStructs(input.outputs?.structs || {});
  const structs = convertStructArrayToRecord(structsArray);

  const functions = input.functions.map(fn => {
    const functionType = getFunctionTypeFromAttributes(fn.custom_attributes || []);
    return {
      name: fn.name,
      functionType,
      isInternal: fn.custom_attributes?.includes('internal') || false,
      isStatic: fn.custom_attributes?.includes('view') || false,
      isInitializer: fn.custom_attributes?.includes('constructor') || fn.custom_attributes?.includes('initializer') || false,
      parameters: fn.abi?.parameters || [],
      returnTypes: extractReturnTypes(input.name, fn.name, structsArray),
      errorTypes: fn.abi?.error_types || {},
      bytecode: Buffer.from(fn.bytecode || '', 'base64'),
      verificationKey: fn.verificationKey,
      debugSymbols: fn.debugSymbols || '',
    };
  });

  const nonDispatchPublicFunctions = input.functions
    .filter(fn => getFunctionTypeFromAttributes(fn.custom_attributes || []) === FunctionType.PUBLIC && fn.name !== 'public_dispatch')
    .map(fn => ({
      name: fn.name,
      functionType: FunctionType.PUBLIC,
      parameters: fn.abi?.parameters || [],
      returnTypes: extractReturnTypes(input.name, fn.name, structsArray),
      isInternal: false,
      isStatic: false,
      isInitializer: false,
      errorTypes: {},
    }));

  return {
    name,
    fileMap,
    functions,
    nonDispatchPublicFunctions,
    outputs: {
      structs,
      globals: input.outputs?.globals || {},
    },
    storageLayout: input.outputs?.globals?.storage || {},
    notes: input.outputs?.globals?.notes || {},
  };
}
