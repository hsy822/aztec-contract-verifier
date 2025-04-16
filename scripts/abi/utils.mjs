export function isAddressStruct(abiType) {
    return isEthAddressStruct(abiType) || isAztecAddressStruct(abiType);
  }
  
  export function isEthAddressStruct(abiType) {
    return abiType.kind === 'struct' && abiType.path.endsWith('address::EthAddress');
  }
  
  export function isAztecAddressStruct(abiType) {
    return abiType.kind === 'struct' && abiType.path.endsWith('address::AztecAddress');
  }
  
  export function isFunctionSelectorStruct(abiType) {
    return abiType.kind === 'struct' && abiType.path.endsWith('types::abis::function_selector::FunctionSelector');
  }
  
  export function isWrappedFieldStruct(abiType) {
    return (
      abiType.kind === 'struct' &&
      abiType.fields.length === 1 &&
      abiType.fields[0].name === 'inner' &&
      abiType.fields[0].type.kind === 'field'
    );
  }
  
  export function parseSignedInt(buffer, width) {
    const buf = Buffer.from(buffer);
    const slicedBuf = width !== undefined ? buf.subarray(-(width / 8)) : buf;
  
    if (0x80 & slicedBuf.subarray(0, 1).readUInt8()) {
      for (let i = 0; i < slicedBuf.length; i++) {
        slicedBuf[i] = ~slicedBuf[i];
      }
      return -(BigInt(`0x${slicedBuf.toString('hex')}`) + 1n);
    }
  
    return BigInt(`0x${slicedBuf.toString('hex')}`);
  }