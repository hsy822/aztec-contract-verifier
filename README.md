# Aztec Contract Verifier CLI

> A CLI tool to compile Aztec Noir contracts and calculate the Aztec contract class ID — using the exact same hashing logic as the Aztec protocol.

---

### ⚠ Current Status

This tool **successfully replicates Aztec’s class ID logic** (via poseidon2, selector sorting, verification key hashing, etc.) but still produces a **different class ID from PXE**, even with identical contract artifacts.

I am actively investigating the cause — likely due to differences in:
- JSON serialization or key order
- Private function sorting / selector mapping
- Verification key formatting

Any help or debugging insight from the community is appreciated!

---

### What it does

- Downloads and builds `aztec-nargo` from a selected GitHub release
- Compiles Aztec Noir contract to a JSON artifact
- Calculates the `classId` using official Aztec logic (via JavaScript)

---

### What’s missing

- ❌ It does **not** compare the class ID with the deployed contract (yet)
---

### Usage

#### 1. Install

```bash
cargo build --release
npm install
```

Requires:
- Rust
- Node.js (v18+)
- Git

#### 2. Run

```bash
cargo run -- --source ./contracts/counter --address 0x1234... --pxe http://localhost:8080
```

- **--source**: Path to the Noir contract source
- **--address** and **--pxe**: Placeholder for future features (currently unused)

This will:
- Prompt you to select a compiler version
- Build `aztec-nargo`
- Compile the Noir contract
- Automatically compute the class ID via JS

---

### 📦 Output

```bash
🔍 Starting contract verification...
✅ Class ID calculation completed.
🔑 Computed Contract Class ID: 0x25b87d...
⚠️  Note: Comparison with deployed contracts is not implemented yet.
```

---
