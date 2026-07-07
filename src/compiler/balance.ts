import type { Card, Effect } from "../core/types.js";

const MAX_EFFECTS = 3;
const MAX_DAMAGE = 30;
const MAX_HEAL = 20;
const MAX_COST = 10;
const MIN_COST = 1;
const MAX_DAEMON_DURATION = 4;

export type BalanceResult = {
  card: Card;
  warnings: string[];
};

export function balanceCard(input: { card: Card; prompt: string }): BalanceResult {
  const warnings: string[] = [];
  const effects = input.card.effects.slice(0, MAX_EFFECTS).map((effect) => clampEffect(effect, warnings));

  if (input.card.effects.length > MAX_EFFECTS) {
    warnings.push("BALANCE: effect list truncated to 3.");
  }

  const duration =
    input.card.kind === "daemon" ? Math.min(input.card.duration ?? 1, MAX_DAEMON_DURATION) : undefined;
  if (input.card.kind === "daemon" && input.card.duration !== undefined && input.card.duration > MAX_DAEMON_DURATION) {
    warnings.push("BALANCE: daemon duration clamped to 4.");
  }

  const trigger =
    input.card.kind === "kernel" && input.card.trigger !== undefined
      ? {
          ...input.card.trigger,
          limit: 1
        }
      : input.card.trigger;
  if (input.card.kind === "kernel" && input.card.trigger !== undefined && input.card.trigger.limit !== 1) {
    warnings.push("BALANCE: kernel trigger limit forced to 1.");
  }

  const needsBacklash = isForbiddenScale(input.prompt, effects);
  const backlash =
    needsBacklash && input.card.backlash === undefined
      ? {
          reason: "Forbidden-scale prompt requires sanity recoil.",
          effects: [{ type: "damage" as const, track: "sanity" as const, amount: 12, target: "self" as const }]
        }
      : input.card.backlash;
  if (needsBacklash && input.card.backlash === undefined) {
    warnings.push("BALANCE: backlash added.");
  }

  const cost = clampCost(calculateCost(input.prompt, input.card.kind, effects, backlash !== undefined));
  if (cost !== input.card.cost) {
    warnings.push(`BALANCE: cost overwritten from ${input.card.cost} to ${cost}.`);
  }

  const balanced: Card = {
    ...input.card,
    effects,
    cost,
    ...(duration !== undefined ? { duration } : {}),
    ...(trigger !== undefined ? { trigger } : {}),
    ...(backlash !== undefined ? { backlash } : {})
  };

  return { card: balanced, warnings };
}

function clampEffect(effect: Effect, warnings: string[]): Effect {
  if (effect.type === "damage" && effect.amount > MAX_DAMAGE) {
    warnings.push("BALANCE: damage clamped to 30.");
    return { ...effect, amount: MAX_DAMAGE };
  }

  if (effect.type === "heal" && effect.amount > MAX_HEAL) {
    warnings.push("BALANCE: heal clamped to 20.");
    return { ...effect, amount: MAX_HEAL };
  }

  return effect;
}

function calculateCost(prompt: string, kind: Card["kind"], effects: Effect[], hasBacklash: boolean): number {
  const damageTotal = effects
    .filter((effect): effect is Extract<Effect, { type: "damage" }> => effect.type === "damage")
    .reduce((sum, effect) => sum + effect.amount, 0);
  const statusCost = 0;
  const persistenceCost = kind === "daemon" ? 3 : kind === "kernel" ? 4 : 0;
  const drawbackDiscount = hasBacklash ? 2 : 0;
  const hybridCost =
    new Set(
      effects
        .filter((effect): effect is Extract<Effect, { type: "damage" | "heal" | "shield" }> => "track" in effect)
        .map((effect) => effect.track)
    ).size > 1
      ? 2
      : 0;

  return (
    1 +
    Math.ceil(prompt.length / 32) +
    Math.ceil(damageTotal / 10) +
    statusCost +
    persistenceCost +
    hybridCost -
    drawbackDiscount
  );
}

function clampCost(cost: number): number {
  return Math.max(MIN_COST, Math.min(MAX_COST, cost));
}

function isForbiddenScale(prompt: string, effects: Effect[]): boolean {
  const lowerPrompt = prompt.toLowerCase();
  const forbiddenPrompt =
    lowerPrompt.includes("blackhole") ||
    lowerPrompt.includes("black hole") ||
    lowerPrompt.includes("destroy") ||
    lowerPrompt.includes("delete") ||
    lowerPrompt.includes("infinite");
  const largeDamage = effects.some((effect) => effect.type === "damage" && effect.amount >= MAX_DAMAGE);

  return forbiddenPrompt || largeDamage;
}
