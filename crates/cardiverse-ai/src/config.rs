use std::env;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmStyle {
    Auto,
    Responses,
    ChatCompletions,
}

impl LlmStyle {
    pub fn from_env_value(value: Option<String>) -> Self {
        match value.as_deref() {
            Some("responses") => Self::Responses,
            Some("chat_completions") => Self::ChatCompletions,
            _ => Self::Auto,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LlmConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub style: LlmStyle,
}

impl LlmConfig {
    pub fn from_env() -> Option<Self> {
        let api_key = env::var("LLM_API_KEY")
            .or_else(|_| env::var("OPENAI_API_KEY"))
            .ok()?;
        let base_url = env::var("LLM_API_BASE_URL")
            .or_else(|_| env::var("OPENAI_API_BASE_URL"))
            .unwrap_or_else(|_| "https://api.openai.com/v1".into());
        let model = env::var("LLM_MODEL_NAME")
            .or_else(|_| env::var("OPENAI_MODEL"))
            .unwrap_or_else(|_| "gpt-4.1-mini".into());
        let style = LlmStyle::from_env_value(env::var("LLM_API_STYLE").ok());
        Some(Self {
            base_url: base_url.trim_end_matches('/').into(),
            api_key,
            model,
            style,
        })
    }
}
