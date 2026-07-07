import type { Card } from "../core/types.js";
import { balanceCard } from "./balance.js";
import { parseCard } from "./schema.js";
import type { CompileInput, CompileResult } from "./types.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function compilePromptWithLlm(input: CompileInput): Promise<CompileResult> {
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return {
      ok: false,
      code: "EMPTY_PROMPT",
      message: "Prompt is empty."
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return {
      ok: false,
      code: "COMPILER_UNAVAILABLE",
      message: "OPENAI_API_KEY is not configured. Copy .env.example to .env and set the key."
    };
  }

  try {
    const candidate = await requestOpenAICard({
      apiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-5.5",
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
  prompt: string;
}): Promise<Partial<Card>> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
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

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
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
