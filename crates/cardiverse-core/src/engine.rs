use crate::action::PlayerAction;
use crate::balance::validate_and_balance_card;
use crate::content::{init_echo, starter_kernel};
use crate::types::*;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum GameError {
    #[error("the game is over")]
    GameOver,
    #[error("it is not the player's turn")]
    NotPlayerTurn,
    #[error("not enough RAM")]
    NotEnoughRam,
    #[error("cache slot is empty")]
    EmptyCacheSlot,
    #[error("cache is full")]
    CacheFull,
    #[error("no draft card")]
    NoDraft,
    #[error("daemon slots are full")]
    DaemonFull,
    #[error("kernel is already armed")]
    KernelFull,
    #[error("invalid card: {0}")]
    InvalidCard(String),
}

pub fn new_game(boss: &BossDefinition) -> GameState {
    let mut state = GameState {
        phase: GamePhase::PlayerTurn,
        turn: 1,
        active_actor: ActorId::Player,
        player: CharacterState {
            id: ActorId::Player,
            name: "operator".into(),
            hp: 100,
            max_hp: 100,
            sanity: 100,
            max_sanity: 100,
            ram: 10,
            max_ram: 20,
            ram_gain_per_turn: 10,
            hp_shield: 0,
            sanity_shield: 0,
        },
        boss: CharacterState {
            id: ActorId::Boss,
            name: boss.name.clone(),
            hp: boss.hp,
            max_hp: boss.hp,
            sanity: boss.sanity,
            max_sanity: boss.sanity,
            ram: boss.ram_gain_per_turn,
            max_ram: boss.ram_max,
            ram_gain_per_turn: boss.ram_gain_per_turn,
            hp_shield: 0,
            sanity_shield: 0,
        },
        player_memory: MemoryState {
            cache: vec![starter_kernel()],
            daemons: Vec::new(),
            kernel: None,
            discard: Vec::new(),
        },
        boss_memory: MemoryState {
            cache: boss.deck.clone(),
            daemons: Vec::new(),
            kernel: None,
            discard: Vec::new(),
        },
        boss_id: boss.id.clone(),
        draft: None,
        winner: None,
        defeat_reason: None,
        events: Vec::new(),
    };
    push(
        &mut state,
        GameEvent::System {
            turn: 1,
            message: "Terminal Cardiverse session opened.".into(),
        },
    );
    for line in &boss.intro {
        push(
            &mut state,
            GameEvent::BossSpoke {
                turn: 1,
                line: line.clone(),
            },
        );
    }
    state
}

pub fn apply_action(
    state: &mut GameState,
    action: PlayerAction,
) -> Result<Vec<GameEvent>, GameError> {
    let before = state.events.len();
    match action {
        PlayerAction::ForgeDraft { prompt, card } => {
            ensure_player_turn(state)?;
            let balanced = validate_and_balance_card(card, Some(&prompt))
                .map_err(|err| GameError::InvalidCard(err.to_string()))?;
            push(
                state,
                GameEvent::DraftForged {
                    turn: state.turn,
                    prompt,
                    card: balanced.clone(),
                },
            );
            state.draft = Some(balanced);
        }
        PlayerAction::UseDraft => {
            ensure_player_turn(state)?;
            let card = state.draft.take().ok_or(GameError::NoDraft)?;
            use_draft_card(state, card)?;
        }
        PlayerAction::CacheDraft => {
            ensure_player_turn(state)?;
            if state.player_memory.cache.len() >= 5 {
                return Err(GameError::CacheFull);
            }
            let card = state.draft.take().ok_or(GameError::NoDraft)?;
            push(
                state,
                GameEvent::CardCached {
                    turn: state.turn,
                    card_name: card.name.clone(),
                },
            );
            state.player_memory.cache.push(card);
        }
        PlayerAction::DiscardDraft => {
            ensure_player_turn(state)?;
            let card = state.draft.take().ok_or(GameError::NoDraft)?;
            push(
                state,
                GameEvent::System {
                    turn: state.turn,
                    message: format!("Draft discarded: {}", card.name),
                },
            );
            state.player_memory.discard.push(card);
        }
        PlayerAction::PlayCache { index } => {
            ensure_player_turn(state)?;
            let card = take_cache(&mut state.player_memory, index)?;
            if card.kind != CardKind::Attack {
                state.player_memory.cache.insert(index, card);
                return Err(GameError::EmptyCacheSlot);
            }
            play_player_card(state, card)?;
        }
        PlayerAction::MountDaemon { index } => {
            ensure_player_turn(state)?;
            if state.player_memory.daemons.len() >= 2 {
                return Err(GameError::DaemonFull);
            }
            let card = take_cache(&mut state.player_memory, index)?;
            if card.kind != CardKind::Daemon {
                state.player_memory.cache.insert(index, card);
                return Err(GameError::EmptyCacheSlot);
            }
            spend_ram(&mut state.player, card.cost)?;
            push_played(state, ActorId::Player, &card);
            state.player_memory.daemons.push(ActiveDaemon {
                remaining_turns: card.duration.unwrap_or(3),
                card,
            });
        }
        PlayerAction::ArmKernel { index } => {
            ensure_player_turn(state)?;
            if state.player_memory.kernel.is_some() {
                return Err(GameError::KernelFull);
            }
            let card = take_cache(&mut state.player_memory, index)?;
            if card.kind != CardKind::Kernel {
                state.player_memory.cache.insert(index, card);
                return Err(GameError::EmptyCacheSlot);
            }
            spend_ram(&mut state.player, card.cost)?;
            push_played(state, ActorId::Player, &card);
            state.player_memory.kernel = Some(ActiveKernel { card });
        }
        PlayerAction::EndTurn => {
            ensure_player_turn(state)?;
            push(
                state,
                GameEvent::TurnEnded {
                    turn: state.turn,
                    actor: ActorId::Player,
                },
            );
            run_boss_turn(state);
        }
        PlayerAction::Restart => {
            *state = new_game(&init_echo());
        }
    }
    Ok(state.events[before..].to_vec())
}

