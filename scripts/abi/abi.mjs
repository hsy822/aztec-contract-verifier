import { Fr } from '@aztec/foundation/fields';
import { createLogger } from '@aztec/foundation/log';
import { schemas } from '@aztec/foundation/schemas';
import { inflate } from 'pako';
import { z } from 'zod';

import { FunctionSelector } from './function_selector.mjs';
import { NoteSelector } from './note_selector.mjs';

export const logger = createLogger('aztec:foundation:abi');

export const ABIParameterVisibility = ['public', 'private', 'databus'];
const Sign = ['unsigned', 'signed'];

// ======================== ABI VALUE ==========================
export const AbiValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('boolean'), value: z.boolean() }),
  z.object({ kind: z.literal('string'), value: z.string() }),
  z.object({ kind: z.literal('array'), value: z.array(z.lazy(() => AbiValueSchema)) }),
  z.object({ kind: z.literal('tuple'), fields: z.array(z.lazy(() => AbiValueSchema)) }),
  z.object({ kind: z.literal('integer'), value: z.string(), sign: z.boolean() }),
  z.object({
    kind: z.literal('struct'),
    fields: z.array(z.object({ name: z.string(), value: z.lazy(() => AbiValueSchema) })),
  }),
]);

// ======================== ABI TYPE ==========================
export const AbiTypeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field') }),
  z.object({ kind: z.literal('boolean') }),
  z.object({ kind: z.literal('integer'), sign: z.enum(Sign), width: z.number() }),
  z.object({ kind: z.literal('array'), length: z.number(), type: z.lazy(() => AbiTypeSchema) }),
  z.object({ kind: z.literal('string'), length: z.number() }),
  z.object({ kind: z.literal('struct'), fields: z.array(z.lazy(() => ABIVariableSchema)), path: z.string() }),
  z.object({ kind: z.literal('tuple'), fields: z.array(z.lazy(() => AbiTypeSchema)) }),
]);

export const ABIVariableSchema = z.object({
  name: z.string(),
  type: AbiTypeSchema,
});

export const ABIParameterSchema = ABIVariableSchema.and(
  z.object({ visibility: z.enum(ABIParameterVisibility) })
);

// ======================== ABI ERROR ==========================
export const AbiErrorTypeSchema = z.union([
  z.object({ error_kind: z.literal('string'), string: z.string() }),
  z.object({ error_kind: z.literal('fmtstring'), length: z.number(), item_types: z.array(AbiTypeSchema) }),
  z.object({ error_kind: z.literal('custom') }).and(AbiTypeSchema),
]);

// ======================== FUNCTION TYPE ==========================
export const FunctionType = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  UTILITY: 'utility',
};

export const FunctionAbiSchema = z.object({
  name: z.string(),
  functionType: z.nativeEnum(FunctionType),
  isInternal: z.boolean(),
  isStatic: z.boolean(),
  isInitializer: z.boolean(),
  parameters: z.array(ABIParameterSchema),
  returnTypes: z.array(AbiTypeSchema),
  errorTypes: z.record(AbiErrorTypeSchema),
});

export const FunctionDebugMetadataSchema = z.object({
  debugSymbols: z.object({
    locations: z.record(z.array(z.object({ span: z.object({ start: z.number(), end: z.number() }), file: z.number() }))),
    brillig_locations: z.record(z.record(z.array(z.object({ span: z.object({ start: z.number(), end: z.number() }), file: z.number() })))),
  }),
  files: z.record(z.object({ source: z.string(), path: z.string() })),
});

export const DebugInfoSchema = FunctionDebugMetadataSchema.shape.debugSymbols.shape;
export const DebugFileMapSchema = FunctionDebugMetadataSchema.shape.files;

export const FunctionArtifactSchema = FunctionAbiSchema.and(
  z.object({
    bytecode: schemas.Buffer,
    verificationKey: z.string().optional(),
    debugSymbols: z.string(),
    debug: FunctionDebugMetadataSchema.optional(),
  })
);

export const NoteFieldSchema = z.object({
  name: z.string(),
  index: z.number(),
  nullable: z.boolean(),
});

export const ContractNoteSchema = z.object({
  id: NoteSelector.schema,
  typ: z.string(),
  fields: z.array(NoteFieldSchema),
});

export const ContractArtifactSchema = z.object({
  name: z.string(),
  functions: z.array(FunctionArtifactSchema),
  nonDispatchPublicFunctions: z.array(FunctionAbiSchema),
  outputs: z.object({
    structs: z.record(z.array(AbiTypeSchema)).transform(structs => {
      for (const [key, value] of Object.entries(structs)) {
        if (key === 'events' || key === 'functions') {
          structs[key] = value.sort((a, b) => (a.path > b.path ? -1 : 1));
        }
      }
      return structs;
    }),
    globals: z.record(z.array(AbiValueSchema)),
  }),
  storageLayout: z.record(z.object({ slot: schemas.Fr })),
  notes: z.record(ContractNoteSchema),
  fileMap: z.record(z.coerce.number(), z.object({ source: z.string(), path: z.string() })),
});

// ======================== EXPORT ==========================
export {
  AbiTypeSchema as AbiType,
  AbiValueSchema as AbiValue,
  ABIParameterSchema as ABIParameter,
  AbiErrorTypeSchema as AbiErrorType,
  FunctionArtifactSchema as FunctionArtifact,
  ContractArtifactSchema as ContractArtifact,
  DebugInfoSchema as DebugInfo,
  DebugFileMapSchema as DebugFileMap,
};