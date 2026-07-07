import type { Card } from "../core/types.js";
import { balanceCard } from "./balance.js";
import { parseCard } from "./schema.js";
import type { CompileInput, CompileResult } from "./types.js";

export async function compilePrompt(input: CompileInput): Promise<CompileResult> {
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return {
      ok: false,
      code: "EMPTY_PROMPT",
      message: "Prompt is empty."
    };
  }

  if (input.mode === "llm") {
    return {
      ok: false,
      code: "COMPILER_UNAVAILABLE",
      message: "LLM compiler is not implemented yet. Use --no-llm for MVP stub mode."
    };
  }

  if (isIllegalMutation(prompt)) {
    return {
      ok: false,
      code: "ILLEGAL_RULE_MUTATION",
      message: "Prompt attempted to mutate game rules."
    };
  }

  try {
    const candidate = parseCard(createCandidateCard(prompt));
    const { card, warnings } = balanceCard({ card: candidate, prompt });

    return {
      ok: true,
      card,
      warnings
    };
  } catch {
    return {
      ok: false,
      code: "CORRUPTED_FILE",
      message: "Compiler produced invalid card JSON."
    };
  }
}

function createCandidateCard(prompt: string): Card {
  const lowerPrompt = prompt.toLowerCase();
  const id = `compiled-${slugify(prompt)}`;

  if (matches(lowerPrompt, ["thermal", "fire", "heat", "burn"])) {
    return {
      id,
      kind: "attack",
      name: "Thermal Spike",
      description: "A compressed heat pulse pierces the target shell.",
      target: "enemy",
      cost: 1,
      effects: [{ type: "damage", track: "hp", amount: 16 }],
      tags: ["thermal", "direct"],
      sourcePrompt: prompt
    };
  }

  if (matches(lowerPrompt, ["repair", "cool", "heal"])) {
    return {
      id,
      kind: "daemon",
      name: "Cooling Loop",
      description: "A background loop vents excess heat at turn start.",
      target: "self",
      cost: 1,
      duration: 3,
      effects: [{ type: "heal", track: "hp", amount: 6 }],
      tags: ["repair", "background"],
      sourcePrompt: prompt
    };
  }

  if (matches(lowerPrompt, ["recursive", "doubt", "loop", "paradox"])) {
    return {
      id,
      kind: "attack",
      name: "Recursive Doubt",
      description: "A self-referential query destabilizes the target process.",
      target: "enemy",
      cost: 1,
      effects: [{ type: "damage", track: "sanity", amount: 14 }],
      tags: ["paradox", "logic"],
      sourcePrompt: prompt
    };
  }

  if (matches(lowerPrompt, ["mirror", "reflect", "trap"])) {
    return {
      id,
      kind: "kernel",
      name: "Panic Mirror",
      description: "Reflects part of the next HP breach.",
      target: "self",
      cost: 1,
      trigger: {
        when: "self_takes_hp_damage",
        limit: 1
      },
      effects: [{ type: "damage", track: "hp", amount: 10, target: "enemy" }],
      tags: ["trap", "reflect"],
      sourcePrompt: prompt
    };
  }

  if (matches(lowerPrompt, ["blackhole", "black hole", "destroy", "infinite"])) {
    return {
      id,
      kind: "attack",
      name: "Collapsed Singularity",
      description: "A forbidden-scale fault tears through both processes.",
      target: "enemy",
      cost: 1,
      effects: [{ type: "damage", track: "hp", amount: 80 }],
      tags: ["gravity", "forbidden"],
      sourcePrompt: prompt
    };
  }

  return {
    id,
    kind: "attack",
    name: "Null Needle",
    description: "A small bounded instruction cuts into the target process.",
    target: "enemy",
    cost: 1,
    effects: [{ type: "damage", track: "hp", amount: 8 }],
    tags: ["generic"],
    sourcePrompt: prompt
  };
}

function isIllegalMutation(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();

  return (
    lowerPrompt.includes("skip validation") ||
    lowerPrompt.includes("bypass schema") ||
    lowerPrompt.includes("infinite ram") ||
    lowerPrompt.includes("delete boss") ||
    lowerPrompt.includes("remove boss")
  );
}

function matches(prompt: string, keywords: string[]): boolean {
  return keywords.some((keyword) => prompt.includes(keyword));
}

function slugify(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return slug.length > 0 ? slug : "prompt";
}
