import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { addCardToCache, mountDaemon } from "../../src/core/actions.js";
import { createGameState } from "../../src/core/state.js";
import { endPlayerTurn, startTurn } from "../../src/core/turn.js";
import type { Card } from "../../src/core/types.js";

const repairDaemon: Card = {
  id: "repair-daemon",
  kind: "daemon",
  name: "Repair Daemon",
  description: "Repairs player HP.",
  target: "self",
  cost: 1,
  duration: 2,
  effects: [{ type: "heal", track: "hp", amount: 5 }],
  tags: ["repair"]
};

describe("turn flow", () => {
  it("restores ram at turn start", () => {
    const state = startTurn(createGameState(initEcho), "player");

    expect(state.player.ram).toBe(10);
    expect(state.logs.at(-1)).toMatchObject({
      type: "system",
      message: "RAM: player restored to 10/20."
    });
  });

  it("ticks daemons at owner turn start and expires them", () => {
    const initial = {
      ...createGameState(initEcho),
      player: { ...createGameState(initEcho).player, ram: 5, hp: 80 }
    };
    const mounted = mountDaemon(addCardToCache(initial, "player", repairDaemon), "player", 0);
    const afterFirstTick = startTurn(mounted, "player");
    const afterSecondTick = startTurn(afterFirstTick, "player");

    expect(afterFirstTick.player.hp).toBe(85);
    expect(afterFirstTick.playerMemory.daemons[0]?.remainingTurns).toBe(1);
    expect(afterSecondTick.player.hp).toBe(90);
    expect(afterSecondTick.playerMemory.daemons).toHaveLength(0);
  });

  it("runs a boss action after the player ends turn", () => {
    const state = {
      ...createGameState(initEcho),
      player: { ...createGameState(initEcho).player, ram: 10 }
    };
    const nextState = endPlayerTurn(state, initEcho);

    expect(nextState.turn).toBe(2);
    expect(nextState.phase).toBe("player_turn");
    expect(nextState.activeActor).toBe("player");
    expect(nextState.player.hp).toBe(90);
    expect(nextState.boss.ram).toBe(5);
    expect(nextState.player.ram).toBe(20);
  });
});
