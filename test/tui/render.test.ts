import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { createGameState } from "../../src/core/state.js";
import { startTurn } from "../../src/core/turn.js";
import { renderBattle } from "../../src/tui/render.js";

describe("renderBattle", () => {
  it("renders status, memory, boss, and logs", () => {
    const output = renderBattle(startTurn(createGameState(initEcho), "player"), initEcho);

    expect(output).toContain("TERMINAL CARDIVERSE");
    expect(output).toContain("PLAYER hp:100/100 sanity:100/100 ram:10/20");
    expect(output).toContain("BOSS hp:120/120 sanity:90/90 ram:0/18");
    expect(output).toContain("CACHE  [empty]");
    expect(output).toContain("INIT ECHO");
    expect(output).toContain("SYSTEM LOG");
  });
});
