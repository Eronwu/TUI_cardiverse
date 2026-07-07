use std::io::{self, Stdout};
use std::time::{Duration, Instant};

use anyhow::Result;
use cardiverse_ai::{compile_card, suggest_turn, CompileMode};
use cardiverse_core::{
    apply_action, best_effort_action, init_echo, new_game, BattleReplay, GamePhase, GameState,
    PlayerAction,
};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;

use crate::render::render_app;

pub struct RunOptions {
    pub compile_mode: CompileMode,
}

pub struct App {
    pub state: GameState,
    pub compile_mode: CompileMode,
    pub mode: ScreenMode,
    pub input: String,
    pub selected_cache: usize,
    pub status: String,
    pub ai_suggestion: String,
    pub loading: Option<LoadingState>,
    pub should_quit: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScreenMode {
    Battle,
    Forging,
    Help,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadingState {
    pub label: String,
    pub started_at: Instant,
    pub tick: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UiCommand {
    OpenForge,
    SubmitForge,
    Cancel,
    Backspace,
    MoveLeft,
    MoveRight,
    Activate,
    CacheDraft,
    RewriteDraft,
    DiscardDraft,
    EndTurn,
    Suggest,
    AutoTurn,
    Help,
    Quit,
    None,
}

impl App {
    pub fn new(compile_mode: CompileMode) -> Self {
        let boss = init_echo();
        Self {
            state: new_game(&boss),
            compile_mode,
            mode: ScreenMode::Battle,
            input: String::new(),
            selected_cache: 0,
            status: "F forge | Enter play/use | C cache | E end | A suggest | G auto | Q quit"
                .into(),
            ai_suggestion: "Forge a concise exploit or ask AI for a route.".into(),
            loading: None,
            should_quit: false,
        }
    }
}

pub async fn run_tui(options: RunOptions) -> Result<BattleReplay> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    let mut app = App::new(options.compile_mode);

    let result = run_loop(&mut terminal, &mut app).await;

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    result?;
    Ok(BattleReplay::new(
        app.state.boss_id.clone(),
        app.state.events.clone(),
    ))
}

async fn run_loop(terminal: &mut Terminal<CrosstermBackend<Stdout>>, app: &mut App) -> Result<()> {
    loop {
        terminal.draw(|frame| render_app(frame, app))?;
        if app.should_quit {
            break;
        }
        if event::poll(Duration::from_millis(80))? {
            if let Event::Key(key) = event::read()? {
                handle_key(terminal, app, key).await?;
            }
        }
    }
    Ok(())
}

async fn handle_key(
    terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    app: &mut App,
    key: KeyEvent,
) -> Result<()> {
    if app.mode == ScreenMode::Forging {
        match key_to_command(key) {
            UiCommand::Activate | UiCommand::SubmitForge => {
                let prompt = app.input.trim().to_string();
                app.input.clear();
                app.mode = ScreenMode::Battle;
                if !prompt.is_empty() {
                    compile_with_loading(terminal, app, prompt).await?;
                }
            }
            UiCommand::Cancel => {
                app.input.clear();
                app.mode = ScreenMode::Battle;
                app.status = "Forge cancelled.".into();
            }
            UiCommand::Backspace => {
                app.input.pop();
            }
            _ => {
                if let KeyCode::Char(ch) = key.code {
                    if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT {
                        app.input.push(ch);
                    }
                }
            }
        }
        return Ok(());
    }

    match key_to_command(key) {
        UiCommand::OpenForge => {
            app.mode = ScreenMode::Forging;
            app.input.clear();
            app.status = "Describe the exploit. Enter submits, Esc cancels.".into();
        }
        UiCommand::MoveLeft => {
            app.selected_cache = app.selected_cache.saturating_sub(1);
        }
        UiCommand::MoveRight => {
            let max = app.state.player_memory.cache.len().saturating_sub(1);
            app.selected_cache = (app.selected_cache + 1).min(max);
        }
        UiCommand::Activate => activate_selection(app),
        UiCommand::CacheDraft => dispatch(app, PlayerAction::CacheDraft),
        UiCommand::RewriteDraft => {
            app.mode = ScreenMode::Forging;
            app.input = app
                .state
                .draft
                .as_ref()
                .and_then(|card| card.source_prompt.clone())
                .unwrap_or_default();
        }
        UiCommand::DiscardDraft => dispatch(app, PlayerAction::DiscardDraft),
        UiCommand::EndTurn => dispatch(app, PlayerAction::EndTurn),
        UiCommand::Suggest => {
            app.ai_suggestion = suggest_turn(&app.state);
            app.status = "AI suggestion refreshed. It cannot mutate game state.".into();
        }
        UiCommand::AutoTurn => run_auto_turn(app),
        UiCommand::Help => {
            app.mode = if app.mode == ScreenMode::Help {
                ScreenMode::Battle
            } else {
                ScreenMode::Help
            };
        }
        UiCommand::Quit => app.should_quit = true,
        UiCommand::Cancel => app.mode = ScreenMode::Battle,
        UiCommand::None | UiCommand::SubmitForge | UiCommand::Backspace => {}
    }
    Ok(())
}

pub fn key_to_command(key: KeyEvent) -> UiCommand {
    match key.code {
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => UiCommand::Quit,
        KeyCode::Char('q') | KeyCode::Char('Q') => UiCommand::Quit,
        KeyCode::Char('?') => UiCommand::Help,
        KeyCode::Esc => UiCommand::Cancel,
        KeyCode::Backspace => UiCommand::Backspace,
        KeyCode::Enter => UiCommand::Activate,
        KeyCode::Left | KeyCode::Up => UiCommand::MoveLeft,
        KeyCode::Right | KeyCode::Down => UiCommand::MoveRight,
        KeyCode::Char('f') | KeyCode::Char('F') => UiCommand::OpenForge,
        KeyCode::Char('c') | KeyCode::Char('C') => UiCommand::CacheDraft,
        KeyCode::Char('r') | KeyCode::Char('R') => UiCommand::RewriteDraft,
        KeyCode::Char('x') | KeyCode::Char('X') => UiCommand::DiscardDraft,
        KeyCode::Char('e') | KeyCode::Char('E') => UiCommand::EndTurn,
        KeyCode::Char('a') | KeyCode::Char('A') => UiCommand::Suggest,
        KeyCode::Char('g') | KeyCode::Char('G') => UiCommand::AutoTurn,
        KeyCode::Char(' ') => UiCommand::Activate,
        _ => UiCommand::None,
    }
}

async fn compile_with_loading(
    terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    app: &mut App,
    prompt: String,
) -> Result<()> {
    let started_at = Instant::now();
    app.loading = Some(LoadingState {
        label: "AI compiler".into(),
        started_at,
        tick: 0,
    });
    app.status = "Compiling draft card...".into();

    let compile_mode = app.compile_mode.clone();
    let prompt_for_call = prompt.clone();
    let mut future = Box::pin(async move { compile_card(&compile_mode, &prompt_for_call).await });
    let mut interval = tokio::time::interval(Duration::from_millis(120));
    let result = loop {
        tokio::select! {
            result = &mut future => break result,
            _ = interval.tick() => {
                if let Some(loading) = &mut app.loading {
                    loading.tick = loading.tick.wrapping_add(1);
                }
                terminal.draw(|frame| render_app(frame, app))?;
            }
        }
    };

    app.loading = None;
    match result {
        Ok(card) => {
            dispatch(app, PlayerAction::ForgeDraft { prompt, card });
            app.status = "Draft ready. Enter uses it now, C caches it, R rewrites.".into();
        }
        Err(err) => {
            app.status = format!("Compiler failed: {err}");
        }
    }
    Ok(())
}

fn activate_selection(app: &mut App) {
    if app.state.draft.is_some() {
        dispatch(app, PlayerAction::UseDraft);
        return;
    }
    if app.state.player_memory.cache.is_empty() {
        app.status = "Cache is empty. Press F to forge.".into();
        return;
    }
    let index = app
        .selected_cache
        .min(app.state.player_memory.cache.len() - 1);
    let kind = app.state.player_memory.cache[index].kind;
    let action = match kind {
        cardiverse_core::CardKind::Attack => PlayerAction::PlayCache { index },
        cardiverse_core::CardKind::Daemon => PlayerAction::MountDaemon { index },
        cardiverse_core::CardKind::Kernel => PlayerAction::ArmKernel { index },
    };
    dispatch(app, action);
}

fn run_auto_turn(app: &mut App) {
    let mut steps = 0;
    while app.state.phase == GamePhase::PlayerTurn && steps < 3 {
        let Some(action) = best_effort_action(&app.state) else {
            break;
        };
        let is_end = matches!(action, PlayerAction::EndTurn);
        dispatch(app, action);
        steps += 1;
        if is_end {
            break;
        }
    }
    app.status = format!("AI auto-turn executed {steps} legal step(s).");
}

fn dispatch(app: &mut App, action: PlayerAction) {
    match apply_action(&mut app.state, action) {
        Ok(events) => {
            if let Some(event) = events.last() {
                app.status = short_event(event);
            }
            if !app.state.player_memory.cache.is_empty() {
                app.selected_cache = app
                    .selected_cache
                    .min(app.state.player_memory.cache.len() - 1);
            } else {
                app.selected_cache = 0;
            }
        }
        Err(err) => app.status = err.to_string(),
    }
}

fn short_event(event: &cardiverse_core::GameEvent) -> String {
    match event {
        cardiverse_core::GameEvent::DraftForged { card, .. } => {
            format!("Draft forged: {} ({} RAM)", card.name, card.cost)
        }
        cardiverse_core::GameEvent::CardPlayed { card_name, .. } => {
            format!("Executed {card_name}.")
        }
        cardiverse_core::GameEvent::CardCached { card_name, .. } => {
            format!("Cached {card_name}.")
        }
        cardiverse_core::GameEvent::Winner { winner, reason, .. } => {
            format!("{winner:?} wins: {reason}")
        }
        _ => "State advanced.".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

    #[test]
    fn maps_primary_hotkeys() {
        assert_eq!(key_to_command(key('f')), UiCommand::OpenForge);
        assert_eq!(key_to_command(key('a')), UiCommand::Suggest);
        assert_eq!(key_to_command(key('g')), UiCommand::AutoTurn);
        assert_eq!(key_to_command(key('q')), UiCommand::Quit);
    }

    #[test]
    fn enter_is_submit_for_input_and_activate_for_battle_loop() {
        assert_eq!(
            key_to_command(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE)),
            UiCommand::Activate
        );
    }

    fn key(ch: char) -> KeyEvent {
        KeyEvent::new(KeyCode::Char(ch), KeyModifiers::NONE)
    }
}
