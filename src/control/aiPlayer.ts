import type { BossDefinition, GameState } from "../core/types.js";
import type { CompilerMode } from "../compiler/types.js";
import { dispatchPlayerAction, getLegalActions, type PlayerAction } from "./playerActions.js";

export type AiSuggestion = {
  action: PlayerAction;
  reason: string;
};

export function suggestPlayerAction(state: GameState): AiSuggestion {
  const legalActions = getLegalActions(state);

  const usableDraft = legalActions.find((action) => action.type === "use_draft");
  if (usableDraft !== undefined) {
    return {
      action: { type: "use_draft" },
      reason: `Use draft ${usableDraft.cardName}; it is ready now.`
    };
  }

  const playableAttack = legalActions.find((action) => action.type === "play");
  if (playableAttack !== undefined) {
    return {
      action: { type: "play", cacheIndex: playableAttack.cacheIndex, cardId: playableAttack.cardId },
      reason: `Play ${playableAttack.cardName}; it is affordable now.`
    };
  }

  const mountableDaemon = legalActions.find((action) => action.type === "mount");
  if (mountableDaemon !== undefined && state.player.hp < state.player.maxHp) {
    return {
      action: { type: "mount", cacheIndex: mountableDaemon.cacheIndex, cardId: mountableDaemon.cardId },
      reason: `Mount ${mountableDaemon.cardName}; player HP is damaged.`
    };
  }

  const trappableKernel = legalActions.find((action) => action.type === "trap");
  if (trappableKernel !== undefined && state.playerMemory.kernel === undefined) {
    return {
      action: { type: "trap", cacheIndex: trappableKernel.cacheIndex, cardId: trappableKernel.cardId },
      reason: `Arm ${trappableKernel.cardName}; no kernel is active.`
    };
  }

  if (legalActions.some((action) => action.type === "compile")) {
    const prompt = choosePrompt(state);
    return {
      action: { type: "compile", prompt },
      reason: `Compile "${prompt}" to create a useful card.`
    };
  }

  return {
    action: { type: "end" },
    reason: "No useful affordable card is available."
  };
}

export async function runAutoTurn(input: {
  state: GameState;
  boss: BossDefinition;
  compilerMode: CompilerMode;
  maxSteps?: number;
}): Promise<GameState> {
  const maxSteps = input.maxSteps ?? 8;
  let state = input.state;

  for (let step = 0; step < maxSteps; step += 1) {
    if (state.phase === "game_over") {
      return state;
    }

    const suggestion = suggestPlayerAction(state);
    state = await dispatchPlayerAction({
      state,
      boss: input.boss,
      compilerMode: input.compilerMode,
      action: suggestion.action
    });

    if (suggestion.action.type === "end" || state.phase === "game_over") {
      return state;
    }
  }

  return dispatchPlayerAction({
    state,
    boss: input.boss,
    compilerMode: input.compilerMode,
    action: { type: "end" }
  });
}

function choosePrompt(state: GameState): string {
  if (state.boss.sanity < state.boss.hp) {
    return "recursive doubt loop";
  }

  if (state.player.hp < 60) {
    return "cool repair loop";
  }

  return "thermal spike";
}
