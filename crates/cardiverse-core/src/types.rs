use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActorId {
    Player,
    Boss,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Track {
    Hp,
    Sanity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Target {
    #[serde(rename = "self")]
    SelfActor,
    Enemy,
}

impl Default for Target {
    fn default() -> Self {
        Self::Enemy
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardKind {
    Attack,
    Daemon,
    Kernel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GamePhase {
    PlayerTurn,
    BossTurn,
    GameOver,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    Damage {
        track: Track,
        amount: i32,
        #[serde(default)]
        target: Target,
    },
    Heal {
        track: Track,
        amount: i32,
        #[serde(default = "self_target")]
        target: Target,
    },
    GainRam {
        amount: i32,
        #[serde(default = "self_target")]
        target: Target,
    },
    Shield {
        track: Track,
        amount: i32,
        #[serde(default = "self_target")]
        target: Target,
    },
}

fn self_target() -> Target {
    Target::SelfActor
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerWhen {
    SelfTakesHpDamage,
    SelfTakesSanityDamage,
    EnemyPlaysDaemon,
    EnemyPlaysKernel,
    TurnStart,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Trigger {
    pub when: TriggerWhen,
    pub limit: u8,
    #[serde(default)]
    pub used: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Backlash {
    pub effects: Vec<Effect>,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompiledCard {
    pub id: String,
    pub kind: CardKind,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub target: Target,
    pub cost: i32,
    pub effects: Vec<Effect>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub duration: Option<u8>,
    pub trigger: Option<Trigger>,
    pub backlash: Option<Backlash>,
    pub source_prompt: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CharacterState {
    pub id: ActorId,
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub sanity: i32,
    pub max_sanity: i32,
    pub ram: i32,
    pub max_ram: i32,
    pub ram_gain_per_turn: i32,
    pub hp_shield: i32,
    pub sanity_shield: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActiveDaemon {
    pub card: CompiledCard,
    pub remaining_turns: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActiveKernel {
    pub card: CompiledCard,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryState {
    pub cache: Vec<CompiledCard>,
    pub daemons: Vec<ActiveDaemon>,
    pub kernel: Option<ActiveKernel>,
    pub discard: Vec<CompiledCard>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameState {
    pub phase: GamePhase,
    pub turn: u32,
    pub active_actor: ActorId,
    pub player: CharacterState,
    pub boss: CharacterState,
    pub player_memory: MemoryState,
    pub boss_memory: MemoryState,
    pub boss_id: String,
    pub draft: Option<CompiledCard>,
    pub winner: Option<ActorId>,
    pub defeat_reason: Option<String>,
    pub events: Vec<GameEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BossDefinition {
    pub id: String,
    pub name: String,
    pub title: String,
    pub ascii: Vec<String>,
    pub hp: i32,
    pub sanity: i32,
    pub ram_max: i32,
    pub ram_gain_per_turn: i32,
    pub deck: Vec<CompiledCard>,
    pub intro: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GameEvent {
    System {
        turn: u32,
        message: String,
    },
    BossSpoke {
        turn: u32,
        line: String,
    },
    TurnStarted {
        turn: u32,
        actor: ActorId,
    },
    TurnEnded {
        turn: u32,
        actor: ActorId,
    },
    DraftForged {
        turn: u32,
        prompt: String,
        card: CompiledCard,
    },
    DraftRejected {
        turn: u32,
        prompt: String,
        reason: String,
    },
    CardCached {
        turn: u32,
        card_name: String,
    },
    CardPlayed {
        turn: u32,
        actor: ActorId,
        card_name: String,
        cost: i32,
    },
    EffectApplied {
        turn: u32,
        actor: ActorId,
        target: ActorId,
        effect: Effect,
        amount_applied: i32,
    },
    Winner {
        turn: u32,
        winner: ActorId,
        reason: String,
    },
}
