import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { applyEffect } from "../../src/core/effects.js";
import { createGameState } from "../../src/core/state.js";
import { getWinner } from "../../src/core/winner.js";

describe("winner detection", () => {
  it("has no winner for a fresh game", () => {
    expect(getWinner(createGameState(initEcho))).toBeUndefined();
  });

  it("player wins when boss hp reaches zero", () => {
    const nextState = applyEffect(
      createGameState(initEcho),
      { type: "damage", track: "hp", amount: 999 },
      { source: "player", defaultTarget: "enemy" }
    );

    expect(nextState.phase).toBe("game_over");
    expect(nextState.winner).toBe("player");
    expect(nextState.defeatReason).toBe("BOSS_HP_ZERO");
    expect(nextState.logs.at(-1)).toMatchObject({
      type: "winner",
      winner: "player",
      reason: "BOSS_HP_ZERO"
    });
  });

  it("player wins when boss sanity reaches zero", () => {
    const nextState = applyEffect(
      createGameState(initEcho),
      { type: "damage", track: "sanity", amount: 999 },
      { source: "player", defaultTarget: "enemy" }
    );

    expect(nextState.winner).toBe("player");
    expect(nextState.defeatReason).toBe("BOSS_SANITY_ZERO");
  });

  it("boss wins when player hp reaches zero", () => {
    const nextState = applyEffect(
      createGameState(initEcho),
      { type: "damage", track: "hp", amount: 999 },
      { source: "boss", defaultTarget: "enemy" }
    );

    expect(nextState.winner).toBe("boss");
    expect(nextState.defeatReason).toBe("PLAYER_HP_ZERO");
  });

  it("boss wins when player sanity reaches zero", () => {
    const nextState = applyEffect(
      createGameState(initEcho),
      { type: "damage", track: "sanity", amount: 999 },
      { source: "boss", defaultTarget: "enemy" }
    );

    expect(nextState.winner).toBe("boss");
    expect(nextState.defeatReason).toBe("PLAYER_SANITY_ZERO");
  });
});
