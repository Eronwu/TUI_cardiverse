import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { createGameState } from "../../src/core/state.js";

describe("createGameState", () => {
  it("creates the initial player turn state", () => {
    const state = createGameState(initEcho);

    expect(state.phase).toBe("player_turn");
    expect(state.turn).toBe(1);
    expect(state.activeActor).toBe("player");
    expect(state.bossId).toBe("init-echo");
    expect(state.winner).toBeUndefined();
  });

  it("creates the player with MVP baseline stats", () => {
    const state = createGameState(initEcho);

    expect(state.player).toMatchObject({
      id: "player",
      name: "Code Walker",
      hp: 100,
      maxHp: 100,
      sanity: 100,
      maxSanity: 100,
      ram: 0,
      maxRam: 20,
      ramGainPerTurn: 10,
      shields: {
        hp: 0,
        sanity: 0
      }
    });
  });

  it("creates the boss from the boss definition", () => {
    const state = createGameState(initEcho);

    expect(state.boss).toMatchObject({
      id: "boss",
      name: "INIT ECHO",
      hp: 120,
      maxHp: 120,
      sanity: 90,
      maxSanity: 90,
      ram: 0,
      maxRam: 18,
      ramGainPerTurn: 8
    });
  });

  it("starts with empty memory zones", () => {
    const state = createGameState(initEcho);

    expect(state.playerMemory).toEqual({
      cache: [],
      daemons: [],
      discard: []
    });
    expect(state.bossMemory).toEqual({
      cache: [],
      daemons: [],
      discard: []
    });
  });

  it("adds boot and boss intro logs", () => {
    const state = createGameState(initEcho);

    expect(state.logs).toHaveLength(initEcho.intro.length + 1);
    expect(state.logs[0]).toMatchObject({
      id: "log-1",
      turn: 1,
      type: "system",
      message: "BOOT: INIT ECHO encounter initialized."
    });
  });
});