fn use_draft_card(state: &mut GameState, card: CompiledCard) -> Result<(), GameError> {
    match card.kind {
        CardKind::Attack => play_player_card(state, card),
        CardKind::Daemon => {
            if state.player_memory.daemons.len() >= 2 {
                return Err(GameError::DaemonFull);
            }
            spend_ram(&mut state.player, card.cost)?;
            push_played(state, ActorId::Player, &card);
            state.player_memory.daemons.push(ActiveDaemon {
                remaining_turns: card.duration.unwrap_or(3),
                card,
            });
            Ok(())
        }
        CardKind::Kernel => {
            if state.player_memory.kernel.is_some() {
                return Err(GameError::KernelFull);
            }
            spend_ram(&mut state.player, card.cost)?;
            push_played(state, ActorId::Player, &card);
            state.player_memory.kernel = Some(ActiveKernel { card });
            Ok(())
        }
    }
}

fn ensure_player_turn(state: &GameState) -> Result<(), GameError> {
    if state.phase == GamePhase::GameOver {
        return Err(GameError::GameOver);
    }
    if state.phase != GamePhase::PlayerTurn {
        return Err(GameError::NotPlayerTurn);
    }
    Ok(())
}

fn play_player_card(state: &mut GameState, card: CompiledCard) -> Result<(), GameError> {
    spend_ram(&mut state.player, card.cost)?;
    push_played(state, ActorId::Player, &card);
    for effect in &card.effects {
        apply_effect(state, ActorId::Player, effect.clone());
    }
    state.player_memory.discard.push(card);
    check_winner(state);
    Ok(())
}

fn run_boss_turn(state: &mut GameState) {
    if state.phase == GamePhase::GameOver {
        return;
    }
    state.phase = GamePhase::BossTurn;
    state.active_actor = ActorId::Boss;
    push(
        state,
        GameEvent::TurnStarted {
            turn: state.turn,
            actor: ActorId::Boss,
        },
    );

    state.boss.ram = (state.boss.ram + state.boss.ram_gain_per_turn).min(state.boss.max_ram);
    let playable = choose_boss_card(state);
    if let Some(index) = playable {
        let card = state.boss_memory.cache[index].clone();
        if spend_ram(&mut state.boss, card.cost).is_ok() {
            push_played(state, ActorId::Boss, &card);
            for effect in &card.effects {
                apply_effect(state, ActorId::Boss, effect.clone());
            }
        }
    } else {
        push(
            state,
            GameEvent::BossSpoke {
                turn: state.turn,
                line: "INIT ECHO idles, checksum teeth still visible.".into(),
            },
        );
    }
    check_winner(state);
    if state.phase == GamePhase::GameOver {
        return;
    }
    state.turn += 1;
    state.phase = GamePhase::PlayerTurn;
    state.active_actor = ActorId::Player;
    state.player.ram =
        (state.player.ram + state.player.ram_gain_per_turn).min(state.player.max_ram);
    tick_daemons(state);
    push(
        state,
        GameEvent::TurnStarted {
            turn: state.turn,
            actor: ActorId::Player,
        },
    );
    check_winner(state);
}

