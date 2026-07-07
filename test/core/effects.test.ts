import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { applyEffect, applyEffects } from "../../src/core/effects.js";
import { createGameState } from "../../src/core/state.js";

describe("applyEffect", () => {
  it("applies hp damage to the enemy and writes an effect log", () => {
    const state = createGameState(initEcho);
    const nextState = applyEffect(
      state,
      { type: "damage", track: "hp", amount: 16 },
      { source: "player", defaultTarget: "enemy" }
    );

    expect(nextState.boss.hp).toBe(104);
    expect(nextState.logs.at(-1)).toMatchObject({
      type: "effect",
      actor: "player",
      target: "boss",
      amountApplied: 16
    });
  });

  it("applies sanity damage to the enemy", () => {
    const state = createGameState(initEcho);
    const nextState = applyEffect(
      state,
      { type: "damage", track: "sanity", amount: 14 },
      { source: "player", defaultTarget: "enemy" }
    );

    expect(nextState.boss.sanity).toBe(76);
  });

  it("uses shields before health tracks", () => {
    const state = applyEffect(
      createGameState(initEcho),
      { type: "shield", track: "hp", amount: 6 },
      { source: "boss", defaultTarget: "self" }
    );
    const nextState = applyEffect(
      state,
      { type: "damage", track: "hp", amount: 10 },
      { source: "player", defaultTarget: "enemy" }
    );

    expect(nextState.boss.shields.hp).toBe(0);
    expect(nextState.boss.hp).toBe(116);
    expect(nextState.logs.at(-1)).toMatchObject({
      type: "effect",
      amountApplied: 4
    });
  });

  it("clamps healing to max values", () => {
    const damaged = applyEffect(
      createGameState(initEcho),
      { type: "damage", track: "hp", amount: 8 },
      { source: "boss", defaultTarget: "enemy" }
    );
    const healed = applyEffect(
      damaged,
      { type: "heal", track: "hp", amount: 20, target: "self" },
      { source: "player", defaultTarget: "self" }
    );

    expect(healed.player.hp).toBe(100);
    expect(healed.logs.at(-1)).toMatchObject({
      type: "effect",
      amountApplied: 8
    });
  });

  it("clamps gained ram to max ram", () => {
    const state = {
      ...createGameState(initEcho),
      player: {
        ...createGameState(initEcho).player,
        ram: 18
      }
    };
    const nextState = applyEffect(
      state,
      { type: "gain_ram", amount: 10, target: "self" },
      { source: "player", defaultTarget: "self" }
    );

    expect(nextState.player.ram).toBe(20);
    expect(nextState.logs.at(-1)).toMatchObject({
      type: "effect",
      amountApplied: 2
    });
  });

  it("applies multiple effects in order", () => {
    const nextState = applyEffects(
      createGameState(initEcho),
      [
        { type: "damage", track: "hp", amount: 6 },
        { type: "damage", track: "sanity", amount: 8 }
      ],
      { source: "player", defaultTarget: "enemy" }
    );

    expect(nextState.boss.hp).toBe(114);
    expect(nextState.boss.sanity).toBe(82);
  });
});
