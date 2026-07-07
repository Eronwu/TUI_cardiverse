import { appendLog } from "./log.js";
import { finalizeWinner } from "./winner.js";
import type { ActorId, CharacterState, Effect, GameState, MemoryState, Target, Track } from "./types.js";

export type EffectContext = {
  source: ActorId;
  defaultTarget: Target;
};

export function applyEffect(state: GameState, effect: Effect, context: EffectContext): GameState {
  const target = resolveTarget(context.source, effect.target ?? context.defaultTarget);

  switch (effect.type) {
    case "damage":
      return finalizeWinner(applyDamage(state, context.source, target, effect));
    case "heal":
      return finalizeWinner(applyHeal(state, context.source, target, effect));
    case "gain_ram":
      return applyGainRam(state, context.source, target, effect);
    case "shield":
      return applyShield(state, context.source, target, effect);
  }
}

export function applyEffects(state: GameState, effects: Effect[], context: EffectContext): GameState {
  return effects.reduce((nextState, effect) => applyEffect(nextState, effect, context), state);
}

function applyDamage(
  state: GameState,
  source: ActorId,
  target: ActorId,
  effect: Extract<Effect, { type: "damage" }>
): GameState {
  const character = getCharacter(state, target);
  const shieldBefore = character.shields[effect.track];
  const absorbed = Math.min(shieldBefore, effect.amount);
  const amountApplied = Math.max(0, effect.amount - absorbed);
  const updatedCharacter = updateTrack(character, effect.track, -amountApplied, {
    ...character.shields,
    [effect.track]: shieldBefore - absorbed
  });

  const nextState = setCharacter(state, target, updatedCharacter);
  const loggedState = appendLog(nextState, {
    type: "effect",
    actor: source,
    target,
    effect,
    amountApplied
  });

  return triggerKernelOnDamage(loggedState, target, effect.track);
}

function applyHeal(
  state: GameState,
  source: ActorId,
  target: ActorId,
  effect: Extract<Effect, { type: "heal" }>
): GameState {
  const character = getCharacter(state, target);
  const before = character[effect.track];
  const max = effect.track === "hp" ? character.maxHp : character.maxSanity;
  const after = Math.min(max, before + effect.amount);
  const amountApplied = after - before;
  const updatedCharacter = setTrack(character, effect.track, after);
  const nextState = setCharacter(state, target, updatedCharacter);

  return appendLog(nextState, {
    type: "effect",
    actor: source,
    target,
    effect,
    amountApplied
  });
}

function applyGainRam(
  state: GameState,
  source: ActorId,
  target: ActorId,
  effect: Extract<Effect, { type: "gain_ram" }>
): GameState {
  const character = getCharacter(state, target);
  const before = character.ram;
  const after = Math.min(character.maxRam, before + effect.amount);
  const amountApplied = after - before;
  const nextState = setCharacter(state, target, {
    ...character,
    ram: after
  });

  return appendLog(nextState, {
    type: "effect",
    actor: source,
    target,
    effect,
    amountApplied
  });
}

function applyShield(
  state: GameState,
  source: ActorId,
  target: ActorId,
  effect: Extract<Effect, { type: "shield" }>
): GameState {
  const character = getCharacter(state, target);
  const nextState = setCharacter(state, target, {
    ...character,
    shields: {
      ...character.shields,
      [effect.track]: character.shields[effect.track] + effect.amount
    }
  });

  return appendLog(nextState, {
    type: "effect",
    actor: source,
    target,
    effect,
    amountApplied: effect.amount
  });
}

function resolveTarget(source: ActorId, target: Target): ActorId {
  if (target === "self") {
    return source;
  }

  return source === "player" ? "boss" : "player";
}

function getCharacter(state: GameState, actor: ActorId): CharacterState {
  return actor === "player" ? state.player : state.boss;
}

function setCharacter(state: GameState, actor: ActorId, character: CharacterState): GameState {
  return actor === "player"
    ? {
        ...state,
        player: character
      }
    : {
        ...state,
        boss: character
      };
}

function triggerKernelOnDamage(state: GameState, damagedActor: ActorId, track: Track): GameState {
  const memory = getMemory(state, damagedActor);
  const kernel = memory.kernel;
  if (kernel === undefined) {
    return state;
  }

  const expectedTrigger = track === "hp" ? "self_takes_hp_damage" : "self_takes_sanity_damage";
  if (kernel.card.trigger?.when !== expectedTrigger) {
    return state;
  }

  const used = kernel.card.trigger.used ?? 0;
  if (used >= kernel.card.trigger.limit) {
    return state;
  }

  const { kernel: _kernel, ...memoryWithoutKernel } = memory;
  const disarmedState = setMemory(state, damagedActor, memoryWithoutKernel);

  const loggedState = appendLog(disarmedState, {
    type: "system",
    message: `KERNEL: ${kernel.card.name} triggered.`
  });

  return applyEffects(loggedState, kernel.card.effects, {
    source: damagedActor,
    defaultTarget: "enemy"
  });
}

function getMemory(state: GameState, actor: ActorId): MemoryState {
  return actor === "player" ? state.playerMemory : state.bossMemory;
}

function setMemory(state: GameState, actor: ActorId, memory: MemoryState): GameState {
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

function setTrack(character: CharacterState, track: Track, value: number): CharacterState {
  if (track === "hp") {
    return {
      ...character,
      hp: value
    };
  }

  return {
    ...character,
    sanity: value
  };
}

function updateTrack(
  character: CharacterState,
  track: Track,
  delta: number,
  shields: CharacterState["shields"]
): CharacterState {
  const nextValue = track === "hp" ? character.hp + delta : character.sanity + delta;

  return {
    ...setTrack(character, track, Math.max(0, nextValue)),
    shields
  };
}
