# Aztec‑Contract‑Verifier CLI

Verify a Noir smart‑contract (source or artifact) against the **deployed** Aztec
contract class‑ID, using a **pre‑built toolchain**.

## Features
* Downloads & caches a toolchain (`toolchain‑<tag>.tar.gz`) from this repo  
  → no local build of `aztec‑packages` needed
* Runs `aztec‑nargo compile` (wrapper) to produce artifacts + verification keys
* Computes local class‑ID and compares it with the on‑chain value via PXE

## Build

```bash
cargo build --release
npm i
```

## Usage

```bash
cargo run --bin aztec-verifier -- \
  --source   contracts/counter \
  --address  0x024954a9de5a89cd80db5c0a93325f55954dc1658cc07f79a78c8c5cc61ac3ad \
  --network  "http://localhost:8080"
```

## How it works

1. Select a toolchain version from this repo’s releases.  
2. Download (or reuse) to `~/.aztec-verifier/prebuilt/<tag>/`.  
3. Compile the project in‑place with **aztec‑nargo** (generates VKs).  
4. Run the JS verifier; it prints local & on‑chain Class‑IDs and tells you if they match.

## Example output

📦 Intermediate Hashes:
   • Artifact Hash:              0x06a6f218e8673f0b3063af020bb319de74e08c714b7e7232a26728725be5d644
   • Private Functions Root:     0x2cd0bca700981f9a481db3c4aecfc3f0fec9a495ba62d430ac5acf59cc1bf5c7
   • Public Bytecode Commitment: 0x19b2e250d3238792f10f574756e12c6f46105e0c39de72ded6a0f7265b429708

🔐 Sorted Private Functions:
   [0] selector=0x03b97612 vkHash=0x21dd81b09cf0ba8850153ba8408cbcee91a56478b1b74b5684c25108465ea087
   [1] selector=0x227e244e vkHash=0x2b64e6657e6cb2c379813cdd0c9f2280ef8028e810fc53712017c695f283fea3
   [2] selector=0x3202d1a8 vkHash=0x14d2824506588f3cfea880c233ea4800afbe5c552237d1fceb9bd9071c767088
   [3] selector=0x8c5f03c2 vkHash=0x21055a945326547e772f1ce4e118dd214838d44a30978f9be5593ecab0e28342
   [4] selector=0x9d24dc54 vkHash=0x2ca80e138d3a97e64573a4c51616554f020f0672adc3ffc1ae73bec2279da8fe

✅ Final Computed Class ID:
   0x031854d50873b96daf9b11362ab2638f7b0cd5f880c4d2c0c176509f154b481f

🔗 On‑chain Class ID (from Network):
   0x12460f3fe6bb50f010148c971bbf560deaf2727cd2cf948044f24360da3fc4d8

✖️  Class‑ID mismatch. (on‑chain ❌ local)
