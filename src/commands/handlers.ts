import { appendLog } from "../core/log.js";
import { createGameState } from "../core/state.js";
import { startTurn } from "../core/turn.js";
import type { BossDefinition, GameState } from "../core/types.js";
import type { CompilerMode } from "../compiler/types.js";
import { runAutoTurn, suggestPlayerAction } from "../control/aiPlayer.js";
import { dispatchPlayerAction } from "../control/playerActions.js";
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
      if (command.prompt.trim().length === 0) {
        return { state: appendSystem(input.state, "COMPILE: type an intent directly, for example: thermal spike.") };
      }
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "compile", prompt: command.prompt }
        })
      };
    case "use_draft":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "use_draft" }
        })
      };
    case "cache_draft":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "cache_draft" }
        })
      };
    case "discard_draft":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "discard_draft" }
        })
      };
    case "play":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "play", cacheIndex: command.cacheIndex }
        })
      };
    case "mount":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "mount", cacheIndex: command.cacheIndex }
        })
      };
    case "trap":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "trap", cacheIndex: command.cacheIndex }
        })
      };
    case "inspect":
      return { state: appendSystem(input.state, inspectText(input.state, command.zone, command.index)) };
    case "end":
      return {
        state: await dispatchPlayerAction({
          state: input.state,
          boss,
          compilerMode,
          action: { type: "end" }
        })
      };
    case "suggest": {
      const suggestion = suggestPlayerAction(input.state);
      return {
        state: appendSystem(input.state, `AI SUGGEST: ${formatAction(suggestion.action)}. ${suggestion.reason}`)
      };
    }
    case "auto_turn":
      return {
        state: await runAutoTurn({
          state: input.state,
          boss,
          compilerMode
        })
      };
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
    "a / suggest",
    "g / auto-turn",
    "log",
    "save-log",
    "restart",
    "quit"
  ].join(" | ");
}

function formatAction(action: ReturnType<typeof suggestPlayerAction>["action"]): string {
  switch (action.type) {
    case "compile":
      return `compile "${action.prompt}"`;
    case "use_draft":
      return "use draft";
    case "cache_draft":
      return "cache draft";
    case "discard_draft":
      return "discard draft";
    case "play":
      return `play ${action.cacheIndex + 1}`;
    case "mount":
      return `mount ${action.cacheIndex + 1}`;
    case "trap":
      return `trap ${action.cacheIndex + 1}`;
    case "end":
      return "end";
  }
}
