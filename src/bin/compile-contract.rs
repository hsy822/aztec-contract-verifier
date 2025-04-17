use std::{env, fs, process::Command};
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let contract_dir = args.get(1).expect("❗ Please provide contract path");

    let version = get_latest_prebuilt_version()?;
    let base_path = format!(".prebuilt/{}", version);

    let aztec_nargo = fs::canonicalize(format!("{}/aztec-nargo", base_path))?;
    let transpiler = fs::canonicalize(format!("{}/avm-transpiler", base_path))?;
    let nargo = fs::canonicalize(format!("{}/nargo", base_path))?;
    let bb = fs::canonicalize(format!("{}/bb", base_path))?;
    

    let status = Command::new("bash")
        .arg("-c")
        .arg(format!(
            "NARGO={} TRANSPILER={} BB={} bash {} compile",
            nargo.display(),
            transpiler.display(),
            bb.display(),
            aztec_nargo.display(),
        ))
        .current_dir(contract_dir)
        .status()?;

    if !status.success() {
        return Err("❌ Failed to compile contract".into());
    }

    println!("✅ Compilation completed!");
    Ok(())
}

fn get_latest_prebuilt_version() -> Result<String, Box<dyn std::error::Error>> {
    let dir = PathBuf::from(".prebuilt");
    let mut versions: Vec<_> = fs::read_dir(&dir)?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_type = entry.file_type().ok()?;
            if file_type.is_dir() {
                Some(entry.file_name().into_string().ok()?)
            } else {
                None
            }
        })
        .collect();

    if versions.is_empty() {
        return Err("❌ No prebuilt versions found".into());
    }

    versions.sort();
    Ok(versions.pop().unwrap())
}
