use crate::types::{CardKind, CompiledCard, GamePhase, GameState};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlayerAction {
    ForgeDraft { prompt: String, card: CompiledCard },
    UseDraft,
    CacheDraft,
    DiscardDraft,
    PlayCache { index: usize },
    MountDaemon { index: usize },
    ArmKernel { index: usize },
    EndTurn,
    Restart,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LegalAction {
    Forge,
    UseDraft,
    CacheDraft,
    DiscardDraft,
    PlayCache(usize),
    MountDaemon(usize),
    ArmKernel(usize),
    EndTurn,
}

pub fn legal_actions(state: &GameState) -> Vec<LegalAction> {
    if state.phase == GamePhase::GameOver {
        return vec![];
    }
    let mut actions = Vec::new();
    if state.phase == GamePhase::PlayerTurn {
        if state.player_memory.cache.len() < 5 {
            actions.push(LegalAction::Forge);
        }
        if let Some(draft) = &state.draft {
            if state.player.ram >= draft.cost {
                match draft.kind {
                    CardKind::Attack => actions.push(LegalAction::UseDraft),
                    CardKind::Daemon if state.player_memory.daemons.len() < 2 => {
                        actions.push(LegalAction::UseDraft)
                    }
                    CardKind::Kernel if state.player_memory.kernel.is_none() => {
                        actions.push(LegalAction::UseDraft)
                    }
                    _ => {}
                }
            }
            if state.player_memory.cache.len() < 5 {
                actions.push(LegalAction::CacheDraft);
            }
            actions.push(LegalAction::DiscardDraft);
        }
        for (index, card) in state.player_memory.cache.iter().enumerate() {
            if state.player.ram < card.cost {
                continue;
            }
            match card.kind {
                CardKind::Attack => actions.push(LegalAction::PlayCache(index)),
                CardKind::Daemon => {
                    if state.player_memory.daemons.len() < 2 {
                        actions.push(LegalAction::MountDaemon(index));
                    }
                }
                CardKind::Kernel => {
                    if state.player_memory.kernel.is_none() {
                        actions.push(LegalAction::ArmKernel(index));
                    }
                }
            }
        }
        actions.push(LegalAction::EndTurn);
    }
    actions
}

pub fn best_effort_action(state: &GameState) -> Option<PlayerAction> {
    if state.phase != GamePhase::PlayerTurn {
        return None;
    }

    let legal = legal_actions(state);
    for action in &legal {
        match action {
            LegalAction::PlayCache(index) => {
                return Some(PlayerAction::PlayCache { index: *index });
            }
            LegalAction::UseDraft => return Some(PlayerAction::UseDraft),
            LegalAction::MountDaemon(index) => {
                return Some(PlayerAction::MountDaemon { index: *index });
            }
            LegalAction::ArmKernel(index) => {
                return Some(PlayerAction::ArmKernel { index: *index })
            }
            _ => {}
        }
    }
    Some(PlayerAction::EndTurn)
}
