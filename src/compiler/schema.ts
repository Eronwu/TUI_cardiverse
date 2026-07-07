import { z } from "zod";
import type { Card } from "../core/types.js";

const trackSchema = z.enum(["hp", "sanity"]);
const targetSchema = z.enum(["self", "enemy"]);

const effectSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("damage"),
      track: trackSchema,
      amount: z.number().int().positive(),
      target: targetSchema.optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("heal"),
      track: trackSchema,
      amount: z.number().int().positive(),
      target: targetSchema.optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("gain_ram"),
      amount: z.number().int().positive(),
      target: targetSchema.optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("shield"),
      track: trackSchema,
      amount: z.number().int().positive(),
      target: targetSchema.optional()
    })
    .strict()
]);

const triggerSchema = z
  .object({
    when: z.enum([
      "self_takes_hp_damage",
      "self_takes_sanity_damage",
      "enemy_plays_daemon",
      "enemy_plays_kernel",
      "turn_start"
    ]),
    limit: z.number().int().positive(),
    used: z.number().int().nonnegative().optional()
  })
  .strict();

const backlashSchema = z
  .object({
    effects: z.array(effectSchema).min(1),
    reason: z.string().min(1)
  })
  .strict();

export const cardSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["attack", "daemon", "kernel"]),
    name: z.string().min(1),
    description: z.string().min(1),
    target: targetSchema,
    cost: z.number().int().positive(),
    effects: z.array(effectSchema).min(1),
    tags: z.array(z.string().min(1)),
    duration: z.number().int().positive().optional(),
    trigger: triggerSchema.optional(),
    backlash: backlashSchema.optional(),
    sourcePrompt: z.string().optional()
  })
  .strict();

export function parseCard(candidate: unknown): Card {
  return cardSchema.parse(candidate) as Card;
}
