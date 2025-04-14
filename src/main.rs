mod args;
mod compiler;
mod github;

use std::path::Path;
use compiler::{build_noir_nargo, run_aztec_nargo, build_aztec_nargo_from_git};
use github::{fetch_compiler_versions, prompt_select_version};

fn main() {
    println!("🔧 Aztec Contract Verifier CLI");

    let versions = fetch_compiler_versions().expect("❌ Failed to fetch compiler versions");

    let selected_version = prompt_select_version(versions).expect("❌ Failed to select version");

    println!("📦 Selected version: {}", selected_version);

    let nargo = build_noir_nargo().expect("❌ Failed to build Noir nargo");
    let aztec_nargo = build_aztec_nargo_from_git(&selected_version).expect("❌ Failed to setup aztec-nargo");

    let source_dir = Path::new("./contracts/counter");

    run_aztec_nargo(&aztec_nargo, &nargo, source_dir).expect("❌ Compilation failed");
}
