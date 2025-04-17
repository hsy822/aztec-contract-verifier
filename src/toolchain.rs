use std::{
    fs,
    path::PathBuf,
    process::{Command, Stdio},
};

pub struct ToolchainPaths {
    pub root:        PathBuf,
    pub aztec_nargo: PathBuf,
    pub nargo:       PathBuf,
    pub transpiler:  PathBuf,
    pub bb:          PathBuf,
}

pub fn prepare_toolchain(tag: &str) -> anyhow::Result<ToolchainPaths> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("no home dir"))?;
    let root = home.join(".aztec-verifier").join("prebuilt").join(tag);

    if !root.join("aztec-nargo").exists() {
        fs::create_dir_all(&root)?;

        let tar = root.join("toolchain.tar.gz");
        let url = format!(
            "https://github.com/hsy822/aztec-contract-verifier/releases/download/{0}/toolchain-{0}.tar.gz",
            tag
        );
        println!("⬇️  downloading {}", url);

        let mut curl = Command::new("curl");
        curl.args(["-L", "-o", tar.to_str().unwrap(), &url]);
        if let Ok(tok) = std::env::var("GITHUB_TOKEN") {
            curl.args(["-H", &format!("Authorization: token {}", tok)]);
        }
        run(&mut curl)?;
        run(Command::new("tar")
            .args(["-xzf", tar.to_str().unwrap(), "-C", root.to_str().unwrap()]))?;
        fs::remove_file(tar)?;
    }

    macro_rules! must { ($p:expr) => { if !$p.exists() {
        anyhow::bail!("missing file in toolchain: {}", $p.display())
    }} }

    let aztec_nargo = root.join("aztec-nargo");
    let nargo       = root.join("nargo");
    let transpiler  = root.join("avm-transpiler");
    let bb          = root.join("bb");
    must!(&aztec_nargo); must!(&nargo); must!(&transpiler); must!(&bb);

    Ok(ToolchainPaths { root, aztec_nargo, nargo, transpiler, bb })
}

fn run(cmd: &mut Command) -> anyhow::Result<()> {
    let ok = cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit()).status()?.success();
    anyhow::ensure!(ok, "cmd failed: {:?}", cmd);
    Ok(())
}
