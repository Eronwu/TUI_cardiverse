import { executeBossCard, setMemory } from "./actions.js";
import { applyEffects } from "./effects.js";
import { appendLog } from "./log.js";
import type { ActorId, BossDefinition, CharacterState, GameState, MemoryState } from "./types.js";
import { finalizeWinner } from "./winner.js";
import { chooseBossAction } from "./bossAi.js";

export function startTurn(state: GameState, actor: ActorId): GameState {
  const withActor: GameState = {
    ...state,
    activeActor: actor,
    phase: actor === "player" ? "player_turn" : "boss_turn"
  };

  const withRam = restoreRam(withActor, actor);
  const withDaemonEffects = tickDaemons(withRam, actor);

  return finalizeWinner(withDaemonEffects);
}

export function endPlayerTurn(state: GameState, boss: BossDefinition): GameState {
  if (state.phase === "game_over") {
    return state;
  }

  const bossTurnState = startTurn(
    {
      ...state,
      phase: "boss_turn",
      activeActor: "boss"
    },
    "boss"
  );

  if (bossTurnState.phase === "game_over") {
    return bossTurnState;
  }

  const afterBossAction = runBossAction(bossTurnState, boss);
  if (afterBossAction.phase === "game_over") {
    return afterBossAction;
  }

  return startTurn(
    {
      ...afterBossAction,
      turn: afterBossAction.turn + 1
    },
    "player"
  );
}

function runBossAction(state: GameState, boss: BossDefinition): GameState {
  const action = chooseBossAction(state, boss.deck);

  if (action.type === "wait") {
    return appendLog(state, {
      type: "system",
      message: `BOSS: wait (${action.reason}).`
    });
  }

  if (action.type === "mount_daemon") {
    return mountBossDaemon(state, action.card);
  }

  return executeBossCard(state, action.card);
}

function mountBossDaemon(state: GameState, card: BossDefinition["deck"][number]): GameState {
  if (state.boss.ram < card.cost) {
    return appendLog(state, {
      type: "system",
      message: `BOSS: insufficient RAM for ${card.name}.`
    });
  }

  if (state.bossMemory.daemons.length >= 2) {
    return appendLog(state, {
      type: "system",
      message: "BOSS: daemon slots full."
    });
  }

  const paidState: GameState = {
    ...state,
    boss: {
      ...state.boss,
      ram: state.boss.ram - card.cost
    }
  };

  const mountedState = setMemory(paidState, "boss", {
    ...paidState.bossMemory,
    daemons: [
      ...paidState.bossMemory.daemons,
      {
        card,
        remainingTurns: card.duration ?? 1
      }
    ]
  });

  return appendLog(mountedState, {
    type: "card_played",
    actor: "boss",
    cardName: card.name,
    cost: card.cost
  });
}

function restoreRam(state: GameState, actor: ActorId): GameState {
  const character = getCharacter(state, actor);
  const restored = Math.min(character.maxRam, character.ram + character.ramGainPerTurn);
  const updated = {
    ...character,
    ram: restored
  };

  const nextState = setCharacter(state, actor, updated);

  return appendLog(nextState, {
    type: "system",
    message: `RAM: ${actor} restored to ${restored}/${character.maxRam}.`
  });
}

function tickDaemons(state: GameState, actor: ActorId): GameState {
  const memory = getActorMemory(state, actor);
  let nextState = state;
  const keptDaemons: MemoryState["daemons"] = [];

  for (const daemon of memory.daemons) {
    nextState = appendLog(nextState, {
      type: "system",
      message: `DAEMON: ${daemon.card.name} ticked.`
    });
    nextState = applyEffects(nextState, daemon.card.effects, {
      source: actor,
      defaultTarget: daemon.card.target
    });

    const remainingTurns = daemon.remainingTurns - 1;
    if (remainingTurns > 0) {
      keptDaemons.push({
        ...daemon,
        remainingTurns
      });
    } else {
      nextState = appendLog(nextState, {
        type: "system",
        message: `DAEMON: ${daemon.card.name} expired.`
      });
    }
  }

  return setMemory(nextState, actor, {
    ...getActorMemory(nextState, actor),
    daemons: keptDaemons
  });
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

function getActorMemory(state: GameState, actor: ActorId): MemoryState {
  return actor === "player" ? state.playerMemory : state.bossMemory;
}
