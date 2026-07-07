import { applyEffects } from "./effects.js";
import { appendLog } from "./log.js";
import type { ActorId, Card, GameState, MemoryState } from "./types.js";
import { finalizeWinner } from "./winner.js";

export const CACHE_LIMIT = 5;
export const DAEMON_LIMIT = 2;

export function addCardToCache(state: GameState, actor: ActorId, card: Card): GameState {
  const memory = getMemory(state, actor);

  if (memory.cache.length >= CACHE_LIMIT) {
    return appendLog(state, {
      type: "system",
      message: `CACHE: ${actor} cache full; ${card.name} discarded.`
    });
  }

  return setMemory(state, actor, {
    ...memory,
    cache: [...memory.cache, card]
  });
}

export function setDraftCard(state: GameState, card: Card): GameState {
  return {
    ...state,
    draft: card
  };
}

export function clearDraftCard(state: GameState): GameState {
  const { draft: _draft, ...stateWithoutDraft } = state;
  return stateWithoutDraft;
}

export function cacheDraftCard(state: GameState): GameState {
  if (state.draft === undefined) {
    return appendLog(state, {
      type: "system",
      message: "DRAFT: no compiled card pending."
    });
  }

  const draft = state.draft;
  return addCardToCache(clearDraftCard(state), "player", draft);
}

export function useDraftCard(state: GameState): GameState {
  if (state.draft === undefined) {
    return appendLog(state, {
      type: "system",
      message: "DRAFT: no compiled card pending."
    });
  }

  const draft = state.draft;
  const withCache = addCardToCache(clearDraftCard(state), "player", draft);
  const cacheIndex = withCache.playerMemory.cache.findIndex((card) => card.id === draft.id);
  if (cacheIndex < 0) {
    return withCache;
  }

  if (draft.kind === "attack") {
    return playCard(withCache, "player", cacheIndex);
  }

  if (draft.kind === "daemon") {
    return mountDaemon(withCache, "player", cacheIndex);
  }

  return armKernel(withCache, "player", cacheIndex);
}

export function playCard(state: GameState, actor: ActorId, cacheIndex: number): GameState {
  const card = getCacheCard(state, actor, cacheIndex);

  if (card === undefined) {
    return appendLog(state, {
      type: "system",
      message: `ACTION: cache slot ${cacheIndex} is empty.`
    });
  }

  if (card.kind !== "attack") {
    return appendLog(state, {
      type: "system",
      message: `ACTION: ${card.name} is not an attack card.`
    });
  }

  return executeCachedCard(state, actor, cacheIndex, card);
}

export function mountDaemon(state: GameState, actor: ActorId, cacheIndex: number): GameState {
  const card = getCacheCard(state, actor, cacheIndex);

  if (card === undefined) {
    return appendLog(state, {
      type: "system",
      message: `ACTION: cache slot ${cacheIndex} is empty.`
    });
  }

  if (card.kind !== "daemon") {
    return appendLog(state, {
      type: "system",
      message: `ACTION: ${card.name} is not a daemon card.`
    });
  }

  const memory = getMemory(state, actor);
  if (memory.daemons.length >= DAEMON_LIMIT) {
    return appendLog(state, {
      type: "system",
      message: "DAEMON: no free daemon slots."
    });
  }

  const paidState = spendRam(state, actor, card.cost);
  if (paidState === undefined) {
    return appendLog(state, {
      type: "system",
      message: `RAM: insufficient RAM for ${card.name}.`
    });
  }

  const paidMemory = getMemory(paidState, actor);
  const nextMemory = removeCacheCard(paidMemory, cacheIndex);
  const mountedState = setMemory(paidState, actor, {
    ...nextMemory,
    daemons: [
      ...nextMemory.daemons,
      {
        card,
        remainingTurns: card.duration ?? 1
      }
    ]
  });

  return appendLog(mountedState, {
    type: "card_played",
    actor,
    cardName: card.name,
    cost: card.cost
  });
}