fn choose_boss_card(state: &GameState) -> Option<usize> {
    let playable = state
        .boss_memory
        .cache
        .iter()
        .enumerate()
        .filter(|(_, card)| card.cost <= state.boss.ram)
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    if playable.is_empty() {
        return None;
    }

    let preferred_id = match state.turn % 3 {
        1 => "boss-null-sermon",
        2 => "boss-checksum-bite",
        _ => "boss-parity-shell",
    };
    playable
        .iter()
        .copied()
        .find(|index| state.boss_memory.cache[*index].id == preferred_id)
        .or_else(|| playable.first().copied())
}

fn tick_daemons(state: &mut GameState) {
    let daemons = std::mem::take(&mut state.player_memory.daemons);
    for mut daemon in daemons {
        for effect in &daemon.card.effects {
            apply_effect(state, ActorId::Player, effect.clone());
        }
        daemon.remaining_turns = daemon.remaining_turns.saturating_sub(1);
        if daemon.remaining_turns == 0 {
            state.player_memory.discard.push(daemon.card);
        } else {
            state.player_memory.daemons.push(daemon);
        }
    }
}

fn apply_effect(state: &mut GameState, actor: ActorId, effect: Effect) {
    let target_id = relative_target(actor, &effect);
    let amount = match target_id {
        ActorId::Player => apply_to_character(&mut state.player, &effect),
        ActorId::Boss => apply_to_character(&mut state.boss, &effect),
    };
    push(
        state,
        GameEvent::EffectApplied {
            turn: state.turn,
            actor,
            target: target_id,
            effect,
            amount_applied: amount,
        },
    );
}

fn relative_target(actor: ActorId, effect: &Effect) -> ActorId {
    let target = match effect {
        Effect::Damage { target, .. }
        | Effect::Heal { target, .. }
        | Effect::GainRam { target, .. }
        | Effect::Shield { target, .. } => *target,
    };
    match (actor, target) {
        (ActorId::Player, Target::SelfActor) => ActorId::Player,
        (ActorId::Player, Target::Enemy) => ActorId::Boss,
        (ActorId::Boss, Target::SelfActor) => ActorId::Boss,
        (ActorId::Boss, Target::Enemy) => ActorId::Player,
    }
}

fn apply_to_character(character: &mut CharacterState, effect: &Effect) -> i32 {
    match effect {
        Effect::Damage { track, amount, .. } => {
            let shield = match track {
                Track::Hp => &mut character.hp_shield,
                Track::Sanity => &mut character.sanity_shield,
            };
            let blocked = (*shield).min(*amount);
            *shield -= blocked;
            let applied = *amount - blocked;
            match track {
                Track::Hp => character.hp = (character.hp - applied).max(0),
                Track::Sanity => character.sanity = (character.sanity - applied).max(0),
            }
            applied
        }
        Effect::Heal { track, amount, .. } => {
            match track {
                Track::Hp => character.hp = (character.hp + amount).min(character.max_hp),
                Track::Sanity => {
                    character.sanity = (character.sanity + amount).min(character.max_sanity)
                }
            }
            *amount
        }
        Effect::GainRam { amount, .. } => {
            character.ram = (character.ram + amount).min(character.max_ram);
            *amount
        }
        Effect::Shield { track, amount, .. } => {
            match track {
                Track::Hp => character.hp_shield = (character.hp_shield + amount).min(40),
                Track::Sanity => {
                    character.sanity_shield = (character.sanity_shield + amount).min(40)
                }
            }
            *amount
        }
    }
}

fn check_winner(state: &mut GameState) {
    let winner = if state.boss.hp <= 0 {
        Some((ActorId::Player, "boss hp collapsed"))
    } else if state.boss.sanity <= 0 {
        Some((ActorId::Player, "boss sanity collapsed"))
    } else if state.player.hp <= 0 {
        Some((ActorId::Boss, "player hp collapsed"))
    } else if state.player.sanity <= 0 {
        Some((ActorId::Boss, "player sanity collapsed"))
    } else {
        None
    };

    if let Some((winner, reason)) = winner {
        state.phase = GamePhase::GameOver;
        state.winner = Some(winner);
        state.defeat_reason = Some(reason.into());
        push(
            state,
            GameEvent::Winner {
                turn: state.turn,
                winner,
                reason: reason.into(),
            },
        );
    }
}

