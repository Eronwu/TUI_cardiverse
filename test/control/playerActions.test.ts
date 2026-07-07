import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { dispatchPlayerAction, getLegalActions, isLegalPlayerAction } from "../../src/control/playerActions.js";
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

const daemonCard: Card = {
  id: "daemon-card",
  kind: "daemon",
  name: "Daemon Card",
  description: "Daemon.",
  target: "self",
  cost: 4,
  duration: 2,
  effects: [{ type: "heal", track: "hp", amount: 3 }],
  tags: ["test"]
};

const kernelCard: Card = {
  id: "kernel-card",
  kind: "kernel",
  name: "Kernel Card",
  description: "Kernel.",
  target: "self",
  cost: 4,
  trigger: { when: "self_takes_hp_damage", limit: 1 },
  effects: [{ type: "damage", track: "hp", amount: 5, target: "enemy" }],
  tags: ["test"]
};

describe("player action control plane", () => {
  it("returns no legal actions after game over", () => {
    expect(
      getLegalActions({
        ...createGameState(initEcho),
        phase: "game_over"
      })
    ).toEqual([]);
  });

  it("exposes only affordable matching cache actions", () => {
    let state = startTurn(createGameState(initEcho), "player");
    state = addCardToCache(state, "player", attackCard);
    state = addCardToCache(state, "player", daemonCard);
    state = addCardToCache(state, "player", kernelCard);

    expect(getLegalActions(state)).toEqual(
      expect.arrayContaining([
        { type: "compile", reason: "cache has free slot" },
        { type: "play", cacheIndex: 0, cardId: "attack-card", cardName: "Attack Card", reason: "affordable attack" },
        {
          type: "mount",
          cacheIndex: 1,
          cardId: "daemon-card",
          cardName: "Daemon Card",
          reason: "affordable daemon slot"
        },
        {
          type: "trap",
          cacheIndex: 2,
          cardId: "kernel-card",
          cardName: "Kernel Card",
          reason: "affordable kernel slot"
        },
        { type: "end", reason: "finish player turn" }
      ])
    );
  });

  it("does not expose unaffordable cache actions", () => {
    const state = addCardToCache(createGameState(initEcho), "player", attackCard);

    expect(getLegalActions(state).some((action) => action.type === "play")).toBe(false);
  });

  it("rejects stale card ids", async () => {
    const state = addCardToCache(startTurn(createGameState(initEcho), "player"), "player", attackCard);

    expect(isLegalPlayerAction(state, { type: "play", cacheIndex: 0, cardId: "other-card" })).toBe(false);

    const nextState = await dispatchPlayerAction({
      state,
      boss: initEcho,
      compilerMode: "stub",
      action: { type: "play", cacheIndex: 0, cardId: "other-card" }
    });

    expect(nextState.boss.hp).toBe(120);
    expect(nextState.playerMemory.cache).toHaveLength(1);
    expect(nextState.logs.at(-1)).toMatchObject({
      type: "system",
      message: "ACTION: illegal play."
    });
  });

  it("dispatches legal battle actions through core rules", async () => {
    const state = addCardToCache(startTurn(createGameState(initEcho), "player"), "player", attackCard);
    const nextState = await dispatchPlayerAction({
      state,
      boss: initEcho,
      compilerMode: "stub",
      action: { type: "play", cacheIndex: 0, cardId: "attack-card" }
    });

    expect(nextState.boss.hp).toBe(110);
    expect(nextState.player.ram).toBe(6);
    expect(nextState.playerMemory.discard).toHaveLength(1);
  });
});
