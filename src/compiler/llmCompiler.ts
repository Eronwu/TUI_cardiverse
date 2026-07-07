import type { Card } from "../core/types.js";
import { balanceCard } from "./balance.js";
import { parseCard } from "./schema.js";
import type { CompileInput, CompileResult } from "./types.js";

const DEFAULT_RESPONSES_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.5";

export type LlmCompilerConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  apiStyle: "responses" | "chat_completions" | "auto";
};

export async function compilePromptWithLlm(input: CompileInput): Promise<CompileResult> {
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return {
      ok: false,
      code: "EMPTY_PROMPT",
      message: "Prompt is empty."
    };
  }

  const config = getLlmCompilerConfig(process.env);
  if (config === undefined) {
    return {
      ok: false,
      code: "COMPILER_UNAVAILABLE",
      message:
        "LLM_API_KEY or OPENAI_API_KEY is not configured. Copy .env.example to .env and set the key."
    };
  }

  try {
    const candidate = await requestOpenAICard({
      ...config,
      prompt
    });
    const parsed = parseCard({
      ...candidate,
      id: candidate.id || `llm-${Date.now()}`,
      sourcePrompt: prompt
    });
    const { card, warnings } = balanceCard({ card: parsed, prompt });

    return {
      ok: true,
      card,
      warnings
    };
  } catch (error) {
    return {
      ok: false,
      code: "CORRUPTED_FILE",
      message: error instanceof Error ? error.message : "LLM compiler produced invalid output."
    };
  }
}

export async function requestOpenAICard(input: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  apiStyle?: LlmCompilerConfig["apiStyle"];
  prompt: string;
}): Promise<Partial<Card>> {
  const baseUrl = input.baseUrl ?? DEFAULT_RESPONSES_BASE_URL;
  const apiStyle = input.apiStyle ?? "auto";

  if (apiStyle === "chat_completions") {
    return requestChatCompletionCard({ ...input, baseUrl });
  }

  try {
    return await requestResponsesCard({ ...input, baseUrl });
  } catch (error) {
    if (apiStyle === "responses") {
      throw error;
    }

    return requestChatCompletionCard({ ...input, baseUrl });
  }
}

async function requestResponsesCard(input: {
  apiKey: string;
  model: string;
  baseUrl: string;
  prompt: string;
}): Promise<Partial<Card>> {
  const response = await fetch(resolveResponsesUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify(createOpenAIRequestBody(input.model, input.prompt))
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text.slice(0, 240)}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const outputText = extractOutputText(payload);
  if (outputText.length === 0) {
    throw new Error("OpenAI response did not contain output text.");
  }

  return JSON.parse(outputText) as Partial<Card>;
}

async function requestChatCompletionCard(input: {
  apiKey: string;
  model: string;
  baseUrl: string;
  prompt: string;
}): Promise<Partial<Card>> {
  const response = await fetch(resolveChatCompletionsUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify(createChatCompletionsRequestBody(input.model, input.prompt))
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat completions request failed: ${response.status} ${text.slice(0, 240)}`);
  }

  const payload = (await response.json()) as ChatCompletionPayload;
  const outputText = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (outputText.length === 0) {
    throw new Error("Chat completions response did not contain message content.");
  }

  return JSON.parse(outputText) as Partial<Card>;
}

export function getLlmCompilerConfig(env: NodeJS.ProcessEnv): LlmCompilerConfig | undefined {
  const apiKey = firstNonEmpty(env.LLM_API_KEY, env.OPENAI_API_KEY);
  if (apiKey === undefined) {
    return undefined;
  }

  return {
    apiKey,
    model: firstNonEmpty(env.LLM_MODEL_NAME, env.OPENAI_MODEL) ?? DEFAULT_MODEL,
    baseUrl: firstNonEmpty(env.LLM_API_BASE_URL, env.OPENAI_API_BASE_URL) ?? DEFAULT_RESPONSES_BASE_URL,
    apiStyle: parseApiStyle(env.LLM_API_STYLE)
  };
}

export function resolveResponsesUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/g, "");

  if (trimmed.endsWith("/responses")) {
    return trimmed;
  }

  return `${trimmed}/responses`;
}

export function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/g, "");

  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  return `${trimmed}/chat/completions`;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0)?.trim();
}

function parseApiStyle(value: string | undefined): LlmCompilerConfig["apiStyle"] {
  if (value === "responses" || value === "chat_completions") {
    return value;
  }

  return "auto";
}

export function createOpenAIRequestBody(model: string, prompt: string): unknown {
  return {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are the Terminal Cardiverse card compiler.",
              "Convert the player prompt into one bounded card JSON object.",
              "Do not decide battle results.",
              "Do not include markdown.",
              "Never create instant kill, infinite resources, rule mutation, or immunity.",
              "If the prompt asks for excessive power, create a bounded effect and optional backlash."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "terminal_cardiverse_card",
        strict: true,
        schema: cardJsonSchema()
      }
    }
  };
}

export function createChatCompletionsRequestBody(model: string, prompt: string): unknown {
  return {
    model,
    messages: [
      {
        role: "system",
        content: [
          "You are the Terminal Cardiverse card compiler.",
          "Convert the player prompt into one bounded card JSON object.",
          "Return JSON only, no markdown.",
          "Required fields: id, kind, name, description, target, cost, effects, tags.",
          "Allowed kind: attack, daemon, kernel.",
          "Allowed effect types: damage, heal, gain_ram, shield.",
          "Never create instant kill, infinite resources, rule mutation, or immunity."
        ].join(" ")
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2
  };
}

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type ChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function cardJsonSchema(): Record<string, unknown> {
  const target = { type: "string", enum: ["self", "enemy"] };
  const track = { type: "string", enum: ["hp", "sanity"] };

  const effect = {
    anyOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "track", "amount"],
        properties: {
          type: { const: "damage" },
          track,
          amount: { type: "integer", minimum: 1 },
          target
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "track", "amount"],
        properties: {
          type: { const: "heal" },
          track,
          amount: { type: "integer", minimum: 1 },
          target
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "amount"],
        properties: {
          type: { const: "gain_ram" },
          amount: { type: "integer", minimum: 1 },
          target
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "track", "amount"],
        properties: {
          type: { const: "shield" },
          track,
          amount: { type: "integer", minimum: 1 },
          target
        }
      }
    ]
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "kind", "name", "description", "target", "cost", "effects", "tags"],
    properties: {
      id: { type: "string" },
      kind: { type: "string", enum: ["attack", "daemon", "kernel"] },
      name: { type: "string" },
      description: { type: "string" },
      target,
      cost: { type: "integer", minimum: 1 },
      effects: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: effect
      },
      tags: {
        type: "array",
        items: { type: "string" }
      },
      duration: { type: "integer", minimum: 1 },
      trigger: {
        type: "object",
        additionalProperties: false,
        required: ["when", "limit"],
        properties: {
          when: {
            type: "string",
            enum: [
              "self_takes_hp_damage",
              "self_takes_sanity_damage",
              "enemy_plays_daemon",
              "enemy_plays_kernel",
              "turn_start"
            ]
          },
          limit: { type: "integer", minimum: 1 }
        }
      },
      backlash: {
        type: "object",
        additionalProperties: false,
        required: ["effects", "reason"],
        properties: {
          effects: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: effect
          },
          reason: { type: "string" }
        }
      }
    }
  };
}
