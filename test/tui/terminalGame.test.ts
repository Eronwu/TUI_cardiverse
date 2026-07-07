import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runTerminalGame } from "../../src/tui/terminalGame.js";

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
});
