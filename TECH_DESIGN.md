# Technical Design - Terminal Cardiverse

**Version:** v0.2
**Date:** 2026-07-08
**Related PRD:** `PRD.md` v0.4
**Stage:** Rust + Ratatui experience build

---

## 1. Design Goal

This document translates the PRD into an implementable technical plan.

The current implementation direction is:

> A Rust + Ratatui terminal cockpit that can run one complete PVE battle against INIT ECHO, compile prompt intent into draft cards, save deterministic replay JSON, and run without a real LLM.

The first playable version should prove:

- The core battle engine is deterministic and testable.
- Prompt compilation can be stubbed locally.
- The Ratatui cockpit can drive the game through keyboard commands.
- Battle logs can be displayed and saved.
- Real LLM integration cannot change battle rules and only produces locally validated draft cards.

The previous TypeScript implementation remains in the repo as a playable prototype and oracle for migration scenarios.

---

## 2. Technical Stack

### 2.1 Runtime

- Language: Rust
- Package manager: Cargo
- Terminal UI: Ratatui + Crossterm
- Async runtime: Tokio

### 2.2 CLI

The Rust CLI exposes:

```bash
cardiverse
cardiverse play --no-ai
cardiverse replay <file>
cardiverse doctor
```

### 2.3 Terminal TUI

The experience build uses `ratatui`.

Reason:

- Higher ceiling for terminal game visuals.
- Mature layout, gauge, list, paragraph, and block primitives.
- Works well with a pure Rust deterministic core.
- Supports a full-screen cockpit rather than readline-style prompts.

### 2.4 Validation

Rust validation uses `serde` plus local validator/balancer functions. LLM output is never trusted directly.

### 2.5 Testing

Recommended:

- Rust unit tests and property tests for new crates.
- Existing Vitest suite remains for the TypeScript prototype.

Test priority:

1. Core battle engine.
2. Compiler and balance rules.
3. Command parser.
4. Storage utilities.

TUI snapshot tests are optional and should not block MVP.

### 2.6 Build

Recommended:

- `cargo install --path crates/cardiverse-cli` during local development.

Expected binary:

```txt
cardiverse
```

`package.json` should expose:

```json
{
  "bin": {
    "cardiverse": "./dist/cli.js"
  }
}
```

---

## 3. Architecture Overview

The system is split into six layers:

```txt
CLI Args
  ↓
TUI App
  ↓
Command Parser
  ↓
Compiler / Core Actions
  ↓
Core Battle Engine
  ↓
Storage / Logs
```

### 3.1 Dependency Rule

Dependencies must point inward:

```txt
tui -> commands -> compiler -> core
tui -> storage
cli -> tui
sim -> core
```

Core must not import:

- TUI code.
- CLI code.
- LLM providers.
- File system utilities.
- Environment variables.

AI/compiler may import:

- Core types.
- Balance utilities.
- HTTP clients.
- Environment-derived config.

TUI may import:

- Core public APIs.
- AI/compiler public APIs.
- Replay utilities.

The TypeScript `src/` tree is now historical prototype code. New gameplay work should happen in `crates/`.

---

## 4. Project Structure

Current Rust workspace structure:

```txt
crates/
  cardiverse-core/
    src/types.rs
    src/engine.rs
    src/action.rs
    src/balance.rs
    src/content.rs
    src/replay.rs

  cardiverse-ai/
    src/config.rs
    src/compiler.rs
    src/normalizer.rs
    src/suggest.rs

  cardiverse-tui/
    src/app.rs
    src/render.rs
    src/replay.rs

  cardiverse-cli/
    src/main.rs

src/
  ... TypeScript prototype retained for migration reference
```

The Rust implementation already includes a stub compiler and an OpenAI-compatible compiler. LLM output always enters the draft flow and never mutates battle state directly.

---

## 5. Core Domain Model

### 5.1 Primitive Types

```ts
export type ActorId = "player" | "boss";
export type Track = "hp" | "sanity";
export type Target = "self" | "enemy";
export type CardKind = "attack" | "daemon" | "kernel";
export type GamePhase = "menu" | "player_turn" | "boss_turn" | "game_over";
```

### 5.2 Effect

```ts
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
```

### 5.3 Card

```ts
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
```

### 5.4 Trigger

```ts
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
```

### 5.5 CharacterState

```ts
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
```

### 5.6 MemoryState

```ts
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
```

### 5.7 GameState

```ts
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
  winner?: ActorId;
  defeatReason?: string;
};
```

---

## 6. Battle Log Model

Battle logs are first-class data. They drive the TUI log panel, saved files, future replay, and future Web history.

### 6.1 Log Event

```ts
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
```

### 6.2 Log Rendering

