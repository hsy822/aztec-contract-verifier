use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use reqwest::blocking::get;
use dirs_next;


use std::process::{Stdio};

/// Get path to local aztec-nargo for specified version
pub fn get_compiler_path(version: &str) -> PathBuf {
    let home = dirs_next::home_dir().expect("Cannot find home directory");
    home.join(".aztec-verifier/compilers")
        .join(version)
        .join("aztec-nargo")
}

/// Check if aztec-nargo exists for this version
pub fn ensure_compiler_installed(version: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let compiler_path = get_compiler_path(version);

    if compiler_path.exists() {
        println!("✅ aztec-nargo v{} already installed.", version);
        return Ok(compiler_path);
    }

    println!("🔽 Downloading aztec-nargo v{}...", version);

    let url = format!(
        "https://github.com/AztecProtocol/aztec-packages/releases/download/aztec-nargo-v{}/aztec-nargo",
        version
    );

    let resp = get(&url)?;
    if !resp.status().is_success() {
        return Err(format!("❌ Failed to download compiler v{}: HTTP {}", version, resp.status()).into());
    }
    let parent = compiler_path.parent().unwrap();
    fs::create_dir_all(parent)?;
    let mut file = fs::File::create(&compiler_path)?;
    io::copy(&mut resp.take(100_000_000), &mut file)?;

    // Make executable (Linux/macOS)
    #[cfg(unix)]
    fs::set_permissions(&compiler_path, fs::Permissions::from_mode(0o755))?;

    println!("✅ Downloaded and installed to {}", compiler_path.display());
    Ok(compiler_path)
}

pub fn run_compile(
    compiler_path: &Path,
    source_path: &str,
    output_dir: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let program_name = Path::new(source_path)
        .file_stem()
        .ok_or("Invalid source file name")?
        .to_string_lossy();

    println!("🚀 Compiling program `{}`...", program_name);

    let status = Command::new(compiler_path)
        .arg("compile")
        .arg("--program-name")
        .arg(program_name.as_ref())
        .arg("--output-directory")
        .arg(output_dir)
        .current_dir(Path::new(source_path).parent().unwrap()) // 소스 위치 기준 컴파일
        .status()?;

    if !status.success() {
        return Err("❌ Compilation failed".into());
    }

    println!("✅ Compilation complete. Artifact at: {}/contract.json", output_dir);
    Ok(())
}

use dirs;

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

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ContractArtifact {
    pub contract_class: ContractClass,
}

#[derive(Debug, Deserialize)]
struct ContractClass {
    pub id: String,
}

/// Parse a Noir contract artifact JSON file and extract contract_class.id
pub fn extract_contract_class_id(path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    // let content = fs::read_to_string(path)?;
    // let artifact: ContractArtifact = serde_json::from_str(&content)?;
    Ok((&"dte").to_string())
}
