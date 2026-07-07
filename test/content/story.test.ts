import { describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { initEchoStory, worldBackground } from "../../src/content/story/terminalCardiverse.js";

describe("story content", () => {
  it("stores world background in a dedicated story module", () => {
    expect(worldBackground.id).toBe("world-background");
    expect(worldBackground.lines.length).toBeGreaterThan(0);
  });

  it("connects INIT ECHO boss intro to dedicated story content", () => {
    expect(initEcho.intro).toBe(initEchoStory.lines);
    expect(initEcho.intro).toContain("Defeat it through shell damage or logic collapse.");
  });
});
