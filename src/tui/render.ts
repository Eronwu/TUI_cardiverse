import type { BattleLogEvent, Effect, GameState } from "../core/types.js";
import type { BossDefinition } from "../core/types.js";

export function renderBattle(state: GameState, boss: BossDefinition): string {
  return [
    "================ TERMINAL CARDIVERSE ================",
    renderStatus(state),
    "",
    renderMemory(state),
    "",
    renderBoss(boss),
    "",
    "SYSTEM LOG",
    ...state.logs.slice(-10).map(renderLogEvent),
    "====================================================="
  ].join("\n");
}

export function renderFullLog(state: GameState): string {
  return state.logs.map(renderLogEvent).join("\n");
}

export function renderLogEvent(log: BattleLogEvent): string {
  switch (log.type) {
    case "system":
      return `[${log.turn}] ${log.message}`;
    case "compile":
      return `[${log.turn}] COMPILER: ${log.success ? "ok" : "failed"} / ${log.message}`;
    case "card_played":
      return `[${log.turn}] ${log.actor.toUpperCase()} played ${log.cardName} / RAM -${log.cost}`;
    case "effect":
      return `[${log.turn}] EFFECT: ${log.target} ${effectToText(log.effect)} / applied ${log.amountApplied}`;
    case "winner":
      return `[${log.turn}] WINNER: ${log.winner.toUpperCase()} / ${log.reason}`;
  }
}

function renderStatus(state: GameState): string {
  return [
    `TURN ${state.turn}`,
    `PHASE ${state.phase}`,
    `PLAYER hp:${state.player.hp}/${state.player.maxHp} sanity:${state.player.sanity}/${state.player.maxSanity} ram:${state.player.ram}/${state.player.maxRam}`,
    `BOSS hp:${state.boss.hp}/${state.boss.maxHp} sanity:${state.boss.sanity}/${state.boss.maxSanity} ram:${state.boss.ram}/${state.boss.maxRam}`
  ].join(" | ");
}

function renderMemory(state: GameState): string {
  const cache =
    state.playerMemory.cache.length === 0
      ? "[empty]"
      : state.playerMemory.cache.map((card, index) => `[${index}] ${card.name}(${card.cost})`).join("  ");
  const daemons =
    state.playerMemory.daemons.length === 0
      ? "[empty] [empty]"
      : state.playerMemory.daemons
          .map((daemon, index) => `[${index}] ${daemon.card.name}:${daemon.remainingTurns}`)
          .join("  ");
  const kernel =
    state.playerMemory.kernel === undefined ? "[empty]" : `[armed] ${state.playerMemory.kernel.card.name}`;

  return ["MEMORY MAP", `CACHE  ${cache}`, `DAEMON ${daemons}`, `KERNEL ${kernel}`].join("\n");
}

function renderBoss(boss: BossDefinition): string {
  return ["BOSS MATRIX", `${boss.name} / ${boss.title}`, ...boss.ascii].join("\n");
}

function effectToText(effect: Effect): string {
  switch (effect.type) {
    case "damage":
      return `damage ${effect.track} ${effect.amount}`;
    case "heal":
      return `heal ${effect.track} ${effect.amount}`;
    case "gain_ram":
      return `gain_ram ${effect.amount}`;
    case "shield":
      return `shield ${effect.track} ${effect.amount}`;
  }
}