Core returns structured logs. TUI is responsible for converting them to display strings:

```txt
TURN 1 / PLAYER played Thermal Spike / RAM -4
EFFECT / INIT ECHO took 16 HP damage
```

This keeps replay and UI concerns separate.

---

## 7. Core Engine APIs

The core API should be small and explicit.

### 7.1 State Creation

```ts
export function createGameState(boss: BossDefinition): GameState;
```

Responsibilities:

- Create player state.
- Create boss state.
- Initialize memory zones.
- Add initial system logs.
- Set phase to `player_turn`.
- Start at turn `1`.

### 7.2 Turn Start

```ts
export function startTurn(state: GameState, actor: ActorId): GameState;
```

Responsibilities:

- Set active actor.
- Restore RAM up to max.
- Execute actor daemons.
- Decrement daemon durations.
- Remove expired daemons.
- Check winner after effects.

### 7.3 Play Card

```ts
export function playCard(
  state: GameState,
  actor: ActorId,
  cacheIndex: number
): GameState;
```

Rules:

- Card must exist in actor cache.
- Card kind must be `attack`.
- Actor must have enough RAM.
- Pay cost.
- Apply effects.
- Apply backlash if present.
- Move card to discard.
- Check triggers.
- Check winner.

### 7.4 Mount Daemon

```ts
export function mountDaemon(
  state: GameState,
  actor: ActorId,
  cacheIndex: number
): GameState;
```

Rules:

- Card kind must be `daemon`.
- Daemon slot count must be under limit.
- Actor must have enough RAM.
- Pay cost.
- Move from cache to daemons.
- Use `duration` or default duration.

### 7.5 Arm Kernel

```ts
export function armKernel(
  state: GameState,
  actor: ActorId,
  cacheIndex: number
): GameState;
```

Rules:

- Card kind must be `kernel`.
- Kernel slot must be empty.
- Actor must have enough RAM.
- Pay cost.
- Move from cache to kernel.

### 7.6 Add Card To Cache

```ts
export function addCardToCache(
  state: GameState,
  actor: ActorId,
  card: Card
): GameState;
```

Rules:

- Cache max size is `5`.
- If full, return state with an error log and do not add card.

### 7.7 End Player Turn

```ts
export function endPlayerTurn(state: GameState): GameState;
```

Responsibilities:

- Change phase to `boss_turn`.
- Run boss turn.
- If no winner, increment turn.
- Start next player turn.

For MVP, `endPlayerTurn` may run the full boss action synchronously.

---

## 8. Boss Model

### 8.1 BossDefinition

```ts
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
```

### 8.2 Boss AI

```ts
export function chooseBossAction(state: GameState): BossAction;
```

```ts
export type BossAction =
  | { type: "play_card"; card: Card }
  | { type: "mount_daemon"; card: Card }
  | { type: "wait"; reason: string };
```

MVP strategy:

1. If Boss HP is below `50` and no defensive daemon is active, use `Checksum Skin`.
2. If player Sanity is below `35`, prefer `Echo Doubt` or `Boot Loop`.
3. If player HP is below `35`, prefer `Static Pulse` or `Boot Loop`.
4. Otherwise choose the first affordable card.
5. If no card is affordable, wait.

Implementation note:

- Boss cards do not need to exist in cache for MVP.
- Boss can choose from its fixed deck each turn.
- This keeps the first boss deterministic and easy to tune.

---

## 9. Compiler Design

### 9.1 Compiler Public API

```ts
export type CompileInput = {
  prompt: string;
  actor: ActorId;
  turn: number;
  mode: "stub" | "llm";
};

export type CompileSuccess = {
  ok: true;
  card: Card;
  warnings: string[];
};

export type CompileFailure = {
  ok: false;
  code:
    | "EMPTY_PROMPT"
    | "ILLEGAL_RULE_MUTATION"
    | "SCHEMA_INVALID"
    | "COMPILER_UNAVAILABLE"
    | "CORRUPTED_FILE";
  message: string;
};

export type CompileResult = CompileSuccess | CompileFailure;

export async function compilePrompt(input: CompileInput): Promise<CompileResult>;
```

### 9.2 Stub Compiler

The stub compiler should be deterministic.

Keyword rules:

| Prompt contains | Card |
|---|---|
| `thermal`, `fire`, `heat`, `burn` | HP damage attack |
| `recursive`, `doubt`, `loop`, `paradox` | Sanity damage attack |
| `repair`, `cool`, `heal` | HP heal daemon |
| `mirror`, `reflect`, `trap` | Kernel counter |
| `blackhole`, `destroy`, `delete`, `infinite` | Rejected or high-cost backlash card |
| none matched | Small generic attack |

### 9.3 Schema Validation

