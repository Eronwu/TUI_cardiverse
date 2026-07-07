use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use cardiverse_ai::{CompileMode, LlmConfig};
use cardiverse_core::BattleReplay;
use cardiverse_tui::{render_replay_text, run_tui, RunOptions};
use clap::{Parser, Subcommand};
use directories::ProjectDirs;

#[derive(Debug, Parser)]
#[command(name = "cardiverse")]
#[command(about = "Terminal Cardiverse: an AI-native terminal card battle.")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Start the battle cockpit.
    Play(PlayArgs),
    /// Render a saved replay file.
    Replay { file: PathBuf },
    /// Check terminal and LLM configuration.
    Doctor,
}

#[derive(Debug, Parser)]
struct PlayArgs {
    /// Use deterministic local card generation.
    #[arg(long)]
    no_ai: bool,
    /// Save replay JSON to this path. Defaults to the local data directory.
    #[arg(long)]
    save_replay: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::dotenv();
    let cli = Cli::parse();
    match cli.command.unwrap_or(Command::Play(PlayArgs {
        no_ai: false,
        save_replay: None,
    })) {
        Command::Play(args) => play(args).await,
        Command::Replay { file } => replay(file),
        Command::Doctor => doctor(),
    }
}

async fn play(args: PlayArgs) -> Result<()> {
    let compile_mode = if args.no_ai {
        CompileMode::Stub
    } else {
        LlmConfig::from_env()
            .map(CompileMode::Llm)
            .unwrap_or(CompileMode::Stub)
    };
    let replay = run_tui(RunOptions { compile_mode }).await?;
    let path = args.save_replay.unwrap_or_else(default_replay_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }
    fs::write(&path, replay.to_pretty_json()?)
        .with_context(|| format!("write replay {}", path.display()))?;
    println!("Replay saved to {}", path.display());
    Ok(())
}

fn replay(file: PathBuf) -> Result<()> {
    let input = fs::read_to_string(&file).with_context(|| format!("read {}", file.display()))?;
    let replay =
        BattleReplay::from_json(&input).with_context(|| format!("parse {}", file.display()))?;
    println!("{}", render_replay_text(&replay));
    Ok(())
}

fn doctor() -> Result<()> {
    println!("Terminal Cardiverse doctor");
    println!("terminal size: {}", terminal_size_label());
    match LlmConfig::from_env() {
        Some(config) => {
            println!("LLM_API_BASE_URL: {}", config.base_url);
            println!("LLM_MODEL_NAME: {}", config.model);
            println!("LLM_API_KEY: present");
            println!("LLM_API_STYLE: {:?}", config.style);
        }
        None => {
            println!("LLM_API_KEY: missing");
            println!("AI card generation will use the deterministic local stub.");
        }
    }
    println!("replay path: {}", default_replay_path().display());
    Ok(())
}

fn terminal_size_label() -> String {
    match crossterm::terminal::size() {
        Ok((width, height)) => format!("{width}x{height}"),
        Err(_) => "unknown".into(),
    }
}

fn default_replay_path() -> PathBuf {
    if let Some(project_dirs) = ProjectDirs::from("dev", "terminal-cardiverse", "cardiverse") {
        return project_dirs.data_local_dir().join("last-replay.json");
    }
    PathBuf::from(".terminal-cardiverse/replays/last-replay.json")
}
