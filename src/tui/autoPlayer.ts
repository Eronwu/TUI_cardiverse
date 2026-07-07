import { runAutoTurn } from "../control/aiPlayer.js";
import { initEcho } from "../content/bosses/initEcho.js";
import { createGameState } from "../core/state.js";
import { startTurn } from "../core/turn.js";
import type { GameState } from "../core/types.js";
import type { CompilerMode } from "../compiler/types.js";
import { renderBattle } from "./render.js";

export async function runAutoPlayerChallenge(input: {
  compilerMode: CompilerMode;
  maxTurns?: number;
}): Promise<GameState> {
  let state = startTurn(createGameState(initEcho), "player");
  const maxTurns = input.maxTurns ?? 20;

  while (state.phase !== "game_over" && state.turn <= maxTurns) {
    state = await runAutoTurn({
      state,
      boss: initEcho,
      compilerMode: input.compilerMode
    });
  }

  return state;
}

export async function printAutoPlayerChallenge(input: {
  compilerMode: CompilerMode;
  output: NodeJS.WritableStream;
}): Promise<void> {
  const state = await runAutoPlayerChallenge({
    compilerMode: input.compilerMode
  });

  input.output.write(`${renderBattle(state, initEcho)}\n`);
}
