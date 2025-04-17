#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { loadContractArtifact, getContractClassFromArtifact, createPXEClient } from '@aztec/aztec.js';

program
  .requiredOption('--artifact <path>', 'Path to the compiled contract artifact (.json)')
  .option('--address <string>', 'Contract address to compare class ID on-chain')
  .option('--pxe-url <string>', 'PXE endpoint URL', 'http://localhost:8080')
  .parse(process.argv);

const { artifact: artifactPath, address: contractAddress, pxeUrl } = program.opts();

(async () => {
  try {
    const fullPath = path.resolve(artifactPath);
    const rawJson = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

    const artifact = loadContractArtifact(rawJson);
    const {
      id,
      artifactHash,
      privateFunctions,
      privateFunctionsRoot,
      publicBytecodeCommitment,
    } = await getContractClassFromArtifact(artifact);

    console.log(`\n🔍 Verifying Contract: ${artifact.name}`);
    console.log(`   • Total functions: ${artifact.functions.length}`);
    console.log(`   • Private functions: ${privateFunctions.length}`);

    console.log('\n📦 Intermediate Hashes:');
    console.log(`   • Artifact Hash:              ${artifactHash.toString()}`);
    console.log(`   • Private Functions Root:     ${privateFunctionsRoot.toString()}`);
    console.log(`   • Public Bytecode Commitment: ${publicBytecodeCommitment.toString()}`);

    console.log('\n🔐 Sorted Private Functions:');
    privateFunctions.forEach((fn, i) => {
      console.log(`   [${i}] selector=${fn.selector.toString()} vkHash=${fn.vkHash.toString()}`);
    });

    console.log('\n✅ Final Computed Class ID:');
    console.log(`   ${id.toString()}`);

    if (contractAddress) {
      const pxe = createPXEClient(pxeUrl);
      const onchain = await pxe.getContractMetadata(contractAddress);
    
      const onchainClassId = onchain?.contractInstance?.currentContractClassId?.toString();
    
      if (!onchainClassId) {
        console.warn(`\n⚠️  No class ID found for contract at ${contractAddress}`);
      } else {
        console.log(`\n🔗 On-chain Class ID (from PXE):`);
        console.log(`   ${onchainClassId}`);
      
        if (onchainClassId === id.toString()) {
          console.log('\n✔️  Class ID match confirmed. (on-chain ✅ local)');
        } else {
          console.error('\n✖️  Class ID mismatch. (on-chain ❌ local)');
        }
      }
    }    
  } catch (err) {
    console.error('❌ Error during contract verification:', err);
    process.exit(1);
  }
})();
