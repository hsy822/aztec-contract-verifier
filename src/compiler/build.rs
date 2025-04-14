use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use std::process::Stdio;

/// Clone noir-lang/noir, build nargo, and return path to built binary
pub fn build_noir_nargo() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let base_dir = home.join(".aztec-verifier/noir-lang/noir");
    let target_binary = base_dir.join("target/release/nargo");

    if target_binary.exists() {
        println!("✅ nargo already built at: {}", target_binary.display());
        return Ok(target_binary);
    }

    // Clone noir-lang/noir if not already cloned
    if !base_dir.exists() {
        println!("📦 Cloning noir-lang/noir...");
        fs::create_dir_all(base_dir.parent().unwrap())?;
        let status = Command::new("git")
            .args(["clone", "https://github.com/noir-lang/noir.git", base_dir.to_str().unwrap()])
            .status()?;
        if !status.success() {
            return Err("Git clone of noir failed".into());
        }
    }

    // Build nargo
    println!("🔨 Building nargo from noir-lang/noir...");
    let status = Command::new("cargo")
        .args(["build", "--release"])
        .current_dir(&base_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;
    if !status.success() {
        return Err("Failed to build nargo".into());
    }

    if !target_binary.exists() {
        return Err("Built nargo binary not found".into());
    }

    println!("✅ Built nargo at: {}", target_binary.display());
    Ok(target_binary)
}

/// Clone aztec-packages, build nargo, and return compiled `aztec-nargo` wrapper script path
pub fn build_aztec_nargo_from_git(version: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let base_dir = home.join(".aztec-verifier/git").join(version);
    let compiler_bin = home.join(".aztec-verifier/compilers").join(version).join("aztec-nargo");

    // If already installed, return
    if compiler_bin.exists() {
        println!("✅ aztec-nargo v{} already installed.", version);
        return Ok(compiler_bin);
    }

    // Clone aztec-packages if not present
    if !base_dir.exists() {
        println!("📦 Cloning aztec-packages for version {}...", version);
        let status = Command::new("git")
            .args(["clone", "https://github.com/AztecProtocol/aztec-packages.git", base_dir.to_str().unwrap()])
            .status()?;
        if !status.success() {
            return Err("Git clone failed".into());
        }
    }

    let status = Command::new("cargo")
        .args(["build", "--release"])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;
    if !status.success() {
        return Err("Failed to build nargo".into());
    }

    // Use compile_then_postprocess.sh as aztec-nargo wrapper
    let wrapper_path = base_dir.join("aztec-nargo/compile_then_postprocess.sh");
    if !wrapper_path.exists() {
        return Err("compile_then_postprocess.sh not found in aztec-nargo".into());
    }
    fs::create_dir_all(compiler_bin.parent().unwrap())?;
    fs::copy(&wrapper_path, &compiler_bin)?;
    fs::set_permissions(&compiler_bin, fs::Permissions::from_mode(0o755))?;

    println!("✅ aztec-nargo installed to: {}", compiler_bin.display());
    Ok(compiler_bin)
}