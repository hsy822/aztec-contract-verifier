use anyhow::Result;

pub fn detect_platform() -> Result<&'static str> {
    if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        Ok("arm64-darwin")
    } else if cfg!(target_os = "macos") {
        Ok("amd64-darwin")
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
        Ok("arm64-linux")
    } else if cfg!(target_os = "linux") {
        Ok("amd64-linux")
    } else {
        anyhow::bail!("unsupported OS / arch")
    }
}