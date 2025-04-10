use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use reqwest::blocking::get;
use zip::ZipArchive;
use dirs;

pub fn download_and_extract_source(version: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let url = format!(
        "https://github.com/AztecProtocol/aztec-packages/archive/refs/tags/{}.zip",
        version
    );

    let response = get(&url)?.error_for_status()?;
    let mut archive = ZipArchive::new(Cursor::new(response.bytes()?))?;

    let extract_dir = dirs::home_dir()
        .expect("Cannot find home dir")
        .join(".aztec-verifier/source")
        .join(version);

    if extract_dir.exists() {
        return Ok(extract_dir);
    }

    fs::create_dir_all(&extract_dir)?;
    archive.extract(&extract_dir)?;
    let first_dir = fs::read_dir(&extract_dir)?
        .filter_map(Result::ok)
        .filter(|e| e.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
        .next()
        .ok_or("No directory found after extracting zip")?
        .path();

    Ok(first_dir)
}
