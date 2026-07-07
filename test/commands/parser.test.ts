import { describe, expect, it } from "vitest";
import { parseCommand } from "../../src/commands/parser.js";

describe("parseCommand", () => {
  it("parses basic commands case-insensitively", () => {
    expect(parseCommand("HELP")).toEqual({ type: "help" });
    expect(parseCommand("status")).toEqual({ type: "status" });
    expect(parseCommand("end")).toEqual({ type: "end" });
  });

  it("preserves compile prompt text after the command", () => {
    expect(parseCommand("compile   thermal spike with spaces")).toEqual({
      type: "compile",
      prompt: "thermal spike with spaces"
    });
  });

  it("parses indexed cache commands", () => {
    expect(parseCommand("play 0")).toEqual({ type: "play", cacheIndex: 0 });
    expect(parseCommand("mount 2")).toEqual({ type: "mount", cacheIndex: 2 });
    expect(parseCommand("trap 4")).toEqual({ type: "trap", cacheIndex: 4 });
  });

  it("parses inspect commands", () => {
    expect(parseCommand("inspect cache 1")).toEqual({ type: "inspect", zone: "cache", index: 1 });
    expect(parseCommand("inspect kernel")).toEqual({ type: "inspect", zone: "kernel" });
  });

  it("returns unknown for invalid commands or indexes", () => {
    expect(parseCommand("play x")).toEqual({ type: "unknown", raw: "play x" });
    expect(parseCommand("wat")).toEqual({ type: "unknown", raw: "wat" });
  });
});
