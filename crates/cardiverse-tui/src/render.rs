use cardiverse_core::{ActorId, CardKind, CompiledCard, Effect, GameEvent, GamePhase, Track};
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Margin, Rect};
use ratatui::prelude::{Color, Frame, Line, Modifier, Span, Style};
use ratatui::widgets::{Block, BorderType, Borders, Clear, Gauge, List, ListItem, Paragraph, Wrap};

use crate::app::{App, ScreenMode};

pub fn render_app(frame: &mut Frame, app: &App) {
    let area = frame.area();
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(11),
            Constraint::Min(13),
            Constraint::Length(9),
        ])
        .split(area);

    render_boss_stage(frame, app, rows[0]);
    render_battle_focus(frame, app, rows[1]);
    render_hand_and_console(frame, app, rows[2]);

    if app.mode == ScreenMode::Forging {
        render_forge_modal(frame, app, centered_rect(74, 42, area));
    } else if app.mode == ScreenMode::Help {
        render_help(frame, centered_rect(74, 58, area));
    }
}

fn render_boss_stage(frame: &mut Frame, app: &App, area: Rect) {
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(54),
            Constraint::Percentage(23),
            Constraint::Percentage(23),
        ])
        .split(area);

    let block = stage_block("INIT ECHO // BOOT-SECTOR ORACLE", Color::LightCyan);
    let inner = block.inner(columns[0]);
    frame.render_widget(block, columns[0]);

    let mut lines = vec![
        Line::from(Span::styled(
            format!(
                "TURN {:02}  //  {}",
                app.state.turn,
                phase_label(app.state.phase)
            ),
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
    ];
    lines.extend(boss_art().into_iter().map(Line::from));
    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        latest_boss_line(app),
        Style::default().fg(Color::LightMagenta),
    )));
    frame.render_widget(
        Paragraph::new(lines)
            .alignment(Alignment::Center)
            .wrap(Wrap { trim: true }),
        inner,
    );

    render_actor_panel(frame, "OPERATOR", ActorId::Player, app, columns[1]);
    render_actor_panel(frame, "TARGET", ActorId::Boss, app, columns[2]);
}

fn render_battle_focus(frame: &mut Frame, app: &App, area: Rect) {
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(63), Constraint::Percentage(37)])
        .split(area);

    render_feature_card(frame, app, columns[0]);
    render_subtitle_log(frame, app, columns[1]);
}

fn render_hand_and_console(frame: &mut Frame, app: &App, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(4)])
        .split(area);
    render_hand_track(frame, app, rows[0]);
    render_command_console(frame, app, rows[1]);
}

fn render_actor_panel(frame: &mut Frame, title: &str, actor: ActorId, app: &App, area: Rect) {
    let state = match actor {
        ActorId::Player => &app.state.player,
        ActorId::Boss => &app.state.boss,
    };
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Length(2),
            Constraint::Length(2),
            Constraint::Min(2),
        ])
        .split(area.inner(Margin {
            vertical: 1,
            horizontal: 1,
        }));
    frame.render_widget(stage_block(title, actor_color(actor)), area);
    frame.render_widget(gauge("HP", state.hp, state.max_hp, Color::Red), rows[0]);
    frame.render_widget(
        gauge("SAN", state.sanity, state.max_sanity, Color::Magenta),
        rows[1],
    );
    frame.render_widget(
        gauge("RAM", state.ram, state.max_ram, Color::LightCyan),
        rows[2],
    );

    let shield = format!(
        "SHIELD hp:{} sanity:{}",
        state.hp_shield, state.sanity_shield
    );
    frame.render_widget(
        Paragraph::new(shield)
            .style(Style::default().fg(Color::DarkGray))
            .alignment(Alignment::Center),
        rows[3],
    );
}

