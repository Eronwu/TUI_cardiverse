import { afterEach, describe, expect, it, vi } from "vitest";
import { compilePromptWithLlm, createOpenAIRequestBody, requestOpenAICard } from "../../src/compiler/llmCompiler.js";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalOpenAiModel = process.env.OPENAI_MODEL;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  if (originalOpenAiModel === undefined) {
    delete process.env.OPENAI_MODEL;
  } else {
    process.env.OPENAI_MODEL = originalOpenAiModel;
  }
});

describe("llm compiler", () => {
  it("returns unavailable when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      compilePromptWithLlm({
        prompt: "thermal spike",
        actor: "player",
        turn: 1,
        mode: "llm"
      })
    ).resolves.toMatchObject({
      ok: false,
      code: "COMPILER_UNAVAILABLE"
    });
  });

  it("creates an OpenAI structured output request body", () => {
    const body = createOpenAIRequestBody("gpt-test", "thermal spike") as {
      model: string;
      text: { format: { type: string; name: string; strict: boolean } };
    };

    expect(body.model).toBe("gpt-test");
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      name: "terminal_cardiverse_card",
      strict: true
    });
  });

  it("parses OpenAI output text into a candidate card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            id: "llm-test-card",
            kind: "attack",
            name: "LLM Spike",
            description: "Generated attack.",
            target: "enemy",
            cost: 2,
            effects: [{ type: "damage", track: "hp", amount: 12 }],
            tags: ["llm"]
          })
        })
      }))
    );

    await expect(
      requestOpenAICard({
        apiKey: "test-key",
        model: "gpt-test",
        prompt: "thermal spike"
      })
    ).resolves.toMatchObject({
      name: "LLM Spike",
      effects: [{ type: "damage", track: "hp", amount: 12 }]
    });
  });

  it("runs LLM output through Zod schema and balance", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            id: "llm-overpowered",
            kind: "attack",
            name: "Too Much",
            description: "Generated attack.",
            target: "enemy",
            cost: 1,
            effects: [{ type: "damage", track: "hp", amount: 99 }],
            tags: ["llm"]
          })
        })
      }))
    );

    const result = await compilePromptWithLlm({
      prompt: "destroy it",
      actor: "player",
      turn: 1,
      mode: "llm"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.effects[0]).toMatchObject({ type: "damage", amount: 30 });
      expect(result.card.backlash).toBeDefined();
      expect(result.warnings).toContain("BALANCE: damage clamped to 30.");
    }
  });
});
