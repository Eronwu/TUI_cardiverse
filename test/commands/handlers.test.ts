import { describe, expect, it } from "vitest";
import { handleCommand } from "../../src/commands/handlers.js";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { createGameState } from "../../src/core/state.js";

describe("handleCommand", () => {
  it("compiles prompt into player cache", async () => {
    const result = await handleCommand({
      command: { type: "compile", prompt: "thermal spike" },
      state: createGameState(initEcho),
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(result.state.playerMemory.cache).toHaveLength(1);
    expect(result.state.playerMemory.cache[0]?.name).toBe("Thermal Spike");
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
      command: { type: "play", cacheIndex: 0 },
      state: compiled.state,
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(played.state.boss.hp).toBe(104);
    expect(played.state.playerMemory.discard[0]?.name).toBe("Thermal Spike");
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
});