export function armKernel(state: GameState, actor: ActorId, cacheIndex: number): GameState {
  const card = getCacheCard(state, actor, cacheIndex);

  if (card === undefined) {
    return appendLog(state, {
      type: "system",
      message: `ACTION: cache slot ${cacheIndex} is empty.`
    });
  }

  if (card.kind !== "kernel") {
    return appendLog(state, {
      type: "system",
      message: `ACTION: ${card.name} is not a kernel card.`
    });
  }

  const memory = getMemory(state, actor);
  if (memory.kernel !== undefined) {
    return appendLog(state, {
      type: "system",
      message: "KERNEL: slot already armed."
    });
  }

  const paidState = spendRam(state, actor, card.cost);
  if (paidState === undefined) {
    return appendLog(state, {
      type: "system",
      message: `RAM: insufficient RAM for ${card.name}.`
    });
  }

  const paidMemory = getMemory(paidState, actor);
  const nextMemory = removeCacheCard(paidMemory, cacheIndex);
  const armedState = setMemory(paidState, actor, {
    ...nextMemory,
    kernel: { card }
  });

  return appendLog(armedState, {
    type: "card_played",
    actor,
    cardName: card.name,
    cost: card.cost
  });
}

export function executeBossCard(state: GameState, card: Card): GameState {
  const paidState = spendRam(state, "boss", card.cost);
  if (paidState === undefined) {
    return appendLog(state, {
      type: "system",
      message: `BOSS: insufficient RAM for ${card.name}.`
    });
  }

  const playedState = appendLog(paidState, {
    type: "card_played",
    actor: "boss",
    cardName: card.name,
    cost: card.cost
  });

  const effectedState = applyEffects(playedState, card.effects, {
    source: "boss",
    defaultTarget: card.target
  });

  if (card.backlash !== undefined) {
    return applyEffects(effectedState, card.backlash.effects, {
      source: "boss",
      defaultTarget: "self"
    });
  }

  return effectedState;
}

function executeCachedCard(state: GameState, actor: ActorId, cacheIndex: number, card: Card): GameState {
  const paidState = spendRam(state, actor, card.cost);
  if (paidState === undefined) {
    return appendLog(state, {
      type: "system",
      message: `RAM: insufficient RAM for ${card.name}.`
    });
  }

  const memory = getMemory(paidState, actor);
  const nextMemory = removeCacheCard(memory, cacheIndex);
  const withoutCardState = setMemory(paidState, actor, {
    ...nextMemory,
    discard: [...nextMemory.discard, card]
  });

  const playedState = appendLog(withoutCardState, {
    type: "card_played",
    actor,
    cardName: card.name,
    cost: card.cost
  });

  const effectedState = applyEffects(playedState, card.effects, {
    source: actor,
    defaultTarget: card.target
  });

  const backlashState =
    card.backlash === undefined
      ? effectedState
      : applyEffects(effectedState, card.backlash.effects, {
          source: actor,
          defaultTarget: "self"
        });

  return finalizeWinner(backlashState);
}

export function getMemory(state: GameState, actor: ActorId): MemoryState {
  return actor === "player" ? state.playerMemory : state.bossMemory;
}

export function setMemory(state: GameState, actor: ActorId, memory: MemoryState): GameState {
  return actor === "player"
    ? {
        ...state,
        playerMemory: memory
      }
    : {
        ...state,
        bossMemory: memory
      };
}

function getCacheCard(state: GameState, actor: ActorId, cacheIndex: number): Card | undefined {
  return getMemory(state, actor).cache[cacheIndex];
}

function removeCacheCard(memory: MemoryState, cacheIndex: number): MemoryState {
  return {
    ...memory,
    cache: memory.cache.filter((_, index) => index !== cacheIndex)
  };
}

function spendRam(state: GameState, actor: ActorId, cost: number): GameState | undefined {
  const character = actor === "player" ? state.player : state.boss;
  if (character.ram < cost) {
    return undefined;
  }

  const updatedCharacter = {
    ...character,
    ram: character.ram - cost
  };

  return actor === "player"
    ? {
        ...state,
        player: updatedCharacter
      }
    : {
        ...state,
        boss: updatedCharacter
      };
}
