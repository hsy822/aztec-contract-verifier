use clap::Parser;

/// Aztec contract verifier CLI
#[derive(Parser, Debug)]
#[command(name = "aztec-verify")]
#[command(version = "0.1")]
#[command(about = "Verify Noir source or artifact against deployed Aztec contract", long_about = None)]
pub struct CliArgs {
    /// Path to Noir source file (e.g. ./contracts/counter.nr)
    #[arg(long, required_unless_present = "artifact")]
    pub source: Option<String>,

    /// Path to contract.json artifact
    #[arg(long, required_unless_present = "source")]
    pub artifact: Option<String>,

    /// Address of the deployed contract on Aztec
    #[arg(long)]
    pub address: String,

    /// PXE endpoint URL
    #[arg(long, default_value = "http://localhost:8080")]
    pub pxe: String,

    /// aztec-nargo compiler version (e.g. 0.84.1)
    #[arg(long)]
    pub compiler_version: Option<String>,

    /// Output result as JSON
    #[arg(long, default_value_t = false)]
    pub output: bool,
}
