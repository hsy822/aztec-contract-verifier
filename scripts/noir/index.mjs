import {
    ABIParameter,
    ABIParameterVisibility,
    AbiErrorType,
    AbiType,
    AbiValue,
    DebugFileMap,
    DebugInfo,
  } from '../abi/abi.mjs';
  
  export const AZTEC_PRIVATE_ATTRIBUTE = 'private';
  export const AZTEC_PUBLIC_ATTRIBUTE = 'public';
  export const AZTEC_UTILITY_ATTRIBUTE = 'utility';
  export const AZTEC_INTERNAL_ATTRIBUTE = 'internal';
  export const AZTEC_INITIALIZER_ATTRIBUTE = 'initializer';
  export const AZTEC_VIEW_ATTRIBUTE = 'view';
  
  export function isNoirContractCompilationArtifacts(artifact) {
    return artifact.contract !== undefined;
  }
  
  export function isNoirProgramCompilationArtifacts(artifact) {
    return artifact.program !== undefined;
  } 
  
  // Re-export type declarations for .mjs compatibility
  export {
    ABIParameter,
    ABIParameterVisibility,
    AbiErrorType,
    AbiType,
    AbiValue,
    DebugFileMap,
    DebugInfo,
  };
  