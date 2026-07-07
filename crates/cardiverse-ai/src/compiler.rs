use crate::config::{LlmConfig, LlmStyle};
use crate::normalizer::normalize_card_value;
use cardiverse_core::{
    validate_and_balance_card, CardKind, CompiledCard, Effect, Target, Track, Trigger, TriggerWhen,
};
use reqwest::Client;
use serde_json::{json, Value};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompileMode {
    Stub,
    Llm(LlmConfig),
}

#[derive(Debug, Error)]
pub enum AiError {
    #[error("LLM config is missing")]
    MissingConfig,
    #[error("LLM request failed: {0}")]
    Request(String),
    #[error("LLM response did not contain JSON")]
    MissingJson,
    #[error("card validation failed: {0}")]
    Validation(String),
}

pub async fn compile_card(mode: &CompileMode, prompt: &str) -> Result<CompiledCard, AiError> {
    match mode {
        CompileMode::Stub => stub_compile_card(prompt),
        CompileMode::Llm(config) => compile_with_llm(config, prompt).await,
    }
}

pub fn stub_compile_card(prompt: &str) -> Result<CompiledCard, AiError> {
    let lower = prompt.to_lowercase();
    let (kind, effect, tags, description) = if lower.contains("shield") || lower.contains("防御")
    {
        (
            CardKind::Daemon,
            Effect::Shield {
                track: Track::Hp,
                amount: 12,
                target: Target::SelfActor,
            },
            vec!["daemon".into(), "shield".into()],
            "A resident process that keeps a hot shield in memory.",
        )
    } else if lower.contains("sanity") || lower.contains("悖论") || lower.contains("精神") {
        (
            CardKind::Attack,
            Effect::Damage {
                track: Track::Sanity,
                amount: 18,
                target: Target::Enemy,
            },
            vec!["paradox".into()],
            "A paradox packet aimed at the opponent's logic stack.",
        )
    } else if lower.contains("kernel") || lower.contains("trap") || lower.contains("陷阱") {
        (
            CardKind::Kernel,
            Effect::Shield {
                track: Track::Sanity,
                amount: 14,
                target: Target::SelfActor,
            },
            vec!["kernel".into(), "counter".into()],
            "A kernel trap that catches the next logic fracture.",
        )
    } else {
        (
            CardKind::Attack,
            Effect::Damage {
                track: Track::Hp,
                amount: 16,
                target: Target::Enemy,
            },
            vec!["thermal".into()],
            "A compact exploit that turns intent into heat.",
        )
    };

    let mut card = CompiledCard {
        id: String::new(),
        kind,
        name: title_from_prompt(prompt),
        description: description.into(),
        target: Target::Enemy,
        cost: 1,
        effects: vec![effect],
        tags,
        duration: if kind == CardKind::Daemon {
            Some(3)
        } else {
            None
        },
        trigger: if kind == CardKind::Kernel {
            Some(Trigger {
                when: TriggerWhen::SelfTakesSanityDamage,
                limit: 1,
                used: 0,
            })
        } else {
            None
        },
        backlash: None,
        source_prompt: None,
    };
    card = validate_and_balance_card(card, Some(prompt))
        .map_err(|err| AiError::Validation(err.to_string()))?;
    Ok(card)
}

async fn compile_with_llm(config: &LlmConfig, prompt: &str) -> Result<CompiledCard, AiError> {
    let client = Client::new();
    match config.style {
        LlmStyle::Responses => request_responses(&client, config, prompt).await,
        LlmStyle::ChatCompletions => request_chat_completions(&client, config, prompt).await,
        LlmStyle::Auto => match request_responses(&client, config, prompt).await {
            Ok(card) => Ok(card),
            Err(_) => request_chat_completions(&client, config, prompt).await,
        },
    }
}

