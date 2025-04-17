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