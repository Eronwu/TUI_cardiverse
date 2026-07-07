import { describe, expect, it } from "vitest";
import { handleCommand } from "../../src/commands/handlers.js";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { createGameState } from "../../src/core/state.js";
import { startTurn } from "../../src/core/turn.js";
import type { GameState } from "../../src/core/types.js";

async function runCommand(state: GameState, command: Parameters<typeof handleCommand>[0]["command"]): Promise<GameState> {
  const result = await handleCommand({
    command,
    state,
    boss: initEcho,
    compilerMode: "stub"
  });

  return result.state;
}

describe("MVP challenge", () => {
  it("allows the player to defeat INIT ECHO through terminal commands", async () => {
    let state = startTurn(createGameState(initEcho), "player");

    for (let cycle = 0; cycle < 4 && state.phase !== "game_over"; cycle += 1) {
      state = await runCommand(state, {
        type: "compile",
        prompt: "summon a black hole to destroy everything"
      });
      state = await runCommand(state, { type: "play", cacheIndex: 0 });

      if (state.phase !== "game_over") {
        state = await runCommand(state, { type: "end" });
      }
    }

    expect(state.phase).toBe("game_over");
    expect(state.winner).toBe("player");
    expect(state.defeatReason).toBe("BOSS_HP_ZERO");
    expect(state.logs.some((log) => log.type === "winner" && log.winner === "player")).toBe(true);
  });
});
