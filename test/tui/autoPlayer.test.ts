import { describe, expect, it } from "vitest";
import { runAutoPlayerChallenge } from "../../src/tui/autoPlayer.js";

describe("runAutoPlayerChallenge", () => {
  it("lets the rule-based AI complete the MVP challenge", async () => {
    const state = await runAutoPlayerChallenge({
      compilerMode: "stub"
    });

    expect(state.phase).toBe("game_over");
    expect(state.winner).toBe("player");
  });
});