All compiler outputs pass through:

```txt
candidate card
  ↓
zod schema
  ↓
balance engine
  ↓
final card
```

If schema fails, return:

```txt
CORRUPTED_FILE
```

### 9.4 Balance Engine

```ts
export function balanceCard(input: {
  card: Card;
  prompt: string;
}): {
  card: Card;
  warnings: string[];
};
```

Responsibilities:

- Clamp effect amounts.
- Recalculate cost.
- Add backlash to forbidden-scale cards.
- Enforce max effect count.
- Enforce duration limits.
- Enforce kernel trigger limit.

---

## 10. Command Design

### 10.0 Interaction v0.2

The terminal should not require players to memorize command syntax.

Default input behavior:

- Plain natural language is treated as a compile prompt.
- Compile produces a `draft` card, not an immediate cache insert.
- Draft controls: `p` use now, `c` cache, `r <prompt>` rewrite, `x` discard.
- `1-5` plays cache cards.
- `d1-d5` mounts daemon cards.
- `k1-k5` arms kernel cards.
- `e` ends turn.
- `a` asks for an AI suggestion.
- `g` lets AI play the current turn.
- `q` quits.
- `:` prefixes power-user commands, such as `:log` or `:save-log`.

AI control is handled through structured `PlayerAction` values. AI cannot directly mutate `GameState`; actions are validated and dispatched through the same path used by human commands.

LLM card compilation uses:

```txt
OpenAI Responses API -> JSON Schema output -> Zod runtime validation -> balance engine -> draft card
```

Provider environment variable priority:

```txt
LLM_API_BASE_URL / LLM_API_KEY / LLM_MODEL_NAME
  fallback to
OPENAI_API_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL
```

Third-party providers such as agnes-ai can use either an OpenAI-compatible `/responses` endpoint or a `/chat/completions` endpoint.

`LLM_API_STYLE` controls endpoint selection:

- `auto`: try `/responses`, fallback to `/chat/completions`.
- `responses`: force `/responses`.
- `chat_completions`: force `/chat/completions`.

### 10.1 Command Type

```ts
export type ParsedCommand =
  | { type: "help" }
  | { type: "new" }
  | { type: "status" }
  | { type: "compile"; prompt: string }
  | { type: "play"; cacheIndex: number }
  | { type: "mount"; cacheIndex: number }
  | { type: "trap"; cacheIndex: number }
  | { type: "inspect"; zone: "cache" | "daemon" | "kernel" | "discard"; index?: number }
  | { type: "end" }
  | { type: "log" }
  | { type: "save_log" }
  | { type: "settings" }
  | { type: "restart" }
  | { type: "quit" }
  | { type: "unknown"; raw: string };
```

### 10.2 Parser

```ts
export function parseCommand(input: string): ParsedCommand;
```

Parser rules:

- Trim whitespace.
- Empty input returns `unknown`.
- Commands are case-insensitive.
- Prompt text after `compile` is preserved exactly except leading whitespace.
- Numeric indexes are base-10.

### 10.3 Command Handler

```ts
export async function handleCommand(input: {
  command: ParsedCommand;
  state: GameState;
  compilerMode: "stub" | "llm";
}): Promise<{
  state: GameState;
  shouldQuit?: boolean;
}>;
```

Handler calls:

- `compile` -> compiler -> `addCardToCache`.
- `play` -> `playCard`.
- `mount` -> `mountDaemon`.
- `trap` -> `armKernel`.
- `end` -> `endPlayerTurn`.
- `restart` -> `createGameState`.
- `save_log` -> storage.

---

## 11. TUI Design

### 11.1 Screens

MVP screens:

- Main battle screen.
- Help view.
- Inspect card view.
- Full log view.
- Game over view.

Menu screen is optional. It is acceptable for MVP to launch directly into a new INIT ECHO battle.

### 11.2 Battle Screen Panels

Panels:

1. Status panel
   - Player HP / Sanity / RAM.
   - Boss HP / Sanity / RAM.
   - Current turn.

2. Memory panel
   - Cache slots.
   - Daemon slots.
   - Kernel slot.

3. Boss panel
   - Boss name.
   - Boss ASCII art.
   - Short phase/status line.

4. Log panel
   - Last 8-12 rendered log lines.

5. Command input
   - Prompt-like input: `cardiverse>`.

### 11.3 Layout Modes

Layout should inspect terminal size.

Recommended:

- Standard mode: width >= 100 and height >= 30.
- Compact mode: smaller than standard.

MVP may implement compact rendering first and add panel borders later.

### 11.4 TUI State

TUI should keep only UI state:

- Current input text.
- Command history.
- Focused view.
- Inspect modal state.
- Full log mode.

