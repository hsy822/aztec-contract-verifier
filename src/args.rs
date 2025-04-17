use clap::Parser;

/// Aztec contract verifier CLI
#[derive(Parser, Debug)]
#[command(name = "aztec-verify")]
#[command(version = "0.1")]
#[command(about = "Verify Noir source or artifact against deployed Aztec contract", long_about = None)]

pub struct CliArgs {
    #[arg(long)]
    pub source: String,

    #[arg(long)]
    pub address: String,

    #[arg(long)]
    pub network: String,
}