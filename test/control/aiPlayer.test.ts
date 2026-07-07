import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { runAutoTurn, suggestPlayerAction } from "../../src/control/aiPlayer.js";
import { addCardToCache } from "../../src/core/actions.js";
import { createGameState } from "../../src/core/state.js";
import { startTurn } from "../../src/core/turn.js";
import type { Card } from "../../src/core/types.js";

const attackCard: Card = {
  id: "attack-card",
  kind: "attack",
  name: "Attack Card",
  description: "Attack.",
  target: "enemy",
  cost: 4,
  effects: [{ type: "damage", track: "hp", amount: 10 }],
  tags: ["test"]
};

describe("AI player", () => {
  it("suggests without mutating state", () => {
    const state = addCardToCache(startTurn(createGameState(initEcho), "player"), "player", attackCard);
    const snapshot = structuredClone(state);
    const suggestion = suggestPlayerAction(state);

    expect(suggestion.action).toEqual({ type: "play", cacheIndex: 0, cardId: "attack-card" });
    expect(state).toEqual(snapshot);
  });

  it("runs an auto turn through the dispatcher", async () => {
    const state = startTurn(createGameState(initEcho), "player");
    const nextState = await runAutoTurn({
      state,
      boss: initEcho,
      compilerMode: "stub"
    });

    expect(nextState.turn).toBeGreaterThanOrEqual(2);
    expect(nextState.logs.some((log) => log.type === "compile" && log.success)).toBe(true);
    expect(nextState.logs.some((log) => log.type === "card_played" && log.actor === "player")).toBe(true);
  });
});
