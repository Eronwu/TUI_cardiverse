import { createInterface } from "node:readline/promises";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import type { ParsedCommand } from "../commands/types.js";
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
  rl.setPrompt("cardiverse> ");
  let state: GameState = startTurn(createGameState(initEcho), "player");

  write(output, render(state, clearScreen));
  write(output, "\n");
  promptForInput(rl, output, outputIsTty);

  for await (const line of rl) {
    const command = parseCommand(line);
    const loading = createLoadingIndicator({
      command,
      compilerMode: options.compilerMode,
      output,
      outputIsTty
    });
    loading.start();

    const result = await handleCommand({
      command,
      state,
      boss: initEcho,
      compilerMode: options.compilerMode
    });
    loading.stop();
    state = result.state;

    if (result.showLog) {
      write(output, `\n${renderFullLog(state)}\n`);
    } else {
      write(output, render(state, clearScreen));
    }

    if (result.shouldQuit) {
      break;
    }

    write(output, "\n");
    promptForInput(rl, output, outputIsTty);
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

function promptForInput(
  rl: ReturnType<typeof createInterface>,
  output: NodeJS.WritableStream,
  outputIsTty: boolean
): void {
  if (!outputIsTty) {
    write(output, "cardiverse> ");
    return;
  }

  try {
    rl.prompt();
  } catch {
    // Input may already be closed during piped smoke tests.
  }
}

function createLoadingIndicator(input: {
  command: ParsedCommand;
  compilerMode: CompilerMode;
  output: NodeJS.WritableStream;
  outputIsTty: boolean;
}): {
  start: () => void;
  stop: () => void;
} {
  if (input.command.type !== "compile" || input.compilerMode !== "llm") {
    return {
      start: () => undefined,
      stop: () => undefined
    };
  }

  let timer: NodeJS.Timeout | undefined;
  const startedAt = Date.now();
  const frames = ["-", "\\", "|", "/"];
  let frameIndex = 0;

  return {
    start: () => {
      if (!input.outputIsTty) {
        write(input.output, "\nAI COMPILER: generating card... waiting\n");
        return;
      }

      write(input.output, "\nAI COMPILER: generating card... - 0s");
      timer = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        frameIndex = (frameIndex + 1) % frames.length;
        write(input.output, `\rAI COMPILER: generating card... ${frames[frameIndex]} ${elapsedSeconds}s`);
      }, 250);
    },
    stop: () => {
      if (timer !== undefined) {
        clearInterval(timer);
      }

      const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (!input.outputIsTty) {
        write(input.output, `AI COMPILER: done in ${elapsedSeconds}s\n`);
        return;
      }

      write(input.output, `\rAI COMPILER: done in ${elapsedSeconds}s${" ".repeat(24)}\n`);
    }
  };
}
