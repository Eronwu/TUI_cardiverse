use crate::types::{
    BossDefinition, CardKind, CompiledCard, Effect, Target, Track, Trigger, TriggerWhen,
};

pub fn init_echo() -> BossDefinition {
    BossDefinition {
        id: "init-echo".into(),
        name: "INIT ECHO".into(),
        title: "Boot-Sector Oracle".into(),
        ascii: vec![
            "        ╭────────────────────╮".into(),
            "   0x00 │  I N I T  E C H O  │ 0xFF".into(),
            "        ╰─╥──────╥──────╥───╯".into(),
            "          ║  ▓▓  ║  ░░  ║".into(),
            "       /dev/null is listening".into(),
        ],
        hp: 120,
        sanity: 90,
        ram_max: 18,
        ram_gain_per_turn: 8,
        intro: vec![
            "A cold boot ripple crosses the terminal.".into(),
            "INIT ECHO: prove your prompt can survive execution.".into(),
        ],
        deck: vec![
            boss_card(
                "Checksum Bite",
                5,
                Effect::Damage {
                    track: Track::Hp,
                    amount: 12,
                    target: Target::Enemy,
                },
            ),
            boss_card(
                "Null Sermon",
                6,
                Effect::Damage {
                    track: Track::Sanity,
                    amount: 14,
                    target: Target::Enemy,
                },
            ),
            boss_card(
                "Parity Shell",
                4,
                Effect::Shield {
                    track: Track::Hp,
                    amount: 10,
                    target: Target::SelfActor,
                },
            ),
        ],
    }
}

fn boss_card(name: &str, cost: i32, effect: Effect) -> CompiledCard {
    CompiledCard {
        id: format!("boss-{}", name.to_lowercase().replace(' ', "-")),
        kind: CardKind::Attack,
        name: name.into(),
        description: "A deterministic defense routine from INIT ECHO.".into(),
        target: Target::Enemy,
        cost,
        effects: vec![effect],
        tags: vec!["boss".into()],
        duration: None,
        trigger: None,
        backlash: None,
        source_prompt: None,
    }
}

pub fn starter_kernel() -> CompiledCard {
    CompiledCard {
        id: "starter-panic-catch".into(),
        kind: CardKind::Kernel,
        name: "Panic Catch".into(),
        description: "Trap the next sanity fracture and convert it into shield.".into(),
        target: Target::SelfActor,
        cost: 4,
        effects: vec![Effect::Shield {
            track: Track::Sanity,
            amount: 10,
            target: Target::SelfActor,
        }],
        tags: vec!["starter".into(), "kernel".into()],
        duration: None,
        trigger: Some(Trigger {
            when: TriggerWhen::SelfTakesSanityDamage,
            limit: 1,
            used: 0,
        }),
        backlash: None,
        source_prompt: Some("starter".into()),
    }
}
