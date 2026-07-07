import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runTerminalGame } from "../../src/tui/terminalGame.js";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalLlmKey = process.env.LLM_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  if (originalLlmKey === undefined) {
    delete process.env.LLM_API_KEY;
  } else {
    process.env.LLM_API_KEY = originalLlmKey;
  }
});

describe("runTerminalGame", () => {
  it("runs a command loop from stdin", async () => {
    const input = Readable.from(["status\nquit\n"]);
    let output = "";
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });

    await runTerminalGame({
      compilerMode: "stub",
      input,
      output: writable,
      clearScreen: false
    });

    expect(output).toContain("TERMINAL CARDIVERSE");
    expect(output).toContain("INIT ECHO");
    expect(output).toContain("STATUS: refreshed.");
    expect(output).toContain("QUIT: shutting down.");
  });

  it("shows a loading message for LLM compilation in non-tty output", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;
    const input = Readable.from(["thermal spike\nquit\n"]);
    let output = "";
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });

    await runTerminalGame({
      compilerMode: "llm",
      input,
      output: writable,
      clearScreen: false
    });

    expect(output).toContain("AI COMPILER: generating card... waiting");
    expect(output).toContain("AI COMPILER: done in");
    expect(output).toContain("COMPILER_UNAVAILABLE");
  });
});