fn render_feature_card(frame: &mut Frame, app: &App, area: Rect) {
    let block = stage_block(feature_title(app), feature_color(app));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let lines = if let Some(loading) = &app.loading {
        let frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
        let elapsed = loading.started_at.elapsed().as_secs_f32();
        vec![
            Line::from(Span::styled(
                format!(
                    "{} {} // {:.1}s",
                    frames[loading.tick % frames.len()],
                    loading.label.to_uppercase(),
                    elapsed
                ),
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from("intent -> provider JSON -> normalizer -> local validator -> draft"),
            Line::from(""),
            Line::from(Span::styled(
                "The compiler is thinking. No battle state can change until validation passes.",
                Style::default().fg(Color::LightCyan),
            )),
        ]
    } else if let Some(card) = app.state.draft.as_ref().or_else(|| selected_cache(app)) {
        card_stage_lines(card, app.state.draft.is_some())
    } else {
        vec![
            Line::from(Span::styled(
                "NO ACTIVE CARD",
                Style::default()
                    .fg(Color::DarkGray)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from("Press F to forge a shell spell, exploit, daemon, or kernel trap."),
            Line::from("The model can suggest a card. The local engine decides legality."),
        ]
    };

    frame.render_widget(
        Paragraph::new(lines)
            .alignment(Alignment::Center)
            .wrap(Wrap { trim: true }),
        inner,
    );
}

fn render_subtitle_log(frame: &mut Frame, app: &App, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(63), Constraint::Percentage(37)])
        .split(area);

    let subtitles: Vec<ListItem> = app
        .state
        .events
        .iter()
        .rev()
        .take(8)
        .map(|event| {
            ListItem::new(event_line(event)).style(match event {
                GameEvent::Winner { .. } => Style::default().fg(Color::Yellow),
                GameEvent::CardPlayed { actor, .. } if *actor == ActorId::Boss => {
                    Style::default().fg(Color::LightRed)
                }
                GameEvent::CardPlayed { .. } => Style::default().fg(Color::LightGreen),
                GameEvent::EffectApplied { .. } => Style::default().fg(Color::LightCyan),
                _ => Style::default().fg(Color::Gray),
            })
        })
        .collect();

    frame.render_widget(
        List::new(subtitles).block(stage_block("SUBTITLE STREAM", Color::Gray)),
        rows[0],
    );
    frame.render_widget(
        Paragraph::new(app.ai_suggestion.clone())
            .block(stage_block("AI ADVISOR", Color::LightMagenta))
            .wrap(Wrap { trim: true }),
        rows[1],
    );
}

fn render_hand_track(frame: &mut Frame, app: &App, area: Rect) {
    let block = stage_block("CACHE TRACK // SELECT WITH ARROWS", Color::LightCyan);
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let slots = if app.state.player_memory.cache.is_empty() {
        vec![Line::from(Span::styled(
            "[ empty cache ]",
            Style::default().fg(Color::DarkGray),
        ))]
    } else {
        vec![Line::from(
            app.state
                .player_memory
                .cache
                .iter()
                .enumerate()
                .map(|(index, card)| {
                    let selected = index == app.selected_cache;
                    let marker = if selected { "▶" } else { " " };
                    let style = if selected {
                        Style::default()
                            .fg(Color::Black)
                            .bg(Color::LightCyan)
                            .add_modifier(Modifier::BOLD)
                    } else {
                        Style::default().fg(kind_color(card.kind))
                    };
                    Span::styled(
                        format!(
                            " {marker}[{}] {}:{}RAM:{} ",
                            index + 1,
                            short_name(&card.name, 18),
                            card.cost,
                            kind_short(card.kind),
                        ),
                        style,
                    )
                })
                .collect::<Vec<_>>(),
        )]
    };

    frame.render_widget(
        Paragraph::new(slots)
            .alignment(Alignment::Center)
            .wrap(Wrap { trim: true }),
        inner,
    );
}

fn render_command_console(frame: &mut Frame, app: &App, area: Rect) {
    let status_style = if app.state.phase == GamePhase::GameOver {
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::LightGreen)
    };
    let memory = format!(
        "DAEMON [{}]   KERNEL [{}]",
        daemon_label(app),
        kernel_label(app)
    );
    let lines = vec![
        Line::from(Span::styled(app.status.clone(), status_style)),
        Line::from(Span::styled(memory, Style::default().fg(Color::Gray))),
        Line::from("F forge  Enter/Space execute  C cache  R rewrite  X discard  E end  A advise  G auto  ? help  Q quit"),
    ];
    frame.render_widget(
        Paragraph::new(lines)
            .block(stage_block("COMMAND LINE", Color::LightGreen))
            .wrap(Wrap { trim: true }),
        area,
    );
}

fn render_forge_modal(frame: &mut Frame, app: &App, area: Rect) {
    frame.render_widget(Clear, area);
    let lines = vec![
        Line::from(Span::styled(
            "FORGE INTENT",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            format!("> {}", app.input),
            Style::default().fg(Color::LightCyan),
        )),
        Line::from(""),
        Line::from("Enter compile  //  Esc cancel"),
    ];
    frame.render_widget(
        Paragraph::new(lines)
            .block(stage_block("PROMPT COMPILER", Color::Yellow))
            .alignment(Alignment::Left)
            .wrap(Wrap { trim: false }),
        area,
    );
}

fn render_help(frame: &mut Frame, area: Rect) {
    frame.render_widget(Clear, area);
    let lines = vec![
        Line::from("Terminal Cardiverse UI v2 is a battle stage, not a command prompt."),
        Line::from(
            "F forges an AI draft. The card stays in draft until you execute, cache, or discard.",
        ),
        Line::from(
            "Enter/Space executes the draft first; otherwise it executes the selected cache slot.",
        ),
        Line::from("Arrows move across the cache track. C/R/X manage the current draft."),
        Line::from("A asks for a legal suggestion. G lets the rule-bound AI play legal actions."),
        Line::from("Replay files are deterministic and do not re-call the LLM."),
        Line::from("Esc closes this panel."),
    ];
    frame.render_widget(
        Paragraph::new(lines)
            .block(stage_block("HELP", Color::LightMagenta))
            .wrap(Wrap { trim: true }),
        area,
    );
}

fn card_stage_lines(card: &CompiledCard, is_draft: bool) -> Vec<Line<'static>> {
    let mut lines = vec![
        Line::from(Span::styled(
            format!("╭─ {} ─╮", card.name),
            Style::default()
                .fg(kind_color(card.kind))
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            format!("{} // {} RAM", kind_label(card.kind), card.cost),
            Style::default().fg(Color::Yellow),
        )),
        Line::from(""),
        Line::from(card.description.clone()),
        Line::from(""),
        Line::from(Span::styled(
            card.effects
                .iter()
                .map(effect_text)
                .collect::<Vec<_>>()
                .join("   "),
            Style::default().fg(Color::LightCyan),
        )),
        Line::from(Span::styled(
            format!("tags: {}", card.tags.join(", ")),
            Style::default().fg(Color::Gray),
        )),
    ];
    lines.push(Line::from(""));
    if is_draft {
        lines.push(Line::from(Span::styled(
            "DRAFT READY  //  Enter execute  C cache  R rewrite  X discard",
            Style::default()
                .fg(Color::LightGreen)
                .add_modifier(Modifier::BOLD),
        )));
    } else {
        lines.push(Line::from(Span::styled(
            "CACHE SELECTED  //  Enter/Space execute",
            Style::default()
                .fg(Color::LightGreen)
                .add_modifier(Modifier::BOLD),
        )));
    }
    lines
}

