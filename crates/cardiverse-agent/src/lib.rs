use anyhow::{anyhow, Result};
use cardiverse_ai::{compile_card, CompileMode};
use cardiverse_core::{
    apply_action, init_echo, legal_actions, new_game, ActorId, BattleReplay, CardKind, GameEvent,
    GamePhase, GameState, LegalAction, PlayerAction,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentPolicy {
    Rule,
    Llm,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentObservation {
    pub turn: u32,
    pub phase: GamePhase,
    pub state: GameState,
    pub legal_actions: Vec<AgentLegalAction>,
    pub recent_events: Vec<GameEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentLegalAction {
    Forge,
    UseDraft,
    CacheDraft,
    DiscardDraft,
    PlayCache { index: usize },
    MountDaemon { index: usize },
    ArmKernel { index: usize },
    EndTurn,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentAction {
    Forge { prompt: String },
    UseDraft,
    CacheDraft,
    DiscardDraft,
    PlayCache { index: usize },
    MountDaemon { index: usize },
    ArmKernel { index: usize },
    EndTurn,
    Restart,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentDecision {
    pub action: AgentAction,
    pub reason: String,
    pub expected_gain: String,
    pub risk: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentTraceEntry {
    pub step: u32,
    pub observation: AgentObservation,
    pub decision: AgentDecision,
    pub events: Vec<GameEvent>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlaytestIssue {
    pub category: String,
    pub priority: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlaytestReport {
    pub winner: Option<ActorId>,
    pub turns: u32,
    pub steps: u32,
    pub forged_cards: usize,
    pub failed_actions: usize,
    pub player_cards_played: usize,
    pub boss_cards_played: usize,
    pub issues: Vec<PlaytestIssue>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlaytestArtifacts {
    pub replay: BattleReplay,
    pub trace: Vec<AgentTraceEntry>,
    pub report: PlaytestReport,
    pub issue_markdown: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentProtocolOut {
    State {
        state: GameState,
        legal_actions: Vec<AgentLegalAction>,
    },
    Events {
        events: Vec<GameEvent>,
    },
    Error {
        message: String,
    },
    GameOver {
        report: PlaytestReport,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentProtocolIn {
    Action { action: AgentAction, reason: String },
}

pub fn observe(state: &GameState) -> AgentObservation {
    AgentObservation {
        turn: state.turn,
        phase: state.phase,
        state: state.clone(),
        legal_actions: legal_actions(state)
            .into_iter()
            .map(AgentLegalAction::from)
            .collect(),
        recent_events: state.events.iter().rev().take(8).cloned().collect(),
    }
}

pub fn decide(policy: AgentPolicy, observation: &AgentObservation) -> AgentDecision {
    let state = &observation.state;
    if state.phase == GamePhase::GameOver {
        return decision(
            AgentAction::EndTurn,
            "game is already over",
            "no further action",
            "none",
        );
    }

    if let Some(draft) = &state.draft {
        if state.player.ram >= draft.cost {
            return decision(
                AgentAction::UseDraft,
                "draft is legal and preserves tempo",
                format!("execute {} for immediate pressure", draft.name),
                "may spend too much RAM before seeing the boss response",
            );
        }
        if state.player_memory.cache.len() < 5 {
            return decision(
                AgentAction::CacheDraft,
                "draft is too expensive this turn, but cache has room",
                "save the card for a later RAM window",
                "cache pressure may block future generated cards",
            );
        }
        return decision(
            AgentAction::DiscardDraft,
            "draft cannot be used and cache is full",
            "free the draft lane",
            "wastes the generated card",
        );
    }

    if let Some(action) = best_cache_action(state) {
        return action;
    }

    if state.player_memory.cache.len() < 5 && state.player.ram >= 3 {
        let prompt = match policy {
            AgentPolicy::Rule => "thermal spike with clean hp damage",
            AgentPolicy::Llm => "创建一个立即生效的终端攻击卡，造成稳定 HP 伤害，低 RAM 消耗",
        };
        return decision(
            AgentAction::Forge {
                prompt: prompt.into(),
            },
            "no strong cached play is available, so create a new tactical option",
            "convert natural language intent into a validated draft",
            "LLM output may normalize into a weaker card",
        );
    }

    decision(
        AgentAction::EndTurn,
        "no high-value legal action is available",
        "bank the next RAM pulse and let daemons tick",
        "boss receives a full response turn",
    )
}

pub async fn execute_agent_action(
    state: &mut GameState,
    action: AgentAction,
    compile_mode: &CompileMode,
) -> Result<Vec<GameEvent>> {
    let player_action = match action {
        AgentAction::Forge { prompt } => {
            let card = compile_card(compile_mode, &prompt)
                .await
                .map_err(|err| anyhow!("compiler failed: {err}"))?;
            PlayerAction::ForgeDraft { prompt, card }
        }
        AgentAction::UseDraft => PlayerAction::UseDraft,
        AgentAction::CacheDraft => PlayerAction::CacheDraft,
        AgentAction::DiscardDraft => PlayerAction::DiscardDraft,
        AgentAction::PlayCache { index } => PlayerAction::PlayCache { index },
        AgentAction::MountDaemon { index } => PlayerAction::MountDaemon { index },
        AgentAction::ArmKernel { index } => PlayerAction::ArmKernel { index },
        AgentAction::EndTurn => PlayerAction::EndTurn,
        AgentAction::Restart => PlayerAction::Restart,
    };
    apply_action(state, player_action).map_err(|err| anyhow!("action rejected: {err}"))
}

pub async fn run_playtest(
    policy: AgentPolicy,
    compile_mode: CompileMode,
    max_steps: u32,
) -> PlaytestArtifacts {
    let boss = init_echo();
    let mut state = new_game(&boss);
    let mut trace = Vec::new();
    let mut failed_actions = 0usize;

    for step in 1..=max_steps {
        if state.phase == GamePhase::GameOver {
            break;
        }
        let observation = observe(&state);
        let decision = decide(policy, &observation);
        let result = execute_agent_action(&mut state, decision.action.clone(), &compile_mode).await;
        let (events, error) = match result {
            Ok(events) => (events, None),
            Err(err) => {
                failed_actions += 1;
                (Vec::new(), Some(err.to_string()))
            }
        };
        trace.push(AgentTraceEntry {
            step,
            observation,
            decision,
            events,
            error,
        });
    }

    let replay = BattleReplay::new(state.boss_id.clone(), state.events.clone());
    let report = build_report(&state, &trace, failed_actions);
    let issue_markdown = issue_markdown(&report, "replay.json");
    PlaytestArtifacts {
        replay,
        trace,
        report,
        issue_markdown,
    }
}

pub fn build_report(
    state: &GameState,
    trace: &[AgentTraceEntry],
    failed_actions: usize,
) -> PlaytestReport {
    let forged_cards = state
        .events
        .iter()
        .filter(|event| matches!(event, GameEvent::DraftForged { .. }))
        .count();
    let player_cards_played = state
        .events
        .iter()
        .filter(|event| {
            matches!(
                event,
                GameEvent::CardPlayed {
                    actor: ActorId::Player,
                    ..
                }
            )
        })
        .count();
    let boss_cards_played = state
        .events
        .iter()
        .filter(|event| {
            matches!(
                event,
                GameEvent::CardPlayed {
                    actor: ActorId::Boss,
                    ..
                }
            )
        })
        .count();

    let mut issues = Vec::new();
    if trace.len() >= 25 && state.phase != GamePhase::GameOver {
        issues.push(issue(
            "gameplay",
            "P1",
            "Playtest hit the step limit before a winner; pacing may be too slow.",
        ));
    }
    if failed_actions > 0 {
        issues.push(issue(
            "agent",
            "P1",
            "At least one agent action was rejected by the core engine.",
        ));
    }
    if forged_cards > 8 {
        issues.push(issue(
            "ai_card_generation",
            "P2",
            "The agent forged many cards; cache pressure or card value clarity may be weak.",
        ));
    }
    if boss_cards_played > player_cards_played + 3 {
        issues.push(issue(
            "balance",
            "P2",
            "Boss acted far more often than the player; RAM or card costs may feel punitive.",
        ));
    }
    if issues.is_empty() {
        issues.push(issue(
            "gameplay",
            "P3",
            "No blocking issue found in this automated run; inspect replay for qualitative pacing.",
        ));
    }

    PlaytestReport {
        winner: state.winner,
        turns: state.turn,
        steps: trace.len() as u32,
        forged_cards,
        failed_actions,
        player_cards_played,
        boss_cards_played,
        suggestions: vec![
            "Review whether the first three turns create a clear tactical fork.".into(),
            "Check if draft cards are readable enough to choose execute vs cache quickly.".into(),
            "Compare player and boss card-play counts before changing damage numbers.".into(),
        ],
        issues,
    }
}

pub fn issue_markdown(report: &PlaytestReport, replay_path: &str) -> String {
    let mut output = String::new();
    output.push_str("# Agent Playtest Issue\n\n");
    output.push_str(&format!("- Winner: {:?}\n", report.winner));
    output.push_str(&format!("- Turns: {}\n", report.turns));
    output.push_str(&format!("- Steps: {}\n", report.steps));
    output.push_str(&format!("- Forged cards: {}\n", report.forged_cards));
    output.push_str(&format!("- Failed actions: {}\n", report.failed_actions));
    output.push_str(&format!("- Replay: `{replay_path}`\n\n"));

    output.push_str("## 游戏性问题\n\n");
    push_issue_section(&mut output, report, "gameplay");
    output.push_str("## UI/可读性问题\n\n");
    output.push_str(
        "- P2: Review the replay to confirm the current action and selected card are obvious.\n\n",
    );
    output.push_str("## AI 造卡问题\n\n");
    push_issue_section(&mut output, report, "ai_card_generation");
    output.push_str("## 平衡问题\n\n");
    push_issue_section(&mut output, report, "balance");
    output.push_str("## 建议优先级\n\n");
    for suggestion in &report.suggestions {
        output.push_str(&format!("- {suggestion}\n"));
    }
    output
}

impl From<LegalAction> for AgentLegalAction {
    fn from(action: LegalAction) -> Self {
        match action {
            LegalAction::Forge => Self::Forge,
            LegalAction::UseDraft => Self::UseDraft,
            LegalAction::CacheDraft => Self::CacheDraft,
            LegalAction::DiscardDraft => Self::DiscardDraft,
            LegalAction::PlayCache(index) => Self::PlayCache { index },
            LegalAction::MountDaemon(index) => Self::MountDaemon { index },
            LegalAction::ArmKernel(index) => Self::ArmKernel { index },
            LegalAction::EndTurn => Self::EndTurn,
        }
    }
}

fn best_cache_action(state: &GameState) -> Option<AgentDecision> {
    let mut best_attack: Option<(usize, i32, String)> = None;
    for (index, card) in state.player_memory.cache.iter().enumerate() {
        if card.cost > state.player.ram {
            continue;
        }
        match card.kind {
            CardKind::Attack => {
                let damage = card
                    .effects
                    .iter()
                    .map(|effect| match effect {
                        cardiverse_core::Effect::Damage { amount, .. } => *amount,
                        _ => 0,
                    })
                    .sum();
                if best_attack
                    .as_ref()
                    .map(|(_, current, _)| damage > *current)
                    .unwrap_or(true)
                {
                    best_attack = Some((index, damage, card.name.clone()));
                }
            }
            CardKind::Daemon if state.player_memory.daemons.len() < 2 => {
                return Some(decision(
                    AgentAction::MountDaemon { index },
                    format!(
                        "mount {} because recurring effects improve tempo",
                        card.name
                    ),
                    "convert one action into multiple future ticks",
                    "delayed value may be too slow under pressure",
                ));
            }
            CardKind::Kernel if state.player_memory.kernel.is_none() => {
                return Some(decision(
                    AgentAction::ArmKernel { index },
                    format!("arm {} because no kernel is active", card.name),
                    "prepare a defensive response window",
                    "may spend RAM without immediate pressure",
                ));
            }
            _ => {}
        }
    }

    best_attack.map(|(index, damage, name)| {
        decision(
            AgentAction::PlayCache { index },
            format!("play {name} because it is the best available attack"),
            format!("apply roughly {damage} damage before boss turn"),
            "spends cache resources and may leave no follow-up",
        )
    })
}

fn decision(
    action: AgentAction,
    reason: impl Into<String>,
    expected_gain: impl Into<String>,
    risk: impl Into<String>,
) -> AgentDecision {
    AgentDecision {
        action,
        reason: reason.into(),
        expected_gain: expected_gain.into(),
        risk: risk.into(),
    }
}

fn issue(category: &str, priority: &str, message: &str) -> PlaytestIssue {
    PlaytestIssue {
        category: category.into(),
        priority: priority.into(),
        message: message.into(),
    }
}

fn push_issue_section(output: &mut String, report: &PlaytestReport, category: &str) {
    let matching = report
        .issues
        .iter()
        .filter(|issue| issue.category == category)
        .collect::<Vec<_>>();
    if matching.is_empty() {
        output.push_str("- No issue detected in this category.\n\n");
        return;
    }
    for issue in matching {
        output.push_str(&format!("- {}: {}\n", issue.priority, issue.message));
    }
    output.push('\n');
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rule_policy_completes_report_without_env() {
        let artifacts = run_playtest(AgentPolicy::Rule, CompileMode::Stub, 12).await;
        assert!(!artifacts.trace.is_empty());
        assert!(artifacts.issue_markdown.contains("Agent Playtest Issue"));
        assert_eq!(artifacts.report.failed_actions, 0);
    }

    #[tokio::test]
    async fn illegal_external_action_is_rejected_by_core() {
        let mut state = new_game(&init_echo());
        let result = execute_agent_action(
            &mut state,
            AgentAction::PlayCache { index: 99 },
            &CompileMode::Stub,
        )
        .await;
        assert!(result.is_err());
    }
}
