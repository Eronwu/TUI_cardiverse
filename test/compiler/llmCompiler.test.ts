import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compilePromptWithLlm,
  createChatCompletionsRequestBody,
  createOpenAIRequestBody,
  getLlmCompilerConfig,
  normalizeCandidateCard,
  requestOpenAICard,
  resolveChatCompletionsUrl,
  resolveResponsesUrl
} from "../../src/compiler/llmCompiler.js";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalOpenAiModel = process.env.OPENAI_MODEL;
const originalLlmKey = process.env.LLM_API_KEY;
const originalLlmModel = process.env.LLM_MODEL_NAME;
const originalLlmBaseUrl = process.env.LLM_API_BASE_URL;
const originalLlmApiStyle = process.env.LLM_API_STYLE;

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

  if (originalLlmKey === undefined) {
    delete process.env.LLM_API_KEY;
  } else {
    process.env.LLM_API_KEY = originalLlmKey;
  }

  if (originalLlmModel === undefined) {
    delete process.env.LLM_MODEL_NAME;
  } else {
    process.env.LLM_MODEL_NAME = originalLlmModel;
  }

  if (originalLlmBaseUrl === undefined) {
    delete process.env.LLM_API_BASE_URL;
  } else {
    process.env.LLM_API_BASE_URL = originalLlmBaseUrl;
  }

  if (originalLlmApiStyle === undefined) {
    delete process.env.LLM_API_STYLE;
  } else {
    process.env.LLM_API_STYLE = originalLlmApiStyle;
  }
});

describe("llm compiler", () => {
  it("returns unavailable when no LLM key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

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

  it("prefers OpenAI-compatible LLM env vars over OpenAI fallback vars", () => {
    expect(
      getLlmCompilerConfig({
        LLM_API_BASE_URL: "https://agnes.example/v1",
        LLM_API_KEY: "agnes-key",
        LLM_MODEL_NAME: "agnes-model",
        LLM_API_STYLE: "chat_completions",
        OPENAI_API_KEY: "openai-key",
        OPENAI_MODEL: "openai-model"
      })
    ).toEqual({
      apiKey: "agnes-key",
      model: "agnes-model",
      baseUrl: "https://agnes.example/v1",
      apiStyle: "chat_completions"
    });
  });

  it("falls back to native OpenAI env vars", () => {
    expect(
      getLlmCompilerConfig({
        OPENAI_API_KEY: "openai-key",
        OPENAI_MODEL: "openai-model"
      })
    ).toEqual({
      apiKey: "openai-key",
      model: "openai-model",
      baseUrl: "https://api.openai.com/v1",
      apiStyle: "auto"
    });
  });

  it("resolves responses URLs from base URLs", () => {
    expect(resolveResponsesUrl("https://agnes.example/v1")).toBe("https://agnes.example/v1/responses");
    expect(resolveResponsesUrl("https://agnes.example/v1/responses")).toBe("https://agnes.example/v1/responses");
    expect(resolveResponsesUrl("https://agnes.example/v1/")).toBe("https://agnes.example/v1/responses");
    expect(resolveChatCompletionsUrl("https://agnes.example/v1")).toBe("https://agnes.example/v1/chat/completions");
    expect(resolveChatCompletionsUrl("https://agnes.example/v1/chat/completions")).toBe(
      "https://agnes.example/v1/chat/completions"
    );
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
        baseUrl: "https://agnes.example/v1",
        prompt: "thermal spike"
      })
    ).resolves.toMatchObject({
      name: "LLM Spike",
      effects: [{ type: "damage", track: "hp", amount: 12 }]
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://agnes.example/v1/responses",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        })
      })
    );
  });

  it("can force chat completions for OpenAI-compatible providers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: "chat-card",
                  kind: "attack",
                  name: "Chat Spike",
                  description: "Generated through chat completions.",
                  target: "enemy",
                  cost: 2,
                  effects: [{ type: "damage", track: "hp", amount: 11 }],
                  tags: ["chat"]
                })
              }
            }
          ]
        })
      }))
    );

    await expect(
      requestOpenAICard({
        apiKey: "agnes-key",
        model: "agnes-model",
        baseUrl: "https://agnes.example/v1",
        apiStyle: "chat_completions",
        prompt: "thermal spike"
      })
    ).resolves.toMatchObject({
      name: "Chat Spike"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://agnes.example/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer agnes-key"
        })
      })
    );
  });

  it("falls back from responses to chat completions in auto mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        text: async () => "not found"
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: "fallback-card",
                  kind: "attack",
                  name: "Fallback Spike",
                  description: "Generated through fallback.",
                  target: "enemy",
                  cost: 2,
                  effects: [{ type: "damage", track: "hp", amount: 10 }],
                  tags: ["fallback"]
                })
              }
            }
          ]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestOpenAICard({
        apiKey: "agnes-key",
        model: "agnes-model",
        baseUrl: "https://agnes.example/v1",
        apiStyle: "auto",
        prompt: "thermal spike"
      })
    ).resolves.toMatchObject({
      name: "Fallback Spike"
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://agnes.example/v1/responses", expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://agnes.example/v1/chat/completions", expect.anything());
  });

  it("creates a chat completions JSON request body", () => {
    const body = createChatCompletionsRequestBody("agnes-model", "thermal spike") as {
      model: string;
      response_format: { type: string };
      messages: unknown[];
    };

    expect(body.model).toBe("agnes-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toHaveLength(2);
  });

  it("runs LLM output through Zod schema and balance", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL_NAME = "gpt-test";
    process.env.LLM_API_BASE_URL = "https://agnes.example/v1";
    process.env.LLM_API_STYLE = "responses";
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

  it("normalizes common third-party card field variants before Zod validation", () => {
    expect(
      normalizeCandidateCard(
        {
          id: "angel",
          kind: "attack",
          name: "火焰天使",
          description: "毁灭攻击",
          target: "opponent",
          cost: "3",
          effects: [
            {
              type: "attack",
              track: "fire",
              value: 18
            }
          ],
          tags: "fire angel"
        },
        "创建火焰天使，能力毁灭攻击"
      )
    ).toMatchObject({
      id: "angel",
      kind: "attack",
      target: "enemy",
      cost: 3,
      effects: [
        {
          type: "damage",
          track: "hp",
          amount: 18
        }
      ],
      tags: ["fire", "angel"]
    });
  });
});
