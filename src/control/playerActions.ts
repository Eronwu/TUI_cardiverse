import { armKernel, cacheDraftCard, clearDraftCard, mountDaemon, playCard, setDraftCard, useDraftCard } from "../core/actions.js";
import { appendLog } from "../core/log.js";
import { endPlayerTurn } from "../core/turn.js";
import type { BossDefinition, Card, GameState } from "../core/types.js";
import { compilePrompt } from "../compiler/index.js";
import type { CompilerMode } from "../compiler/types.js";

export type PlayerAction =
  | { type: "compile"; prompt: string }
  | { type: "use_draft" }
  | { type: "cache_draft" }
  | { type: "discard_draft" }
  | { type: "play"; cacheIndex: number; cardId?: string }
  | { type: "mount"; cacheIndex: number; cardId?: string }
  | { type: "trap"; cacheIndex: number; cardId?: string }
  | { type: "end" };

export type LegalAction =
  | { type: "compile"; reason: string }
  | { type: "use_draft"; cardName: string; reason: string }
  | { type: "cache_draft"; cardName: string; reason: string }
  | { type: "discard_draft"; cardName: string; reason: string }
  | { type: "play"; cacheIndex: number; cardId: string; cardName: string; reason: string }
  | { type: "mount"; cacheIndex: number; cardId: string; cardName: string; reason: string }
  | { type: "trap"; cacheIndex: number; cardId: string; cardName: string; reason: string }
  | { type: "end"; reason: string };

export type DispatchPlayerActionInput = {
  state: GameState;
  boss: BossDefinition;
  compilerMode: CompilerMode;
  action: PlayerAction;
};

export async function dispatchPlayerAction(input: DispatchPlayerActionInput): Promise<GameState> {
  if (input.state.phase === "game_over") {
    return appendSystem(input.state, "ACTION: game already over.");
  }

  if (input.state.phase !== "player_turn") {
    return appendSystem(input.state, "ACTION: wait for player turn.");
  }

  if (!isLegalPlayerAction(input.state, input.action)) {
    return appendSystem(input.state, `ACTION: illegal ${input.action.type}.`);
  }

  switch (input.action.type) {
    case "compile":
      return compileIntoDraft(input.state, input.action.prompt, input.compilerMode);
    case "use_draft":
      return useDraftCard(input.state);
    case "cache_draft":
      return cacheDraftCard(input.state);
    case "discard_draft":
      return appendSystem(clearDraftCard(input.state), "DRAFT: discarded.");
    case "play":
      return playCard(input.state, "player", input.action.cacheIndex);
    case "mount":
      return mountDaemon(input.state, "player", input.action.cacheIndex);
    case "trap":
      return armKernel(input.state, "player", input.action.cacheIndex);
    case "end":
      return endPlayerTurn(input.state, input.boss);
  }
}

export function getLegalActions(state: GameState): LegalAction[] {
  if (state.phase !== "player_turn") {
    return [];
  }

  const actions: LegalAction[] = [];

  actions.push({ type: "compile", reason: state.draft === undefined ? "create a draft card" : "rewrite current draft" });

  if (state.draft !== undefined) {
    actions.push({
      type: "use_draft",
      cardName: state.draft.name,
      reason: state.draft.kind === "attack" ? "play draft now" : `install draft ${state.draft.kind}`
    });
    if (state.playerMemory.cache.length < 5) {
      actions.push({ type: "cache_draft", cardName: state.draft.name, reason: "store draft in cache" });
    }
    actions.push({ type: "discard_draft", cardName: state.draft.name, reason: "discard current draft" });
  }

  state.playerMemory.cache.forEach((card, index) => {
    if (card.cost > state.player.ram) {
      return;
    }

    if (card.kind === "attack") {
      actions.push({ type: "play", cacheIndex: index, cardId: card.id, cardName: card.name, reason: "affordable attack" });
    }

    if (card.kind === "daemon" && state.playerMemory.daemons.length < 2) {
      actions.push({
        type: "mount",
        cacheIndex: index,
        cardId: card.id,
        cardName: card.name,
        reason: "affordable daemon slot"
      });
    }

    if (card.kind === "kernel" && state.playerMemory.kernel === undefined) {
      actions.push({
        type: "trap",
        cacheIndex: index,
        cardId: card.id,
        cardName: card.name,
        reason: "affordable kernel slot"
      });
    }
  });

  actions.push({ type: "end", reason: "finish player turn" });

  return actions;
}

export function isLegalPlayerAction(state: GameState, action: PlayerAction): boolean {
  if (state.phase !== "player_turn") {
    return false;
  }

  switch (action.type) {
    case "compile":
      return action.prompt.trim().length > 0;
    case "use_draft":
      return canUseDraft(state);
    case "cache_draft":
      return state.draft !== undefined && state.playerMemory.cache.length < 5;
    case "discard_draft":
      return state.draft !== undefined;
    case "play":
      return canUseCacheCard(state, action.cacheIndex, "attack", action.cardId);
    case "mount":
      return state.playerMemory.daemons.length < 2 && canUseCacheCard(state, action.cacheIndex, "daemon", action.cardId);
    case "trap":
      return state.playerMemory.kernel === undefined && canUseCacheCard(state, action.cacheIndex, "kernel", action.cardId);
    case "end":
      return true;
  }
}

function canUseDraft(state: GameState): boolean {
  const draft = state.draft;
  if (draft === undefined || draft.cost > state.player.ram) {
    return false;
  }

  if (draft.kind === "daemon") {
    return state.playerMemory.daemons.length < 2 && state.playerMemory.cache.length < 5;
  }

  if (draft.kind === "kernel") {
    return state.playerMemory.kernel === undefined && state.playerMemory.cache.length < 5;
  }

  return state.playerMemory.cache.length < 5;
}

function canUseCacheCard(state: GameState, cacheIndex: number, kind: Card["kind"], cardId?: string): boolean {
  const card = state.playerMemory.cache[cacheIndex];
  return (
    card !== undefined &&
    card.kind === kind &&
    card.cost <= state.player.ram &&
    (cardId === undefined || card.id === cardId)
  );
}

async function compileIntoDraft(state: GameState, prompt: string, compilerMode: CompilerMode): Promise<GameState> {
  const result = await compilePrompt({
    prompt,
    actor: "player",
    turn: state.turn,
    mode: compilerMode
  });

  if (!result.ok) {
    return appendLog(state, {
      type: "compile",
      actor: "player",
      prompt,
      success: false,
      message: `${result.code}: ${result.message}`
    });
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

  return setDraftCard(warningState, result.card);
}

function appendSystem(state: GameState, message: string): GameState {
  return appendLog(state, {
    type: "system",
    message
  });
}
