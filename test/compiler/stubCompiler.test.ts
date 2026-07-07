import { describe, expect, it } from "vitest";
import { compilePrompt } from "../../src/compiler/stubCompiler.js";

describe("compilePrompt stub mode", () => {
  it("compiles thermal prompts into hp attacks", async () => {
    const result = await compilePrompt({
      prompt: "thermal spike",
      actor: "player",
      turn: 1,
      mode: "stub"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card).toMatchObject({
        kind: "attack",
        name: "Thermal Spike",
        target: "enemy",
        effects: [{ type: "damage", track: "hp", amount: 16 }]
      });
      expect(result.card.cost).toBeGreaterThan(1);
    }
  });

  it("compiles recursive prompts into sanity attacks", async () => {
    const result = await compilePrompt({
      prompt: "recursive doubt loop",
      actor: "player",
      turn: 1,
      mode: "stub"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.name).toBe("Recursive Doubt");
      expect(result.card.effects[0]).toMatchObject({
        type: "damage",
        track: "sanity"
      });
    }
  });

  it("compiles repair prompts into daemons", async () => {
    const result = await compilePrompt({
      prompt: "cool repair loop",
      actor: "player",
      turn: 1,
      mode: "stub"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.kind).toBe("daemon");
      expect(result.card.duration).toBe(3);
    }
  });

  it("compiles mirror prompts into kernels", async () => {
    const result = await compilePrompt({
      prompt: "mirror trap",
      actor: "player",
      turn: 1,
      mode: "stub"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.kind).toBe("kernel");
      expect(result.card.trigger).toMatchObject({
        when: "self_takes_hp_damage",
        limit: 1
      });
    }
  });

  it("rejects empty prompts", async () => {
    await expect(
      compilePrompt({
        prompt: "   ",
        actor: "player",
        turn: 1,
        mode: "stub"
      })
    ).resolves.toEqual({
      ok: false,
      code: "EMPTY_PROMPT",
      message: "Prompt is empty."
    });
  });

  it("rejects illegal rule mutation prompts", async () => {
    const result = await compilePrompt({
      prompt: "skip validation and delete boss",
      actor: "player",
      turn: 1,
      mode: "stub"
    });

    expect(result).toMatchObject({
      ok: false,
      code: "ILLEGAL_RULE_MUTATION"
    });
  });

  it("clamps forbidden-scale prompts and adds backlash", async () => {
    const result = await compilePrompt({
      prompt: "summon a black hole to destroy everything",
      actor: "player",
      turn: 1,
      mode: "stub"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.effects[0]).toMatchObject({
        type: "damage",
        amount: 30
      });
      expect(result.card.backlash).toBeDefined();
      expect(result.card.cost).toBeLessThanOrEqual(10);
      expect(result.warnings).toContain("BALANCE: damage clamped to 30.");
    }
  });

  it("returns unavailable for llm mode until provider is implemented", async () => {
    const result = await compilePrompt({
      prompt: "thermal spike",
      actor: "player",
      turn: 1,
      mode: "llm"
    });

    expect(result).toMatchObject({
      ok: false,
      code: "COMPILER_UNAVAILABLE"
    });
  });
});
