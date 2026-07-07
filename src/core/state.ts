import type { BossDefinition, CharacterState, GameState, MemoryState } from "./types.js";

const PLAYER_MAX_HP = 100;
const PLAYER_MAX_SANITY = 100;
const PLAYER_MAX_RAM = 20;
const PLAYER_RAM_GAIN_PER_TURN = 10;

export function createGameState(boss: BossDefinition): GameState {
  return {
    phase: "player_turn",
    turn: 1,
    activeActor: "player",
    player: createPlayerState(),
    boss: createBossState(boss),
    playerMemory: createMemoryState(),
    bossMemory: createMemoryState(),
    bossId: boss.id,
    logs: [
      {
        id: "log-1",
        turn: 1,
        type: "system",
        message: `BOOT: ${boss.name} encounter initialized.`
      },
      ...boss.intro.map((message, index) => ({
        id: `log-${index + 2}`,
        turn: 1,
        type: "system" as const,
        message
      }))
    ]
  };
}

function createPlayerState(): CharacterState {
  return {
    id: "player",
    name: "Code Walker",
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    sanity: PLAYER_MAX_SANITY,
    maxSanity: PLAYER_MAX_SANITY,
    ram: 0,
    maxRam: PLAYER_MAX_RAM,
    ramGainPerTurn: PLAYER_RAM_GAIN_PER_TURN,
    shields: {
      hp: 0,
      sanity: 0
    }
  };
}

function createBossState(boss: BossDefinition): CharacterState {
  return {
    id: "boss",
    name: boss.name,
    hp: boss.hp,
    maxHp: boss.hp,
    sanity: boss.sanity,
    maxSanity: boss.sanity,
    ram: 0,
    maxRam: boss.ramMax,
    ramGainPerTurn: boss.ramGainPerTurn,
    shields: {
      hp: 0,
      sanity: 0
    }
  };
}

function createMemoryState(): MemoryState {
  return {
    cache: [],
    daemons: [],
    discard: []
  };
}
