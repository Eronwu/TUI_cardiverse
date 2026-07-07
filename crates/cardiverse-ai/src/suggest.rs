use cardiverse_core::{best_effort_action, CompiledCard, GameState, PlayerAction};

pub fn suggest_turn(state: &GameState) -> String {
    match best_effort_action(state) {
        Some(PlayerAction::UseDraft) => "Use the draft now: it is legal and keeps tempo.".into(),
        Some(PlayerAction::PlayCache { index }) => {
            let card = state.player_memory.cache.get(index).map(card_label);
            format!("Play cache slot {}{}.", index + 1, card.unwrap_or_default())
        }
        Some(PlayerAction::MountDaemon { index }) => {
            format!(
                "Mount cache slot {} as a daemon for recurring pressure.",
                index + 1
            )
        }
        Some(PlayerAction::ArmKernel { index }) => {
            format!(
                "Arm cache slot {} as a kernel trap before ending.",
                index + 1
            )
        }
        Some(PlayerAction::EndTurn) => "End turn and bank the next RAM pulse.".into(),
        _ => "Forge a concise attack prompt: thermal damage or sanity pressure.".into(),
    }
}

fn card_label(card: &CompiledCard) -> String {
    format!(" ({}, {} RAM)", card.name, card.cost)
}