fn take_cache(memory: &mut MemoryState, index: usize) -> Result<CompiledCard, GameError> {
    if index >= memory.cache.len() {
        return Err(GameError::EmptyCacheSlot);
    }
    Ok(memory.cache.remove(index))
}

fn spend_ram(character: &mut CharacterState, cost: i32) -> Result<(), GameError> {
    if character.ram < cost {
        return Err(GameError::NotEnoughRam);
    }
    character.ram -= cost;
    Ok(())
}

fn push_played(state: &mut GameState, actor: ActorId, card: &CompiledCard) {
    push(
        state,
        GameEvent::CardPlayed {
            turn: state.turn,
            actor,
            card_name: card.name.clone(),
            cost: card.cost,
        },
    );
}

fn push(state: &mut GameState, event: GameEvent) {
    state.events.push(event);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CardKind, Effect, Target, Track};
    use proptest::prelude::*;

    fn attack(amount: i32) -> CompiledCard {
        CompiledCard {
            id: "test-attack".into(),
            kind: CardKind::Attack,
            name: "Thermal Spike".into(),
            description: "A focused burst.".into(),
            target: Target::Enemy,
            cost: 1,
            effects: vec![Effect::Damage {
                track: Track::Hp,
                amount,
                target: Target::Enemy,
            }],
            tags: vec![],
            duration: None,
            trigger: None,
            backlash: None,
            source_prompt: None,
        }
    }

    #[test]
    fn forged_card_enters_draft_not_cache() {
        let mut state = new_game(&init_echo());
        apply_action(
            &mut state,
            PlayerAction::ForgeDraft {
                prompt: "burn".into(),
                card: attack(12),
            },
        )
        .unwrap();
        assert!(state.draft.is_some());
        assert_eq!(state.player_memory.cache.len(), 1);
    }

    #[test]
    fn play_draft_spends_ram_and_damages_boss() {
        let mut state = new_game(&init_echo());
        apply_action(
            &mut state,
            PlayerAction::ForgeDraft {
                prompt: "burn".into(),
                card: attack(12),
            },
        )
        .unwrap();
        apply_action(&mut state, PlayerAction::UseDraft).unwrap();
        assert!(state.player.ram < 10);
        assert_eq!(state.boss.hp, 108);
    }

    #[test]
    fn boss_rotates_between_pressure_cards() {
        let mut state = new_game(&init_echo());
        apply_action(&mut state, PlayerAction::EndTurn).unwrap();
        let boss_cards = state
            .events
            .iter()
            .filter_map(|event| match event {
                GameEvent::CardPlayed {
                    actor: ActorId::Boss,
                    card_name,
                    ..
                } => Some(card_name.clone()),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(boss_cards, vec!["Null Sermon"]);

        apply_action(&mut state, PlayerAction::EndTurn).unwrap();
        let boss_cards = state
            .events
            .iter()
            .filter_map(|event| match event {
                GameEvent::CardPlayed {
                    actor: ActorId::Boss,
                    card_name,
                    ..
                } => Some(card_name.clone()),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert!(boss_cards.contains(&"Checksum Bite".to_string()));
    }

    #[test]
    fn using_daemon_draft_mounts_it_instead_of_discarding() {
        let mut state = new_game(&init_echo());
        let daemon = CompiledCard {
            id: "test-daemon".into(),
            kind: CardKind::Daemon,
            name: "Shield Loop".into(),
            description: "persistent shield".into(),
            target: Target::SelfActor,
            cost: 1,
            effects: vec![Effect::Shield {
                track: Track::Hp,
                amount: 8,
                target: Target::SelfActor,
            }],
            tags: vec![],
            duration: Some(3),
            trigger: None,
            backlash: None,
            source_prompt: None,
        };
        apply_action(
            &mut state,
            PlayerAction::ForgeDraft {
                prompt: "shield loop".into(),
                card: daemon,
            },
        )
        .unwrap();
        apply_action(&mut state, PlayerAction::UseDraft).unwrap();
        assert_eq!(state.player_memory.daemons.len(), 1);
        assert_eq!(state.player_memory.discard.len(), 0);
    }

    proptest! {
        #[test]
        fn damage_never_makes_hp_negative(raw_amount in 1..500i32) {
            let mut state = new_game(&init_echo());
            let card = attack(raw_amount);
            apply_action(&mut state, PlayerAction::ForgeDraft {
                prompt: "large hit".into(),
                card,
            }).unwrap();
            let _ = apply_action(&mut state, PlayerAction::UseDraft);
            prop_assert!(state.boss.hp >= 0);
            prop_assert!(state.player.ram >= 0);
        }
    }
}
