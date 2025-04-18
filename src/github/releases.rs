use inquire::Select;
use reqwest::blocking::Client;
use serde::Deserialize;

use crate::util::platform::detect_platform;

const REPO: &str = "hsy822/aztec-contract-verifier";

#[derive(Debug, Deserialize)]
struct Asset {
    name: String,
}
#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

pub fn fetch_prebuilt_versions() -> anyhow::Result<Vec<String>> {
    let url = format!("https://api.github.com/repos/{}/releases", REPO);
    let client = Client::new();
    let releases: Vec<Release> = client
        .get(url)
        .header("User-Agent", "aztec-verifier")
        .send()?
        .error_for_status()?
        .json()?;

    let mut tags = vec![];
    let platform = detect_platform()?;
    for r in releases {
        let expected = format!("toolchain-{}-{}.tar.gz", r.tag_name, platform);
        if r.assets.iter().any(|a| a.name == expected) {
            tags.push(r.tag_name);
        }
    }
    if tags.is_empty() {
        anyhow::bail!("❌ No prebuilt toolchains found in {}", REPO);
    }
    Ok(tags)
}

pub fn prompt_select_version(versions: Vec<String>) -> anyhow::Result<String> {
    Ok(Select::new("Select toolchain version:", versions).prompt()?)
}