async fn request_responses(
    client: &Client,
    config: &LlmConfig,
    prompt: &str,
) -> Result<CompiledCard, AiError> {
    let body = json!({
        "model": config.model,
        "input": [
            { "role": "system", "content": system_prompt() },
            { "role": "user", "content": prompt }
        ],
        "text": {
            "format": {
                "type": "json_object"
            }
        }
    });
    let response: Value = client
        .post(format!("{}/responses", config.base_url))
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|err| AiError::Request(err.to_string()))?
        .json()
        .await
        .map_err(|err| AiError::Request(err.to_string()))?;
    let text = response["output_text"]
        .as_str()
        .map(str::to_string)
        .or_else(|| extract_text_from_response_output(&response));
    parse_card_text(text.as_deref(), prompt)
}

async fn request_chat_completions(
    client: &Client,
    config: &LlmConfig,
    prompt: &str,
) -> Result<CompiledCard, AiError> {
    let body = json!({
        "model": config.model,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": system_prompt() },
            { "role": "user", "content": prompt }
        ]
    });
    let response: Value = client
        .post(format!("{}/chat/completions", config.base_url))
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|err| AiError::Request(err.to_string()))?
        .json()
        .await
        .map_err(|err| AiError::Request(err.to_string()))?;
    let text = response["choices"][0]["message"]["content"].as_str();
    parse_card_text(text, prompt)
}

fn parse_card_text(text: Option<&str>, prompt: &str) -> Result<CompiledCard, AiError> {
    let text = text.ok_or(AiError::MissingJson)?;
    let value: Value = serde_json::from_str(text).map_err(|_| AiError::MissingJson)?;
    let normalized = normalize_card_value(value);
    let card: CompiledCard =
        serde_json::from_value(normalized).map_err(|err| AiError::Validation(err.to_string()))?;
    validate_and_balance_card(card, Some(prompt))
        .map_err(|err| AiError::Validation(err.to_string()))
}

fn extract_text_from_response_output(value: &Value) -> Option<String> {
    value["output"]
        .as_array()?
        .iter()
        .flat_map(|item| item["content"].as_array().into_iter().flatten())
        .find_map(|content| content["text"].as_str().map(str::to_string))
}

fn system_prompt() -> &'static str {
    "You compile player intent into one Terminal Cardiverse card JSON only. \
Use fields: id, kind attack|daemon|kernel, name, description, target self|enemy, cost, effects, tags, duration, trigger. \
For duration, use an integer turn count only for daemon cards; omit duration for instant attack cards. \
Effects use type damage|heal|gain_ram|shield, track hp|sanity when relevant, amount number, target self|enemy. \
Do not explain. Output JSON only. Local engine will rebalance everything."
}

fn title_from_prompt(prompt: &str) -> String {
    let words: Vec<String> = prompt
        .split_whitespace()
        .take(3)
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .filter(|word| !word.is_empty())
        .collect();
    if words.is_empty() {
        "Unnamed Exploit".into()
    } else {
        words.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stub_never_needs_env() {
        let card = stub_compile_card("创建火焰天使，能力毁灭攻击").unwrap();
        assert_eq!(card.kind, CardKind::Attack);
        assert!(card.cost > 0);
        assert_eq!(card.effects.len(), 1);
    }

    #[test]
    fn parser_normalizes_dirty_llm_json() {
        let text = r#"{
          "kind":"spell",
          "name":"Fire Angel",
          "description":"burn",
          "target":"opponent",
          "duration":"instant",
          "cost":99,
          "effects":[{"type":"attack","track":"fire","value":40}]
        }"#;
        let card = parse_card_text(Some(text), "fire angel").unwrap();
        assert_eq!(card.target, Target::Enemy);
        assert!(card.cost <= 20);
    }

    #[tokio::test]
    #[ignore = "uses project .env and makes a real LLM request"]
    async fn live_llm_compile_accepts_project_env() {
        let _ = dotenvy::dotenv();
        let config = LlmConfig::from_env().expect("LLM env must be configured");
        let card = compile_card(
            &CompileMode::Llm(config),
            "创建火焰天使，能力是毁灭攻击，立即生效",
        )
        .await
        .expect("live LLM card should normalize and validate");
        assert!(!card.name.is_empty());
        assert!(!card.effects.is_empty());
    }
}
