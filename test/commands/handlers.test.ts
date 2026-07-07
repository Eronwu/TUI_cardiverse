import { describe, expect, it } from "vitest";
import { handleCommand } from "../../src/commands/handlers.js";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { createGameState } from "../../src/core/state.js";

describe("handleCommand", () => {
  it("compiles prompt into a draft card", async () => {
    const result = await handleCommand({
      command: { type: "compile", prompt: "thermal spike" },
      state: createGameState(initEcho),
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(result.state.draft?.name).toBe("Thermal Spike");
    expect(result.state.playerMemory.cache).toHaveLength(0);
    expect(result.state.logs.some((log) => log.type === "compile" && log.success)).toBe(true);
  });

  it("plays a compiled attack card", async () => {
    const compiled = await handleCommand({
      command: { type: "compile", prompt: "thermal spike" },
      state: {
        ...createGameState(initEcho),
        player: { ...createGameState(initEcho).player, ram: 10 }
      },
      boss: initEcho,
      compilerMode: "stub"
    });
    const played = await handleCommand({
      command: { type: "use_draft" },
      state: compiled.state,
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(played.state.boss.hp).toBe(104);
    expect(played.state.playerMemory.discard[0]?.name).toBe("Thermal Spike");
  });

  it("can cache and discard draft cards", async () => {
    const compiled = await handleCommand({
      command: { type: "compile", prompt: "thermal spike" },
      state: createGameState(initEcho),
      boss: initEcho,
      compilerMode: "stub"
    });
    const cached = await handleCommand({
      command: { type: "cache_draft" },
      state: compiled.state,
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(cached.state.draft).toBeUndefined();
    expect(cached.state.playerMemory.cache[0]?.name).toBe("Thermal Spike");

    const recompiled = await handleCommand({
      command: { type: "compile", prompt: "recursive doubt" },
      state: cached.state,
      boss: initEcho,
      compilerMode: "stub"
    });
    const discarded = await handleCommand({
      command: { type: "discard_draft" },
      state: recompiled.state,
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(discarded.state.draft).toBeUndefined();
    expect(discarded.state.playerMemory.cache).toHaveLength(1);
  });

  it("ends turn and lets boss act", async () => {
    const result = await handleCommand({
      command: { type: "end" },
      state: createGameState(initEcho),
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(result.state.turn).toBe(2);
    expect(result.state.player.hp).toBe(90);
  });

  it("restarts the game", async () => {
    const result = await handleCommand({
      command: { type: "restart" },
      state: {
        ...createGameState(initEcho),
        turn: 99
      },
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(result.state.turn).toBe(1);
    expect(result.state.boss.hp).toBe(120);
  });

  it("shows an AI suggestion without changing battle state", async () => {
    const state = createGameState(initEcho);
    const result = await handleCommand({
      command: { type: "suggest" },
      state,
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(result.state.player).toEqual(state.player);
    expect(result.state.boss).toEqual(state.boss);
    expect(result.state.logs.at(-1)).toMatchObject({
      type: "system",
      message: expect.stringContaining("AI SUGGEST:")
    });
  });

  it("runs an AI controlled turn", async () => {
    const result = await handleCommand({
      command: { type: "auto_turn" },
      state: createGameState(initEcho),
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(result.state.turn).toBeGreaterThanOrEqual(2);
    expect(result.state.logs.some((log) => log.type === "compile" && log.success)).toBe(true);
  });
});
