use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use reqwest::blocking::Client;
use serde::Deserialize;

use aztec_contract_verifier::util::platform::detect_platform; 

const REPO: &str = "AztecProtocol/aztec-packages";

#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let version = match env::args().nth(1) {
        Some(v) => v,
        None => {
            println!("🔍 Fetching available Aztec releases...");
            let versions = fetch_supported_versions()?;
            println!("\n📦 Available versions with bb binary for your platform:\n");
            for (i, v) in versions.iter().enumerate() {
                println!("{:>2}. {}", i + 1, v);
            }
            print!("\n👉 Select version by number: ");
            io::stdout().flush()?;
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            let choice: usize = input.trim().parse()?;
            if choice == 0 || choice > versions.len() {
                return Err("❌ Invalid selection.".into());
            }
            versions[choice - 1].clone()
        }
    };

    build_toolchain(&version)?;
    Ok(())
}

fn fetch_supported_versions() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let platform = detect_platform()?;
    let url = format!("https://api.github.com/repos/{}/releases", REPO);
    let client = Client::new();
    let releases: Vec<Release> = client
        .get(&url)
        .header("User-Agent", "aztec-prebuilt-builder")
        .send()?
        .json()?;

    let mut available = vec![];
    for release in releases {
        let tag = release.tag_name;
        let bb_url = format!(
            "https://github.com/{}/releases/download/{}/barretenberg-{}.tar.gz",
            REPO, tag, platform
        );
        let res = client.head(&bb_url).send();
        if let Ok(r) = res {
            if r.status().is_success() {
                available.push(tag);
            }
        }
    }
    Ok(available)
}

fn build_toolchain(version: &str) -> Result<(), Box<dyn std::error::Error>> {
    let cwd = env::current_dir()?;
    let workdir = cwd.join(".prebuilt-work").join(version);
    let stage = cwd.join(".prebuilt").join(version);

    // Clone repo
    let repo_dir = workdir.join("aztec-packages");
    if !repo_dir.exists() {
        println!("📦 Cloning aztec-packages@{}...", version);
        fs::create_dir_all(&workdir)?;
        run(Command::new("git")
            .args([
                "clone",
                "--depth",
                "1",
                "--branch",
                version,
                "https://github.com/AztecProtocol/aztec-packages.git",
                "aztec-packages",
            ])
            .current_dir(&workdir))?;
    }

    // Bootstrap noir
    let bootstrap = repo_dir.join("noir/bootstrap.sh");
    if !bootstrap.exists() {
        return Err("❌ noir/bootstrap.sh not found".into());
    }
    println!("🔧 Bootstrapping noir...");
    run(Command::new("bash").arg(bootstrap).current_dir(&repo_dir))?;

    // Build transpiler
    println!("🔨 Building avm-transpiler...");
    let transpiler_dir = repo_dir.join("avm-transpiler");
    run(Command::new("cargo").args(["build", "--release"]).current_dir(&transpiler_dir))?;
    let transpiler_bin = transpiler_dir.join("target/release/avm-transpiler");

    // Copy aztec-nargo script
    fs::create_dir_all(&stage)?;
    let nargo_script = repo_dir.join("aztec-nargo/compile_then_postprocess.sh");
    fs::copy(&nargo_script, stage.join("aztec-nargo"))?;
    fs::set_permissions(stage.join("aztec-nargo"), fs::Permissions::from_mode(0o755))?;

    // Patch grep -P
    {
        let aztec_nargo_path = stage.join("aztec-nargo");
        let original = fs::read_to_string(&aztec_nargo_path)?;
        let patched = original.replace(
            "grep -oP 'Saved contract artifact to: \\K.*'",
            "grep 'Saved contract artifact to:' | sed 's/.*Saved contract artifact to: //'",
        );
        fs::write(&aztec_nargo_path, patched)?;
        println!("🔧 Patched aztec-nargo script for macOS compatibility ✅");
    }

    // Download bb binary
    let platform = detect_platform()?;
    println!("📦 Downloading barretenberg bb binary...");
    let bb_url = format!(
        "https://github.com/{}/releases/download/{}/barretenberg-{}.tar.gz",
        REPO, version, platform
    );
    let bb_tmp = workdir.join("bb");
    let bb_tar = bb_tmp.join("bb.tar.gz");
    fs::create_dir_all(&bb_tmp)?;
    run(Command::new("curl")
        .args(["-L", "-o", bb_tar.to_str().unwrap(), &bb_url])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit()))?;
    run(Command::new("tar")
        .args(["-xzf", bb_tar.to_str().unwrap(), "-C", bb_tmp.to_str().unwrap()])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit()))?;

    // Collect files
    println!("📦 Collecting built files...");
    fs::copy(&transpiler_bin, stage.join("avm-transpiler"))?;
    fs::set_permissions(stage.join("avm-transpiler"), fs::Permissions::from_mode(0o755))?;

    let bb_from = {
        let direct = bb_tmp.join("bb");
        let nested = bb_tmp.join("bin/bb");
        if direct.exists() {
            direct
        } else if nested.exists() {
            nested
        } else {
            return Err("❌ Could not locate 'bb' binary after extraction.".into());
        }
    };
    fs::copy(bb_from, stage.join("bb"))?;
    fs::set_permissions(stage.join("bb"), fs::Permissions::from_mode(0o755))?;

    // Copy user nargo
    let user_nargo = dirs::home_dir()
        .ok_or("Could not find home dir")?
        .join(".nargo/bin/nargo");
    if !user_nargo.exists() {
        return Err("❌ ~/.nargo/bin/nargo not found.".into());
    }
    fs::copy(&user_nargo, stage.join("nargo"))?;
    fs::set_permissions(stage.join("nargo"), fs::Permissions::from_mode(0o755))?;

    // Compress result
    println!("📦 Compressing toolchain...");
    let platform = detect_platform()?; 
    let tar_path = cwd.join(format!("toolchain-{version}-{platform}.tar.gz"));
    run(Command::new("tar")
        .args(["-czf", tar_path.to_str().unwrap(), "-C", stage.to_str().unwrap(), "."])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit()))?;
    println!("✅ Done: {}", tar_path.display());
    println!("→ upload with: cargo run --bin upload-release -- {version}");
    
    // Clean
    fs::remove_dir_all(&workdir)?;
    println!("🧹 Removed temporary build directory.");
    Ok(())
}

fn run(cmd: &mut Command) -> Result<(), Box<dyn std::error::Error>> {
    let status = cmd.status()?;
    if !status.success() {
        return Err(format!("❌ Command failed: {:?}", cmd).into());
    }
    Ok(())
}
