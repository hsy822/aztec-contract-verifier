mod args;
mod compiler;
mod github;

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use compiler::{build_noir_nargo, run_aztec_nargo, build_aztec_nargo_from_git};
use github::{fetch_compiler_versions, prompt_select_version};
use args::CliArgs;

use clap::Parser;

fn main() {
    println!("🔧 Aztec Contract Verifier CLI");

    let args = CliArgs::parse();
    let source_dir = Path::new(&args.source);
    let contract_name = source_dir.file_name().unwrap().to_str().unwrap();

    let versions = fetch_compiler_versions().expect("❌ Failed to fetch compiler versions");
    let selected_version = prompt_select_version(versions).expect("❌ Failed to select version");

    println!("📦 Selected compiler version: {}", selected_version);

    let nargo = build_noir_nargo().expect("❌ Failed to build Noir nargo");
    let aztec_nargo = build_aztec_nargo_from_git(&selected_version).expect("❌ Failed to setup aztec-nargo");

    run_aztec_nargo(&aztec_nargo, &nargo, source_dir).expect("❌ Compilation failed");

    let artifact_path = source_dir
        .join("target")
        .join(format!("{contract_name}_contract-{}.json", to_pascal_case(contract_name)));

    println!("\n📂 Artifact generated: {}", artifact_path.display());

    if !artifact_path.exists() {
        eprintln!("❌ Expected artifact not found: {}", artifact_path.display());
        std::process::exit(1);
    }

    println!("\n🔎 Running JS verifier...");
    let status = Command::new("node")
        .arg("scripts/verify_class_id.mjs")
        .arg("--artifact")
        .arg(artifact_path.to_str().unwrap())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("\n✅ Class ID verification complete.");
        }
        _ => {
            eprintln!("\n⚠️ JS verifier execution failed.");
            eprintln!("   You can run it manually:");
            eprintln!("   node scripts/verify_class_id.mjs --artifact {}", artifact_path.display());
        }
    }
}

// Util: counter → Counter
fn to_pascal_case(input: &str) -> String {
    input
        .split('_')
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect()
}
