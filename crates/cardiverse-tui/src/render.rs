use cardiverse_core::{ActorId, CompiledCard, Effect, GameEvent, GamePhase, Track};
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::prelude::{Color, Frame, Line, Modifier, Span, Style};
use ratatui::widgets::{Block, Borders, Gauge, List, ListItem, Paragraph, Wrap};

use crate::app::{App, ScreenMode};

pub fn render_app(frame: &mut Frame, app: &App) {
    let area = frame.area();
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(8),
            Constraint::Min(14),
            Constraint::Length(7),
        ])
        .split(area);

    render_header(frame, app, vertical[0]);
    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(65), Constraint::Percentage(35)])
        .split(vertical[1]);
    render_left(frame, app, body[0]);
    render_log(frame, app, body[1]);
    render_footer(frame, app, vertical[2]);

    if app.mode == ScreenMode::Forging {
        render_forge_modal(frame, app, centered_rect(70, 35, area));
    } else if app.mode == ScreenMode::Help {
        render_help(frame, centered_rect(72, 55, area));
    }
}

fn render_header(frame: &mut Frame, app: &App, area: Rect) {
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(42),
            Constraint::Percentage(29),
            Constraint::Percentage(29),
        ])
        .split(area);

    let boss = init_boss_lines(app);
    frame.render_widget(
        Paragraph::new(boss)
            .block(
                Block::default()
                    .title("INIT ECHO MATRIX")
                    .borders(Borders::ALL),
            )
            .style(Style::default().fg(Color::LightCyan)),
        columns[0],
    );
    render_actor_gauges(
        frame,
        "OPERATOR",
        app.state.player.hp,
        app.state.player.max_hp,
        app.state.player.sanity,
        app.state.player.max_sanity,
        app.state.player.ram,
        app.state.player.max_ram,
        columns[1],
    );
    render_actor_gauges(
        frame,
        "BOSS",
        app.state.boss.hp,
        app.state.boss.max_hp,
        app.state.boss.sanity,
        app.state.boss.max_sanity,
        app.state.boss.ram,
        app.state.boss.max_ram,
        columns[2],
    );
}

fn init_boss_lines(app: &App) -> Vec<Line<'static>> {
    let mut lines = vec![Line::from(Span::styled(
        format!("TURN {} / {:?}", app.state.turn, app.state.phase),
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    ))];
    lines.extend(
        app.state
            .events
            .iter()
            .rev()
            .filter_map(|event| match event {
                GameEvent::BossSpoke { line, .. } => Some(Line::from(line.clone())),
                _ => None,
            })
            .take(4),
    );
    lines
}

fn render_actor_gauges(
    frame: &mut Frame,
    title: &str,
    hp: i32,
    max_hp: i32,
    sanity: i32,
    max_sanity: i32,
    ram: i32,
    max_ram: i32,
    area: Rect,
) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Length(2),
            Constraint::Length(2),
        ])
        .split(area);
    let block = Block::default().title(title).borders(Borders::ALL);
    frame.render_widget(block, area);
    frame.render_widget(gauge("HP", hp, max_hp, Color::Red), rows[0]);
    frame.render_widget(gauge("SAN", sanity, max_sanity, Color::Magenta), rows[1]);
    frame.render_widget(gauge("RAM", ram, max_ram, Color::Cyan), rows[2]);
}

fn gauge(label: &'static str, value: i32, max: i32, color: Color) -> Gauge<'static> {
    let ratio = if max <= 0 {
        0.0
    } else {
        f64::from(value.max(0)) / f64::from(max)
    };
    Gauge::default()
        .gauge_style(Style::default().fg(color))
        .ratio(ratio.clamp(0.0, 1.0))
        .label(format!("{label} {}/{}", value.max(0), max))
}

fn render_left(frame: &mut Frame, app: &App, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(46), Constraint::Percentage(54)])
        .split(area);
    render_draft(frame, app, rows[0]);
    render_memory(frame, app, rows[1]);
}

