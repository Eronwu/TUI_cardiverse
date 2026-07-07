export type ActorId = "player" | "boss";
export type Track = "hp" | "sanity";
export type Target = "self" | "enemy";
export type CardKind = "attack" | "daemon" | "kernel";
export type GamePhase = "menu" | "player_turn" | "boss_turn" | "game_over";

export type Effect =
  | {
      type: "damage";
      track: Track;
      amount: number;
      target?: Target;
    }
  | {
      type: "heal";
      track: Track;
      amount: number;
      target?: Target;
    }
  | {
      type: "gain_ram";
      amount: number;
      target?: Target;
    }
  | {
      type: "shield";
      track: Track;
      amount: number;
      target?: Target;
    };

export type Trigger = {
  when:
    | "self_takes_hp_damage"
    | "self_takes_sanity_damage"
    | "enemy_plays_daemon"
    | "enemy_plays_kernel"
    | "turn_start";
  limit: number;
  used?: number;
};

export type Backlash = {
  effects: Effect[];
  reason: string;
};

export type Card = {
  id: string;
  kind: CardKind;
  name: string;
  description: string;
  target: Target;
  cost: number;
  effects: Effect[];
  tags: string[];
  duration?: number;
  trigger?: Trigger;
  backlash?: Backlash;
  sourcePrompt?: string;
};

export type CharacterState = {
  id: ActorId;
  name: string;
  hp: number;
  maxHp: number;
  sanity: number;
  maxSanity: number;
  ram: number;
  maxRam: number;
  ramGainPerTurn: number;
  shields: {
    hp: number;
    sanity: number;
  };
};

export type ActiveDaemon = {
  card: Card;
  remainingTurns: number;
};

export type ActiveKernel = {
  card: Card;
};

export type MemoryState = {
  cache: Card[];
  daemons: ActiveDaemon[];
  kernel?: ActiveKernel;
  discard: Card[];
};

export type BattleLogEvent =
  | {
      id: string;
      turn: number;
      type: "system";
      message: string;
    }
  | {
      id: string;
      turn: number;
      type: "compile";
      actor: ActorId;
      prompt: string;
      cardName?: string;
      success: boolean;
      message: string;
    }
  | {
      id: string;
      turn: number;
      type: "card_played";
      actor: ActorId;
      cardName: string;
      cost: number;
    }
  | {
      id: string;
      turn: number;
      type: "effect";
      actor: ActorId;
      target: ActorId;
      effect: Effect;
      amountApplied: number;
    }
  | {
      id: string;
      turn: number;
      type: "winner";
      winner: ActorId;
      reason: string;
    };

export type GameState = {
  phase: GamePhase;
  turn: number;
  activeActor: ActorId;
  player: CharacterState;
  boss: CharacterState;
  playerMemory: MemoryState;
  bossMemory: MemoryState;
  bossId: string;
  logs: BattleLogEvent[];
  draft?: Card;
  winner?: ActorId;
  defeatReason?: string;
};

export type BossDefinition = {
  id: string;
  name: string;
  title: string;
  ascii: string[];
  hp: number;
  sanity: number;
  ramMax: number;
  ramGainPerTurn: number;
  deck: Card[];
  intro: string[];
};