fn stage_block(title: &str, color: Color) -> Block<'static> {
    Block::default()
        .title(Span::styled(
            format!(" {title} "),
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        ))
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(Color::DarkGray))
}

fn gauge(label: &'static str, value: i32, max: i32, color: Color) -> Gauge<'static> {
    let ratio = if max <= 0 {
        0.0
    } else {
        f64::from(value.max(0)) / f64::from(max)
    };
    Gauge::default()
        .gauge_style(Style::default().fg(color).add_modifier(Modifier::BOLD))
        .ratio(ratio.clamp(0.0, 1.0))
        .label(format!("{label} {}/{}", value.max(0), max))
}

fn selected_cache(app: &App) -> Option<&CompiledCard> {
    app.state.player_memory.cache.get(app.selected_cache)
}

fn latest_boss_line(app: &App) -> String {
    app.state
        .events
        .iter()
        .rev()
        .find_map(|event| match event {
            GameEvent::BossSpoke { line, .. } => Some(line.clone()),
            _ => None,
        })
        .unwrap_or_else(|| "INIT ECHO watches the cursor blink.".into())
}

fn boss_art() -> Vec<&'static str> {
    vec![
        "        ╭────────────────────╮",
        "   0x00 │  I N I T  E C H O  │ 0xFF",
        "        ╰─╥──────╥──────╥───╯",
        "          ║  ▓▓  ║  ░░  ║",
        "       /dev/null is listening",
    ]
}

fn daemon_label(app: &App) -> String {
    if app.state.player_memory.daemons.is_empty() {
        return "empty / empty".into();
    }
    app.state
        .player_memory
        .daemons
        .iter()
        .map(|daemon| {
            format!(
                "{}:{}t",
                short_name(&daemon.card.name, 14),
                daemon.remaining_turns
            )
        })
        .collect::<Vec<_>>()
        .join(" | ")
}

fn kernel_label(app: &App) -> String {
    app.state
        .player_memory
        .kernel
        .as_ref()
        .map(|kernel| short_name(&kernel.card.name, 18))
        .unwrap_or_else(|| "empty".into())
}

fn feature_title(app: &App) -> &'static str {
    if app.loading.is_some() {
        "COMPILER CHAMBER"
    } else if app.state.draft.is_some() {
        "DRAFT CARD // LIVE PAYLOAD"
    } else if selected_cache(app).is_some() {
        "SELECTED CACHE CARD"
    } else {
        "EMPTY EXECUTION LANE"
    }
}

fn feature_color(app: &App) -> Color {
    if app.loading.is_some() {
        Color::Yellow
    } else if let Some(card) = app.state.draft.as_ref().or_else(|| selected_cache(app)) {
        kind_color(card.kind)
    } else {
        Color::DarkGray
    }
}

