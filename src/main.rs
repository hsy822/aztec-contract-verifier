mod args;
mod github;
mod toolchain;
mod compiler;         

use args::CliArgs;
use clap::Parser;
use github::releases::{fetch_prebuilt_versions, prompt_select_version};
use compiler::run::run_aztec_nargo;
use std::path::Path;
use toolchain::{prepare_toolchain, ToolchainPaths};

fn main() -> anyhow::Result<()> {
    println!("🔧 Aztec Contract Verifier CLI (prebuilt edition)");

    // Parse arguments & locate source directory
    let args = CliArgs::parse();
    let source_dir = Path::new(&args.source);

    // Show release tags (from our repo) and let user choose
    let versions = fetch_prebuilt_versions()?;
    let selected_version = prompt_select_version(versions)?;
    println!("📦 Selected toolchain: {}", selected_version);

    // Download or reuse prebuilt toolchain
    let tc = prepare_toolchain(&selected_version)?;

    // Compile using the downloaded toolchain
    run_aztec_nargo(
        &tc.root,
        &tc.aztec_nargo,
        &tc.nargo,
        &tc.transpiler,
        &tc.bb,
        source_dir,
    )?;
    
    // Resolve artifact path produced by nargo
    let contract = source_dir
        .file_name()
        .unwrap()
        .to_str()
        .unwrap();
    let artifact = source_dir
        .join("target")
        .join(format!("{}_contract-{}.json", contract, to_pascal_case(contract)));
    println!("📂 Artifact generated: {}", artifact.display());

    if !artifact.exists() {
        anyhow::bail!("❌ Expected artifact not found.");
    }

    // Run JS verifier (local vs on‑chain classID)
    let status = std::process::Command::new("node")
        .arg("scripts/verify_class_id.mjs")
        .arg("--artifact").arg(artifact)
        .arg("--address").arg(&args.address)
        .arg("--network").arg(&args.network)
        .status()?;

    if status.success() {
        println!("Done");
    } else {
        anyhow::bail!("❌ JS verifier failed.");
    }

    Ok(())
}

// counter → Counter
fn to_pascal_case(s: &str) -> String {
    s.split('_')
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect()
}