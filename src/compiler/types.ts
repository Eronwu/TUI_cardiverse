import type { ActorId, Card } from "../core/types.js";

export type CompilerMode = "stub" | "llm";

export type CompileInput = {
  prompt: string;
  actor: ActorId;
  turn: number;
  mode: CompilerMode;
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
