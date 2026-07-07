import type { Card, GameState } from "./types.js";

export type BossAction =
  | { type: "play_card"; card: Card }
  | { type: "mount_daemon"; card: Card }
  | { type: "wait"; reason: string };

export function chooseBossAction(state: GameState, deck: Card[]): BossAction {
  const affordable = deck.filter((card) => card.cost <= state.boss.ram);

  if (affordable.length === 0) {
    return { type: "wait", reason: "NO_AFFORDABLE_CARD" };
  }

  const hasDefensiveDaemon = state.bossMemory.daemons.some((daemon) =>
    daemon.card.tags.includes("defense")
  );
  const checksumSkin = affordable.find((card) => card.name === "Checksum Skin");
  if (state.boss.hp < 50 && !hasDefensiveDaemon && checksumSkin !== undefined) {
    return { type: "mount_daemon", card: checksumSkin };
  }

  if (state.player.sanity < 35) {
    const sanityFinisher = affordable.find(
      (card) => card.name === "Echo Doubt" || card.name === "Boot Loop"
    );
    if (sanityFinisher !== undefined) {
      return { type: "play_card", card: sanityFinisher };
    }
  }

  if (state.player.hp < 35) {
    const hpFinisher = affordable.find(
      (card) => card.name === "Static Pulse" || card.name === "Boot Loop"
    );
    if (hpFinisher !== undefined) {
      return { type: "play_card", card: hpFinisher };
    }
  }

  const first = affordable[0];
  if (first === undefined) {
    return { type: "wait", reason: "NO_CARD" };
  }

  return first.kind === "daemon" ? { type: "mount_daemon", card: first } : { type: "play_card", card: first };
}
