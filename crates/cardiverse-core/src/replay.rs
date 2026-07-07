use crate::types::GameEvent;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BattleReplay {
    pub version: u16,
    pub boss_id: String,
    pub events: Vec<GameEvent>,
}

impl BattleReplay {
    pub fn new(boss_id: impl Into<String>, events: Vec<GameEvent>) -> Self {
        Self {
            version: 1,
            boss_id: boss_id.into(),
            events,
        }
    }

    pub fn to_pretty_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    pub fn from_json(input: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(input)
    }
}
