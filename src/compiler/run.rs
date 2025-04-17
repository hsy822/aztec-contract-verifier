use std::{
    io::{BufRead, BufReader},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use indicatif::{ProgressBar, ProgressStyle};
use std::path::Path;

pub fn run_aztec_nargo(
    tc_root: &Path,
    aztec_nargo: &Path,
    nargo: &Path,
    transpiler: &Path,
    bb: &Path,
    source_dir: &Path,
) -> anyhow::Result<()> {
    println!("🚀  Compiling with downloaded toolchain…");
    println!("    • toolchain: {}", tc_root.display());
    println!("    • project  : {}\n", source_dir.display());

    let mut child = Command::new(aztec_nargo)
        .arg("compile")
        .env("NARGO",      nargo)
        .env("TRANSPILER", transpiler)
        .env("BB",         bb)
        .current_dir(source_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let spinner = ProgressBar::new_spinner()
        .with_style(
            ProgressStyle::with_template("{spinner} {elapsed_precise} Generating verification keys…")
                .unwrap()
                .tick_chars("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"),
        );
    spinner.enable_steady_tick(Duration::from_millis(120));

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let s1 = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            println!("{line}");
        }
    });
    let s2 = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            eprintln!("{line}");
        }
    });

    let status = child.wait()?;
    spinner.finish_and_clear();
    s1.join().ok();
    s2.join().ok();

    anyhow::ensure!(status.success(), "aztec‑nargo compile failed");
    println!("✅ Compilation succeeded in {:?}", Instant::now().elapsed());
    Ok(())
}
