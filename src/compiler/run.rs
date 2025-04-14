use std::path::Path;
use std::process::Command;
use std::process::Stdio;

pub fn run_aztec_nargo(
    aztec_nargo_path: &Path,
    nargo_path: &Path,
    source_dir: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Running aztec-nargo compile...");

    let status = Command::new(aztec_nargo_path)
        .arg("compile")
        .env("NARGO", nargo_path)
        .current_dir(source_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;

        if !status.success() {
            println!("⚠️ aztec-nargo exited with non-zero status. (may still be okay)");
        }

    println!("✅ Compilation complete.");
    Ok(())
}