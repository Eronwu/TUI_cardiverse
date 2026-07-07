import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { addCardToCache, armKernel, mountDaemon, playCard } from "../../src/core/actions.js";
import { applyEffect } from "../../src/core/effects.js";
import { createGameState } from "../../src/core/state.js";
import type { Card } from "../../src/core/types.js";

const attackCard: Card = {
  id: "test-attack",
  kind: "attack",
  name: "Test Attack",
  description: "A test attack.",
  target: "enemy",
  cost: 4,
  effects: [{ type: "damage", track: "hp", amount: 12 }],
  tags: ["test"]
};

const daemonCard: Card = {
  id: "test-daemon",
  kind: "daemon",
  name: "Test Daemon",
  description: "A test daemon.",
  target: "self",
  cost: 5,
  duration: 2,
  effects: [{ type: "shield", track: "hp", amount: 3 }],
  tags: ["test", "defense"]
};

const kernelCard: Card = {
  id: "test-kernel",
  kind: "kernel",
  name: "Test Kernel",
  description: "A test kernel.",
  target: "self",
  cost: 6,
  trigger: { when: "self_takes_hp_damage", limit: 1 },
  effects: [{ type: "damage", track: "hp", amount: 5, target: "enemy" }],
  tags: ["test", "trap"]
};

describe("player actions", () => {
  it("adds cards to cache up to the cache limit", () => {
    let state = createGameState(initEcho);

    for (let index = 0; index < 5; index += 1) {
      state = addCardToCache(state, "player", { ...attackCard, id: `attack-${index}` });
    }

    const overflowState = addCardToCache(state, "player", { ...attackCard, id: "overflow" });

    expect(overflowState.playerMemory.cache).toHaveLength(5);
    expect(overflowState.logs.at(-1)).toMatchObject({
      type: "system",
      message: "CACHE: player cache full; Test Attack discarded."
    });
  });

  it("plays an attack card, spends ram, moves it to discard, and applies damage", () => {
    const state = addCardToCache(
      {
        ...createGameState(initEcho),
        player: { ...createGameState(initEcho).player, ram: 10 }
      },
      "player",
      attackCard
    );
    const nextState = playCard(state, "player", 0);

    expect(nextState.player.ram).toBe(6);
    expect(nextState.boss.hp).toBe(108);
    expect(nextState.playerMemory.cache).toHaveLength(0);
    expect(nextState.playerMemory.discard).toEqual([attackCard]);
  });

  it("does not play a card if ram is insufficient", () => {
    const state = addCardToCache(createGameState(initEcho), "player", attackCard);
    const nextState = playCard(state, "player", 0);

    expect(nextState.boss.hp).toBe(120);
    expect(nextState.playerMemory.cache).toEqual([attackCard]);
    expect(nextState.logs.at(-1)).toMatchObject({
      type: "system",
      message: "RAM: insufficient RAM for Test Attack."
    });
  });

  it("mounts a daemon into daemon memory", () => {
    const state = addCardToCache(
      {
        ...createGameState(initEcho),
        player: { ...createGameState(initEcho).player, ram: 10 }
      },
      "player",
      daemonCard
    );
    const nextState = mountDaemon(state, "player", 0);

    expect(nextState.player.ram).toBe(5);
    expect(nextState.playerMemory.cache).toHaveLength(0);
    expect(nextState.playerMemory.daemons).toHaveLength(1);
    expect(nextState.playerMemory.daemons[0]).toMatchObject({
      card: daemonCard,
      remainingTurns: 2
    });
  });

  it("arms a kernel into the kernel slot", () => {
    const state = addCardToCache(
      {
        ...createGameState(initEcho),
        player: { ...createGameState(initEcho).player, ram: 10 }
      },
      "player",
      kernelCard
    );
    const nextState = armKernel(state, "player", 0);

    expect(nextState.player.ram).toBe(4);
    expect(nextState.playerMemory.cache).toHaveLength(0);
    expect(nextState.playerMemory.kernel).toEqual({ card: kernelCard });
  });

  it("triggers an armed kernel once when matching damage is taken", () => {
    const armedState = armKernel(
      addCardToCache(
        {
          ...createGameState(initEcho),
          player: { ...createGameState(initEcho).player, ram: 10 }
        },
        "player",
        kernelCard
      ),
      "player",
      0
    );
    const nextState = applyEffect(
      armedState,
      { type: "damage", track: "hp", amount: 10 },
      { source: "boss", defaultTarget: "enemy" }
    );

    expect(nextState.player.hp).toBe(90);
    expect(nextState.boss.hp).toBe(115);
    expect(nextState.playerMemory.kernel).toBeUndefined();
    expect(nextState.logs.some((log) => log.type === "system" && log.message === "KERNEL: Test Kernel triggered.")).toBe(
      true
    );
  });
});
