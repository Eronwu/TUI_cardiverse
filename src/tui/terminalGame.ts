import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
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
  const inputIsTty = isTty(input);
  const outputIsTty = isTty(output);

  if (inputIsTty && outputIsTty && isRawModeCapable(input)) {
    await runKeypressTerminalGame({
      compilerMode: options.compilerMode,
      input,
      output,
      ...(options.clearScreen !== undefined ? { clearScreen: options.clearScreen } : {})
    });
    return;
  }

  await runLineTerminalGame(options);
}

async function runLineTerminalGame(options: RunTerminalGameOptions): Promise<void> {
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

type RunKeypressTerminalGameOptions = {
  compilerMode: CompilerMode;
  input: RawModeCapableInput;
  output: NodeJS.WritableStream;
  clearScreen?: boolean;
};

async function runKeypressTerminalGame(options: RunKeypressTerminalGameOptions): Promise<void> {
  const input = options.input;
  const output = options.output;
  const clearScreen = options.clearScreen ?? true;
  let state: GameState = startTurn(createGameState(initEcho), "player");
  let promptMode: "none" | "intent" | "command" = "none";
  let promptBuffer = "";
  let pendingPrefix: "d" | "k" | "i" | undefined;
  let shouldQuit = false;

  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();

  const renderInteractive = (footer = ""): void => {
    const prompt =
      promptMode === "intent"
        ? `\nINTENT> ${promptBuffer}`
        : promptMode === "command"
          ? `\nCOMMAND> :${promptBuffer}`
          : footer.length > 0
            ? `\n${footer}`
            : "\nPress text to forge a card. Keys: P/C/X/E/A/G/Q, 1-5, D/K/I+number, Enter=input.";
    write(output, `${render(state, clearScreen)}${prompt}`);
  };

  const execute = async (command: ParsedCommand): Promise<void> => {
    const loading = createLoadingIndicator({
      command,
      compilerMode: options.compilerMode,
      output,
      outputIsTty: true
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
    shouldQuit = Boolean(result.shouldQuit);
    if (result.showLog) {
      write(output, `\x1Bc${renderFullLog(state)}\n`);
    } else {
      renderInteractive();
    }
  };

  renderInteractive();

  await new Promise<void>((resolve) => {
    const onKeypress = (str: string, key: KeypressKey): void => {
      void (async () => {
        if (key.ctrl && key.name === "c") {
          shouldQuit = true;
          resolve();
          return;
        }

        if (promptMode !== "none") {
          if (key.name === "escape") {
            promptMode = "none";
            promptBuffer = "";
            renderInteractive("INPUT: cancelled.");
            return;
          }

          if (key.name === "backspace") {
            promptBuffer = promptBuffer.slice(0, -1);
            renderInteractive();
            return;
          }

          if (key.name === "return" || key.name === "enter") {
            const rawInput = promptMode === "command" ? `:${promptBuffer}` : promptBuffer;
            promptMode = "none";
            promptBuffer = "";
            await execute(parseCommand(rawInput));
            if (shouldQuit) {
              resolve();
            }
            return;
          }

          if (isPrintable(str)) {
            promptBuffer += str;
            renderInteractive();
          }
          return;
        }

        if (pendingPrefix !== undefined) {
          if (/^[1-5]$/.test(str)) {
            const command =
              pendingPrefix === "d"
                ? parseCommand(`d${str}`)
                : pendingPrefix === "k"
                  ? parseCommand(`k${str}`)
                  : parseCommand(`i${str}`);
            pendingPrefix = undefined;
            await execute(command);
            if (shouldQuit) {
              resolve();
            }
            return;
          }

          pendingPrefix = undefined;
          renderInteractive("SELECT: cancelled.");
          return;
        }

        const lower = str.toLowerCase();
        if (/^[1-5]$/.test(str)) {
          await execute(parseCommand(str));
        } else if (lower === "d" || lower === "k" || lower === "i") {
          pendingPrefix = lower;
          renderInteractive(`${lower.toUpperCase()}: choose cache slot 1-5.`);
        } else if (lower === "p" && state.draft !== undefined) {
          await execute({ type: "use_draft" });
        } else if (lower === "c" && state.draft !== undefined) {
          await execute({ type: "cache_draft" });
        } else if (lower === "x" && state.draft !== undefined) {
          await execute({ type: "discard_draft" });
        } else if (lower === "r" && state.draft !== undefined) {
          promptMode = "intent";
          promptBuffer = "";
          renderInteractive("REWRITE: type new intent.");
        } else if (lower === "e" || lower === "a" || lower === "g" || lower === "q" || lower === "?") {
          await execute(parseCommand(lower));
        } else if (str === ":") {
          promptMode = "command";
          promptBuffer = "";
          renderInteractive();
        } else if (key.name === "return" || key.name === "enter") {
          promptMode = "intent";
          promptBuffer = "";
          renderInteractive();
        } else if (isPrintable(str)) {
          promptMode = "intent";
          promptBuffer = str;
          renderInteractive();
        }

        if (shouldQuit) {
          resolve();
        }
      })();
    };

    input.on("keypress", onKeypress);
  });

  input.setRawMode(false);
  input.pause();
  write(output, "\n");
}

function render(state: GameState, clearScreen: boolean): string {
  const prefix = clearScreen ? "\x1Bc" : "\n";
  return `${prefix}${renderBattle(state, initEcho)}`;
}

function write(output: NodeJS.WritableStream, text: string): void {
  output.write(text);
}

function isTty(stream: NodeJS.ReadableStream | NodeJS.WritableStream): boolean {
  return "isTTY" in stream && Boolean((stream as { isTTY?: boolean }).isTTY);
}

type RawModeCapableInput = NodeJS.ReadableStream & {
  setRawMode: (mode: boolean) => void;
  resume: () => NodeJS.ReadableStream;
  pause: () => NodeJS.ReadableStream;
  on: (event: "keypress", listener: (str: string, key: KeypressKey) => void) => NodeJS.ReadableStream;
};

type KeypressKey = {
  name?: string;
  ctrl?: boolean;
};

function isRawModeCapable(input: NodeJS.ReadableStream): input is RawModeCapableInput {
  return "setRawMode" in input && typeof (input as { setRawMode?: unknown }).setRawMode === "function";
}

function isPrintable(str: string): boolean {
  return str.length > 0 && !/[\u0000-\u001f\u007f]/.test(str);
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
