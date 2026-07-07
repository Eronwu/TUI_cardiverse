use crate::types::{CardKind, CompiledCard, Effect, Target};
use thiserror::Error;
use uuid::Uuid;

const MAX_NAME: usize = 34;
const MAX_DESCRIPTION: usize = 140;
const MAX_EFFECTS: usize = 3;
const MAX_TAGS: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ValidationError {
    #[error("card name is empty")]
    EmptyName,
    #[error("card must have at least one effect")]
    EmptyEffects,
    #[error("card has too many effects")]
    TooManyEffects,
    #[error("effect amount must be positive")]
    InvalidAmount,
    #[error("daemon cards require a duration")]
    MissingDuration,
    #[error("kernel cards require a trigger")]
    MissingTrigger,
}

pub fn validate_and_balance_card(
    mut card: CompiledCard,
    prompt: Option<&str>,
) -> Result<CompiledCard, ValidationError> {
    card.name = clean_text(&card.name, MAX_NAME);
    card.description = clean_text(&card.description, MAX_DESCRIPTION);
    if card.name.is_empty() {
        return Err(ValidationError::EmptyName);
    }
    if card.effects.is_empty() {
        return Err(ValidationError::EmptyEffects);
    }
    if card.effects.len() > MAX_EFFECTS {
        return Err(ValidationError::TooManyEffects);
    }

    for effect in &mut card.effects {
        clamp_effect(effect)?;
    }
    protect_minimum_play_value(&mut card);

    match card.kind {
        CardKind::Attack => {
            card.duration = None;
            card.trigger = None;
        }
        CardKind::Daemon => {
            let duration = card.duration.unwrap_or(3).clamp(1, 4);
            card.duration = Some(duration);
        }
        CardKind::Kernel => {
            if card.trigger.is_none() {
                return Err(ValidationError::MissingTrigger);
            }
            card.duration = None;
        }
    }

    card.tags = card
        .tags
        .into_iter()
        .map(|tag| clean_text(&tag, 18).to_lowercase())
        .filter(|tag| !tag.is_empty())
        .take(MAX_TAGS)
        .collect();
    if card.id.trim().is_empty() {
        card.id = format!("card-{}", Uuid::new_v4());
    }
    if let Some(prompt) = prompt {
        card.source_prompt = Some(clean_text(prompt, 240));
    }
    card.cost = calculate_cost(&card);
    Ok(card)
}

pub fn calculate_cost(card: &CompiledCard) -> i32 {
    let mut cost = match card.kind {
        CardKind::Attack => 3,
        CardKind::Daemon => 5,
        CardKind::Kernel => 6,
    };

    for effect in &card.effects {
        cost += match effect {
            Effect::Damage { amount, .. } => (*amount + 5) / 6,
            Effect::Heal { amount, .. } => (*amount + 7) / 8,
            Effect::GainRam { amount, .. } => (*amount).max(0),
            Effect::Shield { amount, .. } => (*amount + 6) / 7,
        };
    }

    if let Some(duration) = card.duration {
        cost += i32::from(duration).saturating_sub(1);
    }
    if card.backlash.is_some() {
        cost -= 2;
    }
    cost.clamp(1, 20)
}

fn clamp_effect(effect: &mut Effect) -> Result<(), ValidationError> {
    match effect {
        Effect::Damage { amount, target, .. } => {
            if *amount <= 0 {
                return Err(ValidationError::InvalidAmount);
            }
            *amount = (*amount).clamp(1, 36);
            if matches!(target, Target::SelfActor) {
                *target = Target::Enemy;
            }
        }
        Effect::Heal { amount, target, .. } | Effect::Shield { amount, target, .. } => {
            if *amount <= 0 {
                return Err(ValidationError::InvalidAmount);
            }
            *amount = (*amount).clamp(1, 30);
            if matches!(target, Target::Enemy) {
                *target = Target::SelfActor;
            }
        }
        Effect::GainRam { amount, target } => {
            if *amount <= 0 {
                return Err(ValidationError::InvalidAmount);
            }
            *amount = (*amount).clamp(1, 6);
            *target = Target::SelfActor;
        }
    }
    Ok(())
}

fn protect_minimum_play_value(card: &mut CompiledCard) {
    let min_damage = match card.kind {
        CardKind::Attack => 12,
        CardKind::Daemon => 6,
        CardKind::Kernel => 8,
    };
    for effect in &mut card.effects {
        if let Effect::Damage { amount, .. } = effect {
            *amount = (*amount).max(min_damage);
        }
    }
}

fn clean_text(value: &str, max_len: usize) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_control())
        .collect::<String>()
        .trim()
        .chars()
        .take(max_len)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CardKind, Effect, Target, Track};

    #[test]
    fn recalculates_cost_and_clamps_damage() {
        let card = CompiledCard {
            id: String::new(),
            kind: CardKind::Attack,
            name: "Fire Angel".into(),
            description: "burn".into(),
            target: Target::Enemy,
            cost: 999,
            effects: vec![Effect::Damage {
                track: Track::Hp,
                amount: 99,
                target: Target::Enemy,
            }],
            tags: vec!["Fire".into()],
            duration: Some(9),
            trigger: None,
            backlash: None,
            source_prompt: None,
        };
        let balanced = validate_and_balance_card(card, Some("create fire angel")).unwrap();
        assert_eq!(
            balanced.effects[0],
            Effect::Damage {
                track: Track::Hp,
                amount: 36,
                target: Target::Enemy,
            }
        );
        assert_eq!(balanced.cost, 9);
        assert_eq!(balanced.duration, None);
        assert_eq!(balanced.source_prompt.as_deref(), Some("create fire angel"));
    }

    #[test]
    fn protects_generated_attacks_from_tiny_damage() {
        let card = CompiledCard {
            id: String::new(),
            kind: CardKind::Attack,
            name: "Low-Power Strike".into(),
            description: "too weak".into(),
            target: Target::Enemy,
            cost: 4,
            effects: vec![Effect::Damage {
                track: Track::Hp,
                amount: 2,
                target: Target::Enemy,
            }],
            tags: vec!["economy".into()],
            duration: None,
            trigger: None,
            backlash: None,
            source_prompt: None,
        };
        let balanced = validate_and_balance_card(card, Some("low ram damage")).unwrap();
        assert_eq!(
            balanced.effects[0],
            Effect::Damage {
                track: Track::Hp,
                amount: 12,
                target: Target::Enemy,
            }
        );
        assert!(balanced.cost >= 5);
    }
}