Game state lives in `core`.

---

## 12. Storage Design

### 12.1 Paths

Use home directory:

```txt
~/.terminal-cardiverse/
  config.json
  logs/
```

### 12.2 Config

```ts
export type UserConfig = {
  compilerMode: "stub" | "llm";
  provider?: "ollama" | "openai";
  debug: boolean;
};
```

Default:

```json
{
  "compilerMode": "stub",
  "debug": false
}
```

### 12.3 Battle Log Save Format

Save as JSON Lines:

```txt
~/.terminal-cardiverse/logs/2026-07-07T12-30-00-init-echo.jsonl
```

Each line is one `BattleLogEvent`.

---

## 13. Headless Simulation

Headless simulation is not needed before MVP is playable, but the core should support it naturally.

Future API:

```ts
export function runHeadlessBattle(input: {
  boss: BossDefinition;
  playerStrategy: PlayerStrategy;
  seed?: string;
}): HeadlessBattleResult;
```

Do not add random behavior to core before seed handling exists.

---

## 14. Implementation Plan

### Task 1 - Project Scaffold

Create:

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/cli/index.ts`
- Build scripts.
- Test scripts.

Acceptance:

- `npm test` runs.
- `npm run build` emits `dist/cli.js`.
- `node dist/cli.js --help` works.

### Task 2 - Core Types And Initial State

Create:

- `src/core/types.ts`
- `src/core/state.ts`
- `src/content/bosses/initEcho.ts`

Acceptance:

- `createGameState(initEcho)` returns valid initial state.
- Unit tests assert player, boss, memory, turn, phase.

### Task 3 - Effects And Win Conditions

Create:

- `src/core/effects.ts`
- `src/core/winner.ts`
- `src/core/log.ts`

Acceptance:

- Damage applies to HP and Sanity.
- Shields reduce damage.
- Heal clamps to max.
- Winner is detected when HP or Sanity reaches 0.

### Task 4 - Player Actions

Create:

- `src/core/actions.ts`

Acceptance:

- Add card to cache.
- Play attack.
- Mount daemon.
- Arm kernel.
- RAM cost enforced.
- Slot limits enforced.

### Task 5 - Turn Flow And Boss AI

Create:

- `src/core/turn.ts`
- `src/core/bossAi.ts`

Acceptance:

- Player can end turn.
- Boss restores RAM and acts.
- New player turn starts.
- Daemons tick and expire.

### Task 6 - Compiler v0

Create:

- `src/compiler/schema.ts`
- `src/compiler/stubCompiler.ts`
- `src/compiler/balance.ts`
- `src/compiler/types.ts`

Acceptance:

- `compile thermal spike` returns HP attack.
- `compile recursive doubt` returns Sanity attack.
- Illegal mutation prompt is rejected.
- Overpowered prompt is clamped or gets backlash.

### Task 7 - Command Parser And Handlers

Create:

- `src/commands/parser.ts`
- `src/commands/handlers.ts`
- `src/commands/types.ts`

Acceptance:

- All MVP commands parse.
- Compile command preserves prompt text.
- Handlers update state correctly.

### Task 8 - Terminal TUI

Create:

- `src/tui/App.tsx`
- `src/tui/BattleScreen.tsx`
- TUI components.

Acceptance:

- CLI launches battle screen.
- User can type commands.
- State and logs update.
- Game can be won or lost.

### Task 9 - Local Storage

Create:

- `src/storage/paths.ts`
- `src/storage/config.ts`
- `src/storage/battleLog.ts`

Acceptance:

- Config dir is created automatically.
- Battle log can be saved.
- `save-log` prints saved path.

---

## 15. First Playable Definition

The first playable build is done when:

- `npm run build` succeeds.
- `npx .` or `node dist/cli.js` starts the game.
- User can run:

```txt
thermal spike
p
e
:status
```

- INIT ECHO can damage the player.
- Player can defeat INIT ECHO.
- INIT ECHO can defeat the player.
- Logs explain every state change.
- No real LLM is required.

---

## 16. Open Technical Questions

These should be answered during implementation, not before all coding starts:

1. Is Ink sufficient for stable command input and panel rendering?
2. Should battle logs use generated UUIDs or deterministic incremental IDs?
3. Should Boss action cards bypass cache permanently in MVP?
4. Should `compile` consume RAM, or only playing/mounting/trapping cards consume RAM?
5. Should Daemon effects trigger at actor turn start or global turn start?

Recommended MVP answers:

1. Try Ink first.
2. Use deterministic incremental IDs.
3. Yes, Boss can choose directly from fixed deck.
4. Compile should not consume RAM in MVP; card execution consumes RAM.
5. Daemons trigger at owner turn start.
