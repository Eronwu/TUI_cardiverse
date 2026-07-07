use cardiverse_core::{BattleReplay, GameEvent};

pub fn render_replay_text(replay: &BattleReplay) -> String {
    let mut lines = vec![
        format!("Terminal Cardiverse Replay v{}", replay.version),
        format!("Boss: {}", replay.boss_id),
        String::new(),
    ];
    lines.extend(replay.events.iter().map(event_line));
    lines.join("\n")
}

fn event_line(event: &GameEvent) -> String {
    match event {
        GameEvent::System { turn, message } => format!("[{turn}] {message}"),
        GameEvent::BossSpoke { turn, line } => format!("[{turn}] INIT ECHO: {line}"),
        GameEvent::TurnStarted { turn, actor } => format!("[{turn}] {:?} turn started", actor),
        GameEvent::TurnEnded { turn, actor } => format!("[{turn}] {:?} turn ended", actor),
        GameEvent::DraftForged { turn, prompt, card } => {
            format!(
                "[{turn}] forge `{prompt}` -> {} / {} RAM",
                card.name, card.cost
            )
        }
        GameEvent::DraftRejected {
            turn,
            prompt,
            reason,
        } => {
            format!("[{turn}] forge `{prompt}` rejected: {reason}")
        }
        GameEvent::CardCached { turn, card_name } => format!("[{turn}] cached {card_name}"),
        GameEvent::CardPlayed {
            turn,
            actor,
            card_name,
            cost,
        } => {
            format!("[{turn}] {:?} played {card_name} / -{cost} RAM", actor)
        }
        GameEvent::EffectApplied {
            turn,
            target,
            amount_applied,
            ..
        } => {
            format!("[{turn}] {:?} effect applied: {amount_applied}", target)
        }
        GameEvent::Winner {
            turn,
            winner,
            reason,
        } => format!("[{turn}] {:?} wins: {reason}", winner),
    }
}
