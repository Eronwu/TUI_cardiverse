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
    const normalized = normalizeCandidateCard(candidate, prompt);
    const parsed = parseCard(normalized);
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
      message: formatCompilerError(error)
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
          "Use exact target values only: self or enemy.",
          "Allowed kind values only: attack, daemon, kernel.",
          "Allowed effect type values only: damage, heal, gain_ram, shield.",
          "For damage/heal/shield effects, use exact track values only: hp or sanity.",
          "Use amount for effect numbers, never value.",
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

export function normalizeCandidateCard(candidate: unknown, prompt: string): unknown {
  const raw = isRecord(candidate) ? candidate : {};
  const effects = normalizeEffects(raw.effects, prompt);
  const kind = normalizeKind(raw.kind, raw, effects);

  return {
    id: stringOr(raw.id, `llm-${Date.now()}`),
    kind,
    name: stringOr(raw.name, "Compiled Intent"),
    description: stringOr(raw.description, "A bounded compiled instruction."),
    target: normalizeTarget(raw.target, kind === "attack" ? "enemy" : "self"),
    cost: numberOr(raw.cost, 1),
    effects,
    tags: normalizeTags(raw.tags),
    ...(kind === "daemon" ? { duration: numberOr(raw.duration, 2) } : {}),
    ...(kind === "kernel" ? { trigger: normalizeTrigger(raw.trigger) } : {}),
    ...(isRecord(raw.backlash) ? { backlash: normalizeBacklash(raw.backlash, prompt) } : {}),
    sourcePrompt: prompt
  };
}

function normalizeEffects(value: unknown, prompt: string): unknown[] {
  const rawEffects = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  const effects = rawEffects.map((effect) => normalizeEffect(effect, prompt)).filter((effect) => effect !== undefined);

  return effects.length > 0 ? effects : [{ type: "damage", track: inferTrackFromPrompt(prompt), amount: 8 }];
}

function normalizeEffect(effect: unknown, prompt: string): Record<string, unknown> | undefined {
  if (!isRecord(effect)) {
    return undefined;
  }

  const type = normalizeEffectType(effect.type);
  const amount = numberOr(effect.amount ?? effect.value ?? effect.power ?? effect.damage ?? effect.heal ?? effect.shield, 8);
  const target = normalizeTarget(effect.target, undefined);

  if (type === "gain_ram") {
    return {
      type,
      amount,
      ...(target !== undefined ? { target } : {})
    };
  }

  const track = normalizeTrack(effect.track ?? effect.attribute ?? effect.stat ?? effect.damageType, inferTrackFromPrompt(prompt));

  return {
    type,
    track,
    amount,
    ...(target !== undefined ? { target } : {})
  };
}

function normalizeKind(value: unknown, raw: Record<string, unknown>, effects: unknown[]): "attack" | "daemon" | "kernel" {
  const kind = String(value ?? "").toLowerCase();
  if (kind === "attack" || kind === "daemon" || kind === "kernel") {
    return kind;
  }

  if (isRecord(raw.trigger)) {
    return "kernel";
  }

  const hasSupportEffect = effects.some((effect) => {
    if (!isRecord(effect)) {
      return false;
    }

    return effect.type === "heal" || effect.type === "shield" || effect.type === "gain_ram";
  });

  return hasSupportEffect ? "daemon" : "attack";
}

function normalizeEffectType(value: unknown): "damage" | "heal" | "gain_ram" | "shield" {
  const type = String(value ?? "").toLowerCase();
  if (type === "damage" || type === "attack" || type === "harm" || type === "destroy") {
    return "damage";
  }
  if (type === "heal" || type === "repair" || type === "restore") {
    return "heal";
  }
  if (type === "gain_ram" || type === "ram" || type === "resource") {
    return "gain_ram";
  }
  if (type === "shield" || type === "armor" || type === "barrier" || type === "defense") {
    return "shield";
  }

  return "damage";
}

function normalizeTarget(value: unknown, fallback: "self" | "enemy" | undefined): "self" | "enemy" | undefined {
  const target = String(value ?? "").toLowerCase();
  if (target === "self" || target === "player" || target === "owner" || target === "me") {
    return "self";
  }
  if (
    target === "enemy" ||
    target === "boss" ||
    target === "opponent" ||
    target === "target" ||
    target === "foe"
  ) {
    return "enemy";
  }

  return fallback;
}

function normalizeTrack(value: unknown, fallback: "hp" | "sanity"): "hp" | "sanity" {
  const track = String(value ?? "").toLowerCase();
  if (
    track === "hp" ||
    track === "health" ||
    track === "life" ||
    track === "body" ||
    track === "physical" ||
    track === "fire" ||
    track === "thermal"
  ) {
    return "hp";
  }
  if (
    track === "sanity" ||
    track === "mind" ||
    track === "logic" ||
    track === "mental" ||
    track === "paradox"
  ) {
    return "sanity";
  }

  return fallback;
}

function inferTrackFromPrompt(prompt: string): "hp" | "sanity" {
  const lower = prompt.toLowerCase();
  return lower.includes("sanity") ||
    lower.includes("logic") ||
    lower.includes("paradox") ||
    lower.includes("心智") ||
    lower.includes("逻辑") ||
    lower.includes("悖论")
    ? "sanity"
    : "hp";
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return ["llm"];
}

function normalizeTrigger(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return {
      when: stringOr(value.when, "self_takes_hp_damage"),
      limit: numberOr(value.limit, 1)
    };
  }

  return {
    when: "self_takes_hp_damage",
    limit: 1
  };
}

function normalizeBacklash(value: Record<string, unknown>, prompt: string): Record<string, unknown> {
  return {
    reason: stringOr(value.reason, "LLM requested high-risk effect."),
    effects: normalizeEffects(value.effects, prompt)
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.round(parsed));
    }
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatCompilerError(error: unknown): string {
  if (isRecord(error) && Array.isArray(error.issues)) {
    const paths = error.issues
      .map((issue) => (isRecord(issue) && Array.isArray(issue.path) ? issue.path.join(".") : "unknown"))
      .join(", ");
    return `Schema validation failed at: ${paths}`;
  }

  return error instanceof Error ? error.message : "LLM compiler produced invalid output.";
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