fn actor_color(actor: ActorId) -> Color {
    match actor {
        ActorId::Player => Color::LightGreen,
        ActorId::Boss => Color::LightRed,
    }
}

fn kind_color(kind: CardKind) -> Color {
    match kind {
        CardKind::Attack => Color::LightRed,
        CardKind::Daemon => Color::LightCyan,
        CardKind::Kernel => Color::LightMagenta,
    }
}

fn kind_label(kind: CardKind) -> &'static str {
    match kind {
        CardKind::Attack => "ATTACK",
        CardKind::Daemon => "DAEMON",
        CardKind::Kernel => "KERNEL",
    }
}

fn kind_short(kind: CardKind) -> &'static str {
    match kind {
        CardKind::Attack => "ATK",
        CardKind::Daemon => "DMN",
        CardKind::Kernel => "KRN",
    }
}

fn phase_label(phase: GamePhase) -> &'static str {
    match phase {
        GamePhase::PlayerTurn => "PLAYER INPUT",
        GamePhase::BossTurn => "BOSS EXEC",
        GamePhase::GameOver => "SESSION CLOSED",
    }
}

fn short_name(value: &str, max_chars: usize) -> String {
    let count = value.chars().count();
    if count <= max_chars {
        return value.into();
    }
    let mut output = value
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    output.push('…');
    output
}

fn effect_text(effect: &Effect) -> String {
    match effect {
        Effect::Damage { track, amount, .. } => format!("DMG {} {amount}", track_text(*track)),
        Effect::Heal { track, amount, .. } => format!("HEAL {} {amount}", track_text(*track)),
        Effect::GainRam { amount, .. } => format!("RAM +{amount}"),
        Effect::Shield { track, amount, .. } => format!("SHIELD {} {amount}", track_text(*track)),
    }
}

fn track_text(track: Track) -> &'static str {
    match track {
        Track::Hp => "HP",
        Track::Sanity => "SAN",
    }
}

fn event_line(event: &GameEvent) -> String {
    match event {
        GameEvent::System { turn, message } => format!("[{turn}] {message}"),
        GameEvent::BossSpoke { turn, line } => format!("[{turn}] INIT ECHO: {line}"),
        GameEvent::TurnStarted { turn, actor } => format!("[{turn}] {:?} turn", actor),
        GameEvent::TurnEnded { turn, actor } => format!("[{turn}] {:?} end", actor),
        GameEvent::DraftForged { turn, card, .. } => {
            format!("[{turn}] draft compiled: {} / {} RAM", card.name, card.cost)
        }
        GameEvent::DraftRejected { turn, reason, .. } => {
            format!("[{turn}] draft rejected: {reason}")
        }
        GameEvent::CardCached { turn, card_name } => {
            format!("[{turn}] cached {}", short_name(card_name, 24))
        }
        GameEvent::CardPlayed {
            turn,
            actor,
            card_name,
            cost,
        } => format!(
            "[{turn}] {:?} executes {} / -{cost} RAM",
            actor,
            short_name(card_name, 24)
        ),
        GameEvent::EffectApplied {
            turn,
            target,
            amount_applied,
            effect,
            ..
        } => format!(
            "[{turn}] {:?} {} / {amount_applied}",
            target,
            effect_text(effect)
        ),
        GameEvent::Winner {
            turn,
            winner,
            reason,
        } => format!("[{turn}] {:?} wins: {reason}", winner),
    }
}

fn centered_rect(percent_x: u16, percent_y: u16, area: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(area);
    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}

#[cfg(test)]
mod tests {
    use super::*;
    use cardiverse_ai::{stub_compile_card, CompileMode};
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    #[test]
    fn renders_battle_stage_labels() {
        let backend = TestBackend::new(120, 34);
        let mut terminal = Terminal::new(backend).unwrap();
        let app = App::new(CompileMode::Stub);

        terminal.draw(|frame| render_app(frame, &app)).unwrap();

        let text = buffer_text(terminal.backend().buffer());
        assert!(text.contains("INIT ECHO"));
        assert!(text.contains("CACHE TRACK"));
        assert!(text.contains("COMMAND LINE"));
    }

    #[test]
    fn renders_draft_as_feature_card() {
        let backend = TestBackend::new(120, 34);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app = App::new(CompileMode::Stub);
        app.state.draft = Some(stub_compile_card("thermal spike").unwrap());

        terminal.draw(|frame| render_app(frame, &app)).unwrap();

        let text = buffer_text(terminal.backend().buffer());
        assert!(text.contains("DRAFT CARD"));
        assert!(text.contains("DRAFT READY"));
    }

    fn buffer_text(buffer: &ratatui::buffer::Buffer) -> String {
        buffer
            .content
            .iter()
            .map(|cell| cell.symbol())
            .collect::<Vec<_>>()
            .join("")
    }
}
