mod args;

use args::CliArgs;
use clap::Parser;

fn main() {
    let args = CliArgs::parse();
    println!("🔧 Aztec Contract Verifier CLI");
    println!("{:#?}", args);
}
