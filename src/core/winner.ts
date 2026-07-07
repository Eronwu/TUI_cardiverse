import { appendLog } from "./log.js";
import type { ActorId, GameState } from "./types.js";

export type WinnerResult = {
  winner: ActorId;
  reason: string;
};

export function getWinner(state: GameState): WinnerResult | undefined {
  if (state.boss.hp <= 0) {
    return { winner: "player", reason: "BOSS_HP_ZERO" };
  }

  if (state.boss.sanity <= 0) {
    return { winner: "player", reason: "BOSS_SANITY_ZERO" };
  }

  if (state.player.hp <= 0) {
    return { winner: "boss", reason: "PLAYER_HP_ZERO" };
  }

  if (state.player.sanity <= 0) {
    return { winner: "boss", reason: "PLAYER_SANITY_ZERO" };
  }

  return undefined;
}

export function finalizeWinner(state: GameState): GameState {
  if (state.winner !== undefined) {
    return state;
  }

  const result = getWinner(state);
  if (result === undefined) {
    return state;
  }

  const nextState: GameState = {
    ...state,
    phase: "game_over",
    winner: result.winner,
    defeatReason: result.reason
  };

  return appendLog(nextState, {
    type: "winner",
    winner: result.winner,
    reason: result.reason
  });
}
