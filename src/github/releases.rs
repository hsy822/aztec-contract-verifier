use reqwest::blocking::Client;
use serde::Deserialize;
use inquire::Select;

#[derive(Debug, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
}

pub fn fetch_compiler_versions() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let platform = detect_platform()?;
    let url = "https://api.github.com/repos/AztecProtocol/aztec-packages/releases";
    let client = Client::new();

    let res = client
        .get(url)
        .header("User-Agent", "aztec-contract-verifier")
        .send()?
        .error_for_status()?;

    let releases: Vec<GithubRelease> = res.json()?;
    let mut versions = vec![];

    for release in releases {
        let tag = &release.tag_name;
        let bb_url = format!(
            "https://github.com/AztecProtocol/aztec-packages/releases/download/{}/barretenberg-{}.tar.gz",
            tag, platform
        );
        let head = client.head(&bb_url).send();
        if let Ok(r) = head {
            if r.status().is_success() {
                versions.push(tag.clone());
            }
        }
    }

    if versions.is_empty() {
        return Err("❌ No supported versions with bb binary found.".into());
    }

    Ok(versions)
}

pub fn prompt_select_version(versions: Vec<String>) -> Result<String, Box<dyn std::error::Error>> {
    let selection = Select::new("Select a compiler version:", versions).prompt()?;
    Ok(selection)
}

fn detect_platform() -> Result<&'static str, Box<dyn std::error::Error>> {
    if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        Ok("arm64-darwin")
    } else if cfg!(target_os = "macos") {
        Ok("amd64-darwin")
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
        Ok("arm64-linux")
    } else if cfg!(target_os = "linux") {
        Ok("amd64-linux")
    } else {
        Err("❌ Unsupported OS or architecture".into())
    }
}