fn render_draft(frame: &mut Frame, app: &App, area: Rect) {
    let title = if app.loading.is_some() {
        "DRAFT COMPILER"
    } else {
        "DRAFT CARD"
    };
    let lines = if let Some(loading) = &app.loading {
        let frames = ["|", "/", "-", "\\"];
        let elapsed = loading.started_at.elapsed().as_secs_f32();
        vec![
            Line::from(Span::styled(
                format!(
                    "{} {} {:.1}s",
                    frames[loading.tick % frames.len()],
                    loading.label,
                    elapsed
                ),
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from("Parsing intent -> JSON card -> local validator -> balanced draft"),
            Line::from("The terminal is alive; this is not frozen."),
        ]
    } else if let Some(card) = &app.state.draft {
        card_lines(card, true)
    } else {
        vec![
            Line::from(Span::styled(
                "No draft loaded.",
                Style::default().fg(Color::DarkGray),
            )),
            Line::from("Press F and describe a shell spell, exploit, daemon, or kernel trap."),
        ]
    };
    frame.render_widget(
        Paragraph::new(lines)
            .block(Block::default().title(title).borders(Borders::ALL))
            .wrap(Wrap { trim: true }),
        area,
    );
}

fn render_memory(frame: &mut Frame, app: &App, area: Rect) {
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(55),
            Constraint::Percentage(24),
            Constraint::Percentage(21),
        ])
        .split(area);

    let cache_items: Vec<ListItem> = if app.state.player_memory.cache.is_empty() {
        vec![ListItem::new("empty")]
    } else {
        app.state
            .player_memory
            .cache
            .iter()
            .enumerate()
            .map(|(index, card)| {
                let style = if index == app.selected_cache {
                    Style::default().fg(Color::Black).bg(Color::LightCyan)
                } else {
                    Style::default()
                };
                ListItem::new(format!(
                    "[{}] {} / {:?} / {} RAM",
                    index + 1,
                    card.name,
                    card.kind,
                    card.cost
                ))
                .style(style)
            })
            .collect()
    };
    frame.render_widget(
        List::new(cache_items).block(Block::default().title("CACHE").borders(Borders::ALL)),
        columns[0],
    );

    let daemon_lines = if app.state.player_memory.daemons.is_empty() {
        vec![Line::from("empty"), Line::from("empty")]
    } else {
        app.state
            .player_memory
            .daemons
            .iter()
            .map(|daemon| {
                Line::from(format!(
                    "{} : {}t",
                    daemon.card.name, daemon.remaining_turns
                ))
            })
            .collect()
    };
    frame.render_widget(
        Paragraph::new(daemon_lines).block(Block::default().title("DAEMON").borders(Borders::ALL)),
        columns[1],
    );

    let kernel = app
        .state
        .player_memory
        .kernel
        .as_ref()
        .map(|kernel| kernel.card.name.clone())
        .unwrap_or_else(|| "empty".into());
    frame.render_widget(
        Paragraph::new(kernel).block(Block::default().title("KERNEL").borders(Borders::ALL)),
        columns[2],
    );
}

fn render_log(frame: &mut Frame, app: &App, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(68), Constraint::Percentage(32)])
        .split(area);
    let items: Vec<ListItem> = app
        .state
        .events
        .iter()
        .rev()
        .take(12)
        .map(|event| ListItem::new(event_line(event)))
        .collect();
    frame.render_widget(
        List::new(items).block(Block::default().title("BATTLE LOG").borders(Borders::ALL)),
        rows[0],
    );
    frame.render_widget(
        Paragraph::new(app.ai_suggestion.clone())
            .block(Block::default().title("AI ADVISOR").borders(Borders::ALL))
            .wrap(Wrap { trim: true }),
        rows[1],
    );
}

fn render_footer(frame: &mut Frame, app: &App, area: Rect) {
    let status_style = if app.state.phase == GamePhase::GameOver {
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::Green)
    };
    let lines = vec![
        Line::from(Span::styled(app.status.clone(), status_style)),
        Line::from("F forge | Enter/Space play/use | arrows select | C cache | R rewrite | X discard | E end | A suggest | G auto | ? help | Q quit"),
    ];
    frame.render_widget(
        Paragraph::new(lines)
            .block(
                Block::default()
                    .title("CONTROL SURFACE")
                    .borders(Borders::ALL),
            )
            .alignment(Alignment::Left),
        area,
    );
}

