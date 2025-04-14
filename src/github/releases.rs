use reqwest::blocking::Client;
use serde::Deserialize;
use inquire::Select;

#[derive(Debug, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String
}

pub fn fetch_compiler_versions() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let url = "https://api.github.com/repos/AztecProtocol/aztec-packages/releases";
    let client = Client::new();

    let res = client
        .get(url)
        .header("User-Agent", "aztec-contract-verifier")
        .send()?
        .error_for_status()?;

    let releases: Vec<GithubRelease> = res.json()?;
    let mut versions = Vec::new();

    for release in releases {
        versions.push(release.tag_name);
    }

    if versions.is_empty() {
        return Err("❌ No compiler versions found.".into());
    }

    Ok(versions)
}


pub fn prompt_select_version(versions: Vec<String>) -> Result<String, Box<dyn std::error::Error>> {
    let selection = Select::new("Select a compiler version:", versions)
        .prompt()?;

    Ok(selection)
}
