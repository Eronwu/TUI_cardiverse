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
    expect(parseCommand("c   thermal spike")).toEqual({
      type: "compile",
      prompt: "thermal spike"
    });
    expect(parseCommand("burn through the shell")).toEqual({
      type: "compile",
      prompt: "burn through the shell"
    });
  });

  it("parses indexed cache commands", () => {
    expect(parseCommand("play 0")).toEqual({ type: "play", cacheIndex: 0 });
    expect(parseCommand("1")).toEqual({ type: "play", cacheIndex: 0 });
    expect(parseCommand("mount 2")).toEqual({ type: "mount", cacheIndex: 2 });
    expect(parseCommand("d2")).toEqual({ type: "mount", cacheIndex: 1 });
    expect(parseCommand("trap 4")).toEqual({ type: "trap", cacheIndex: 4 });
    expect(parseCommand("k4")).toEqual({ type: "trap", cacheIndex: 3 });
  });

  it("parses inspect commands", () => {
    expect(parseCommand("inspect cache 1")).toEqual({ type: "inspect", zone: "cache", index: 1 });
    expect(parseCommand("inspect kernel")).toEqual({ type: "inspect", zone: "kernel" });
    expect(parseCommand("i3")).toEqual({ type: "inspect", zone: "cache", index: 2 });
  });

  it("parses friendly shortcut commands", () => {
    expect(parseCommand("e")).toEqual({ type: "end" });
    expect(parseCommand("a")).toEqual({ type: "suggest" });
    expect(parseCommand("g")).toEqual({ type: "auto_turn" });
    expect(parseCommand("q")).toEqual({ type: "quit" });
    expect(parseCommand("?")).toEqual({ type: "help" });
    expect(parseCommand("p")).toEqual({ type: "use_draft" });
    expect(parseCommand("c")).toEqual({ type: "cache_draft" });
    expect(parseCommand("x")).toEqual({ type: "discard_draft" });
    expect(parseCommand("r recursive doubt")).toEqual({ type: "compile", prompt: "recursive doubt" });
  });

  it("returns unknown for invalid commands or indexes", () => {
    expect(parseCommand("play x")).toEqual({ type: "unknown", raw: "play x" });
    expect(parseCommand(":wat")).toEqual({ type: "unknown", raw: "wat" });
  });
});