fn render_forge_modal(frame: &mut Frame, app: &App, area: Rect) {
    let lines = vec![
        Line::from(Span::styled(
            "FORGE INTENT",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(app.input.clone()),
        Line::from(""),
        Line::from("Enter compile | Esc cancel"),
    ];
    frame.render_widget(
        Paragraph::new(lines)
            .block(
                Block::default()
                    .title("PROMPT COMPILER")
                    .borders(Borders::ALL),
            )
            .wrap(Wrap { trim: false }),
        area,
    );
}

fn render_help(frame: &mut Frame, area: Rect) {
    let lines = vec![
        Line::from("Terminal Cardiverse is a keyboard-first battle cockpit."),
        Line::from("F opens AI card forging. The result becomes a draft, not a cached card."),
        Line::from("Enter uses a draft immediately, or executes the selected cache card."),
        Line::from("C caches the draft. R rewrites it. X discards it."),
        Line::from("A asks for advice. G lets the rules-only AI play legal actions."),
        Line::from("Esc closes this panel."),
    ];
    frame.render_widget(
        Paragraph::new(lines)
            .block(Block::default().title("HELP").borders(Borders::ALL))
            .wrap(Wrap { trim: true }),
        area,
    );
}

fn card_lines(card: &CompiledCard, controls: bool) -> Vec<Line<'static>> {
    let mut lines = vec![
        Line::from(Span::styled(
            format!("{} / {:?} / {} RAM", card.name, card.kind, card.cost),
            Style::default()
                .fg(Color::LightYellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(card.description.clone()),
        Line::from(format!(
            "effects: {}",
            card.effects
                .iter()
                .map(effect_text)
                .collect::<Vec<_>>()
                .join("; ")
        )),
        Line::from(format!("tags: {}", card.tags.join(", "))),
    ];
    if controls {
        lines.push(Line::from(
            "Enter use now | C cache | R rewrite | X discard",
        ));
    }
    lines
}

fn effect_text(effect: &Effect) -> String {
    match effect {
        Effect::Damage { track, amount, .. } => format!("damage {} {amount}", track_text(*track)),
        Effect::Heal { track, amount, .. } => format!("heal {} {amount}", track_text(*track)),
        Effect::GainRam { amount, .. } => format!("gain_ram {amount}"),
        Effect::Shield { track, amount, .. } => format!("shield {} {amount}", track_text(*track)),
    }
}

fn track_text(track: Track) -> &'static str {
    match track {
        Track::Hp => "hp",
        Track::Sanity => "sanity",
    }
}

fn event_line(event: &GameEvent) -> String {
    match event {
        GameEvent::System { turn, message } => format!("[{turn}] {message}"),
        GameEvent::BossSpoke { turn, line } => format!("[{turn}] INIT ECHO: {line}"),
        GameEvent::TurnStarted { turn, actor } => format!("[{turn}] {:?} turn started", actor),
        GameEvent::TurnEnded { turn, actor } => format!("[{turn}] {:?} turn ended", actor),
        GameEvent::DraftForged { turn, card, .. } => {
            format!("[{turn}] draft forged: {}", card.name)
        }
        GameEvent::DraftRejected { turn, reason, .. } => {
            format!("[{turn}] draft rejected: {reason}")
        }
        GameEvent::CardCached { turn, card_name } => format!("[{turn}] cached {card_name}"),
        GameEvent::CardPlayed {
            turn,
            actor,
            card_name,
            cost,
        } => {
            format!("[{turn}] {:?} executed {card_name} (-{cost} RAM)", actor)
        }
        GameEvent::EffectApplied {
            turn,
            target,
            amount_applied,
            effect,
            ..
        } => {
            let target = match target {
                ActorId::Player => "player",
                ActorId::Boss => "boss",
            };
            format!(
                "[{turn}] {target} {} / applied {amount_applied}",
                effect_text(effect)
            )
        }
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
