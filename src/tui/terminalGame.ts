import { createInterface } from "node:readline/promises";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import { handleCommand } from "../commands/handlers.js";
import { parseCommand } from "../commands/parser.js";
import { initEcho } from "../content/bosses/initEcho.js";
import { createGameState } from "../core/state.js";
import { startTurn } from "../core/turn.js";
import type { GameState } from "../core/types.js";
import type { CompilerMode } from "../compiler/types.js";
import { renderBattle, renderFullLog } from "./render.js";

export type RunTerminalGameOptions = {
  compilerMode: CompilerMode;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  clearScreen?: boolean;
};

export async function runTerminalGame(options: RunTerminalGameOptions): Promise<void> {
  const input = options.input ?? defaultInput;
  const output = options.output ?? defaultOutput;
  const outputIsTty = isTty(output);
  const clearScreen = options.clearScreen ?? outputIsTty;
  const rl = createInterface({ input, output, terminal: outputIsTty });
  let state: GameState = startTurn(createGameState(initEcho), "player");

  write(output, render(state, clearScreen));
  write(output, "\ncardiverse> ");

  for await (const line of rl) {
    const command = parseCommand(line);
    const result = await handleCommand({
      command,
      state,
      boss: initEcho,
      compilerMode: options.compilerMode
    });
    state = result.state;

    if (result.showLog) {
      write(output, `\n${renderFullLog(state)}\n`);
    } else {
      write(output, render(state, clearScreen));
    }

    if (result.shouldQuit) {
      break;
    }

    write(output, "\ncardiverse> ");
  }

  rl.close();
  write(output, "\n");
}

function render(state: GameState, clearScreen: boolean): string {
  const prefix = clearScreen ? "\x1Bc" : "\n";
  return `${prefix}${renderBattle(state, initEcho)}`;
}

function write(output: NodeJS.WritableStream, text: string): void {
  output.write(text);
}

function isTty(output: NodeJS.WritableStream): boolean {
  return "isTTY" in output && Boolean((output as { isTTY?: boolean }).isTTY);
}
