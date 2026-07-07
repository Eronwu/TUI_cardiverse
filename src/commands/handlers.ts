import { addCardToCache, armKernel, mountDaemon, playCard } from "../core/actions.js";
import { appendLog } from "../core/log.js";
import { createGameState } from "../core/state.js";
import { endPlayerTurn, startTurn } from "../core/turn.js";
import type { BossDefinition, GameState } from "../core/types.js";
import { compilePrompt } from "../compiler/stubCompiler.js";
import type { CompilerMode } from "../compiler/types.js";
import { saveBattleLog } from "../storage/battleLog.js";
import type { InspectZone, ParsedCommand } from "./types.js";

export type HandleCommandInput = {
  command: ParsedCommand;
  state: GameState;
  boss: BossDefinition;
  compilerMode: CompilerMode;
};

export type HandleCommandResult = {
  state: GameState;
  shouldQuit?: boolean;
  showLog?: boolean;
};

export async function handleCommand(input: HandleCommandInput): Promise<HandleCommandResult> {
  const { command, boss, compilerMode } = input;

  switch (command.type) {
    case "help":
      return { state: appendSystem(input.state, helpText()) };
    case "new":
    case "restart":
      return { state: startTurn(createGameState(boss), "player") };
    case "status":
      return { state: appendSystem(input.state, "STATUS: refreshed.") };
    case "compile":
      return handleCompile(input.state, command.prompt, compilerMode);
    case "play":
      return { state: playCard(input.state, "player", command.cacheIndex) };
    case "mount":
      return { state: mountDaemon(input.state, "player", command.cacheIndex) };
    case "trap":
      return { state: armKernel(input.state, "player", command.cacheIndex) };
    case "inspect":
      return { state: appendSystem(input.state, inspectText(input.state, command.zone, command.index)) };
    case "end":
      return { state: endPlayerTurn(input.state, boss) };
    case "log":
      return { state: input.state, showLog: true };
    case "save_log":
      return handleSaveLog(input.state, boss);
    case "settings":
      return { state: appendSystem(input.state, `SETTINGS: compiler=${compilerMode}.`) };
    case "quit":
      return { state: appendSystem(input.state, "QUIT: shutting down."), shouldQuit: true };
    case "unknown":
      return { state: appendSystem(input.state, `ERROR: unknown command "${command.raw.trim()}".`) };
  }
}

async function handleCompile(
  state: GameState,
  prompt: string,
  compilerMode: CompilerMode
): Promise<HandleCommandResult> {
  const result = await compilePrompt({
    prompt,
    actor: "player",
    turn: state.turn,
    mode: compilerMode
  });

  if (!result.ok) {
    return {
      state: appendLog(state, {
        type: "compile",
        actor: "player",
        prompt,
        success: false,
        message: `${result.code}: ${result.message}`
      })
    };
  }

  const loggedState = appendLog(state, {
    type: "compile",
    actor: "player",
    prompt,
    cardName: result.card.name,
    success: true,
    message: `COMPILED: ${result.card.name} / cost ${result.card.cost}.`
  });
  const warningState = result.warnings.reduce((nextState, warning) => appendSystem(nextState, warning), loggedState);

  return {
    state: addCardToCache(warningState, "player", result.card)
  };
}

async function handleSaveLog(state: GameState, boss: BossDefinition): Promise<HandleCommandResult> {
  const filePath = await saveBattleLog(state.logs, boss.id);

  return {
    state: appendSystem(state, `LOG: saved to ${filePath}.`)
  };
}

function appendSystem(state: GameState, message: string): GameState {
  return appendLog(state, {
    type: "system",
    message
  });
}

function inspectText(state: GameState, zone: InspectZone, index?: number): string {
  switch (zone) {
    case "cache": {
      const card = index === undefined ? undefined : state.playerMemory.cache[index];
      return card === undefined ? "INSPECT: cache slot empty." : `INSPECT: ${card.name} / ${card.kind} / cost ${card.cost}.`;
    }
    case "daemon": {
      const daemon = index === undefined ? undefined : state.playerMemory.daemons[index];
      return daemon === undefined
        ? "INSPECT: daemon slot empty."
        : `INSPECT: ${daemon.card.name} / ${daemon.remainingTurns} turns.`;
    }
    case "kernel":
      return state.playerMemory.kernel === undefined
        ? "INSPECT: kernel slot empty."
        : `INSPECT: ${state.playerMemory.kernel.card.name} armed.`;
    case "discard": {
      const card = index === undefined ? undefined : state.playerMemory.discard[index];
      return card === undefined ? "INSPECT: discard slot empty." : `INSPECT: ${card.name} / discarded.`;
    }
  }
}

function helpText(): string {
  return [
    "HELP: commands:",
    "status",
    "compile <prompt>",
    "play <cacheIndex>",
    "mount <cacheIndex>",
    "trap <cacheIndex>",
    "inspect <cache|daemon|kernel|discard> [index]",
    "end",
    "log",
    "save-log",
    "restart",
    "quit"
  ].join(" | ");
}
