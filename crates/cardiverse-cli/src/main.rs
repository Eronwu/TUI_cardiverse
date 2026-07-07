use std::fs;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use anyhow::{Context, Result};
use cardiverse_agent::{
    execute_agent_action, observe as observe_state, run_playtest, AgentPolicy, AgentProtocolIn,
    AgentProtocolOut,
};
use cardiverse_ai::{CompileMode, LlmConfig};
use cardiverse_core::{init_echo, new_game, BattleReplay, GamePhase};
use cardiverse_tui::{render_replay_text, run_tui, RunOptions};
use clap::{Parser, Subcommand, ValueEnum};
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
    /// Run automated playtest episodes and write reports.
    Observe(ObserveArgs),
    /// Expose a JSONL state/action protocol for external agents.
    Agent(AgentArgs),
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
    /// Let an AI observer drive the battle while humans watch the TUI.
    #[arg(long, value_enum)]
    observer: Option<PolicyArg>,
    /// Save replay JSON to this path. Defaults to the local data directory.
    #[arg(long)]
    save_replay: Option<PathBuf>,
}

#[derive(Debug, Parser)]
struct ObserveArgs {
    /// Playtest policy.
    #[arg(long, value_enum, default_value_t = PolicyArg::Rule)]
    policy: PolicyArg,
    /// Number of episodes to run.
    #[arg(long, default_value_t = 1)]
    episodes: u32,
    /// Output directory for replay, trace, metrics, and issue markdown.
    #[arg(long, default_value = ".terminal-cardiverse/playtests/latest")]
    out: PathBuf,
    /// Maximum agent steps per episode.
    #[arg(long, default_value_t = 40)]
    max_steps: u32,
}

#[derive(Debug, Parser)]
struct AgentArgs {
    /// Run the JSONL stdio protocol.
    #[arg(long)]
    stdio: bool,
    /// Use deterministic local card generation.
    #[arg(long)]
    no_ai: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
enum PolicyArg {
    Rule,
    Llm,
}

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::dotenv();
    let cli = Cli::parse();
    match cli.command.unwrap_or(Command::Play(PlayArgs {
        no_ai: false,
        observer: None,
        save_replay: None,
    })) {
        Command::Play(args) => play(args).await,
        Command::Observe(args) => observe(args).await,
        Command::Agent(args) => agent(args).await,
        Command::Replay { file } => replay(file),
        Command::Doctor => doctor(),
    }
}

async fn play(args: PlayArgs) -> Result<()> {
    let compile_mode = compile_mode(args.no_ai, args.observer.map(PolicyArg::into))?;
    let replay = run_tui(RunOptions {
        compile_mode,
        observer_policy: args.observer.map(PolicyArg::into),
    })
    .await?;
    let path = args.save_replay.unwrap_or_else(default_replay_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }
    fs::write(&path, replay.to_pretty_json()?)
        .with_context(|| format!("write replay {}", path.display()))?;
    println!("Replay saved to {}", path.display());
    Ok(())
}

async fn observe(args: ObserveArgs) -> Result<()> {
    let policy = AgentPolicy::from(args.policy);
    fs::create_dir_all(&args.out).with_context(|| format!("create {}", args.out.display()))?;

    for episode in 1..=args.episodes {
        let compile_mode = compile_mode(false, Some(policy))?;
        let artifacts = run_playtest(policy, compile_mode, args.max_steps).await;
        let dir = if args.episodes == 1 {
            args.out.clone()
        } else {
            args.out.join(format!("episode-{episode:03}"))
        };
        fs::create_dir_all(&dir).with_context(|| format!("create {}", dir.display()))?;
        write_artifacts(&dir, &artifacts)?;
        println!(
            "episode {episode}: winner={:?} turns={} steps={} out={}",
            artifacts.report.winner,
            artifacts.report.turns,
            artifacts.report.steps,
            dir.display()
        );
    }

    Ok(())
}

async fn agent(args: AgentArgs) -> Result<()> {
    if !args.stdio {
        anyhow::bail!("agent mode currently requires --stdio");
    }

    let compile_mode = compile_mode(args.no_ai, Some(AgentPolicy::Llm))?;
    let boss = init_echo();
    let mut state = new_game(&boss);
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    let mut lines = stdin.lock().lines();
    loop {
        write_protocol(
            &mut stdout,
            &AgentProtocolOut::State {
                state: state.clone(),
                legal_actions: observe_state(&state).legal_actions,
            },
        )?;

        if state.phase == GamePhase::GameOver {
            let report = cardiverse_agent::build_report(&state, &[], 0);
            write_protocol(&mut stdout, &AgentProtocolOut::GameOver { report })?;
            break;
        }

        let Some(line) = lines.next() else {
            break;
        };
        let line = line?;
        let input: AgentProtocolIn = serde_json::from_str(&line)
            .with_context(|| format!("parse agent input JSONL: {line}"))?;
        match input {
            AgentProtocolIn::Action { action, .. } => {
                match execute_agent_action(&mut state, action, &compile_mode).await {
                    Ok(events) => {
                        write_protocol(&mut stdout, &AgentProtocolOut::Events { events })?
                    }
                    Err(err) => write_protocol(
                        &mut stdout,
                        &AgentProtocolOut::Error {
                            message: err.to_string(),
                        },
                    )?,
                }
            }
        }

        if state.phase == GamePhase::GameOver {
            let report = cardiverse_agent::build_report(&state, &[], 0);
            write_protocol(&mut stdout, &AgentProtocolOut::GameOver { report })?;
            break;
        }
    }

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

fn compile_mode(no_ai: bool, policy: Option<AgentPolicy>) -> Result<CompileMode> {
    if no_ai || policy == Some(AgentPolicy::Rule) {
        return Ok(CompileMode::Stub);
    }
    match LlmConfig::from_env() {
        Some(config) => Ok(CompileMode::Llm(config)),
        None => {
            if policy == Some(AgentPolicy::Llm) {
                anyhow::bail!("LLM policy requires LLM_API_KEY or OPENAI_API_KEY in .env");
            }
            Ok(CompileMode::Stub)
        }
    }
}

fn write_artifacts(dir: &PathBuf, artifacts: &cardiverse_agent::PlaytestArtifacts) -> Result<()> {
    fs::write(dir.join("replay.json"), artifacts.replay.to_pretty_json()?)?;
    let trace = artifacts
        .trace
        .iter()
        .map(serde_json::to_string)
        .collect::<Result<Vec<_>, _>>()?
        .join("\n");
    fs::write(dir.join("trace.jsonl"), format!("{trace}\n"))?;
    fs::write(
        dir.join("metrics.json"),
        serde_json::to_string_pretty(&artifacts.report)?,
    )?;
    fs::write(dir.join("issue.md"), &artifacts.issue_markdown)?;
    Ok(())
}

fn write_protocol(stdout: &mut io::Stdout, message: &AgentProtocolOut) -> Result<()> {
    writeln!(stdout, "{}", serde_json::to_string(message)?)?;
    stdout.flush()?;
    Ok(())
}

impl From<PolicyArg> for AgentPolicy {
    fn from(value: PolicyArg) -> Self {
        match value {
            PolicyArg::Rule => Self::Rule,
            PolicyArg::Llm => Self::Llm,
        }
    }
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
