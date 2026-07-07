import type { InspectZone, ParsedCommand } from "./types.js";

const INSPECT_ZONES = ["cache", "daemon", "kernel", "discard"] as const;

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { type: "unknown", raw: input };
  }

  if (trimmed.startsWith(":")) {
    return parseAdvancedCommand(trimmed.slice(1));
  }

  const quickCommand = parseQuickCommand(trimmed);
  if (quickCommand !== undefined) {
    return quickCommand;
  }

  if (looksLikeNaturalPrompt(trimmed)) {
    return { type: "compile", prompt: trimmed };
  }

  return parseAdvancedCommand(trimmed, input);
}

function parseAdvancedCommand(input: string, rawInput = input): ParsedCommand {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { type: "unknown", raw: rawInput };
  }

  const [rawCommand = "", ...parts] = trimmed.split(/\s+/);
  const command = rawCommand.toLowerCase();

  switch (command) {
    case "help":
      return { type: "help" };
    case "new":
      return { type: "new" };
    case "status":
      return { type: "status" };
    case "compile": {
      const prompt = trimmed.slice(rawCommand.length).trimStart();
      return { type: "compile", prompt };
    }
    case "play":
      return parseIndexedCommand("play", parts[0], input);
    case "mount":
      return parseIndexedCommand("mount", parts[0], input);
    case "trap":
      return parseIndexedCommand("trap", parts[0], input);
    case "inspect":
      return parseInspect(parts, input);
    case "end":
      return { type: "end" };
    case "a":
    case "ai":
    case "suggest":
      return { type: "suggest" };
    case "g":
    case "auto":
    case "auto-turn":
      return { type: "auto_turn" };
    case "log":
      return { type: "log" };
    case "save-log":
    case "savelog":
      return { type: "save_log" };
    case "settings":
      return { type: "settings" };
    case "restart":
      return { type: "restart" };
    case "quit":
    case "exit":
      return { type: "quit" };
    default:
      return { type: "unknown", raw: rawInput };
  }
}

function parseQuickCommand(trimmed: string): ParsedCommand | undefined {
  const lower = trimmed.toLowerCase();

  if (/^c\s+/.test(lower)) {
    return { type: "compile", prompt: trimmed.slice(1).trimStart() };
  }

  if (/^r\s+/.test(lower)) {
    return { type: "compile", prompt: trimmed.slice(1).trimStart() };
  }

  if (/^[1-5]$/.test(lower)) {
    return { type: "play", cacheIndex: Number.parseInt(lower, 10) - 1 };
  }

  if (/^d[1-5]$/.test(lower)) {
    return { type: "mount", cacheIndex: Number.parseInt(lower.slice(1), 10) - 1 };
  }

  if (/^k[1-5]$/.test(lower)) {
    return { type: "trap", cacheIndex: Number.parseInt(lower.slice(1), 10) - 1 };
  }

  if (/^i[1-5]$/.test(lower)) {
    return { type: "inspect", zone: "cache", index: Number.parseInt(lower.slice(1), 10) - 1 };
  }

  switch (lower) {
    case "c":
      return { type: "cache_draft" };
    case "p":
      return { type: "use_draft" };
    case "x":
      return { type: "discard_draft" };
    case "e":
      return { type: "end" };
    case "a":
      return { type: "suggest" };
    case "g":
      return { type: "auto_turn" };
    case "q":
      return { type: "quit" };
    case "?":
      return { type: "help" };
    default:
      return undefined;
  }
}

function looksLikeNaturalPrompt(trimmed: string): boolean {
  const first = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (first === undefined) {
    return false;
  }

  const reserved = new Set([
    "help",
    "new",
    "status",
    "compile",
    "play",
    "mount",
    "trap",
    "inspect",
    "end",
    "log",
    "save-log",
    "savelog",
    "settings",
    "restart",
    "quit",
    "exit",
    "ai",
    "suggest",
    "auto",
    "auto-turn"
  ]);

  return !reserved.has(first);
}

function parseIndexedCommand(
  type: "play" | "mount" | "trap",
  rawIndex: string | undefined,
  raw: string
): ParsedCommand {
  const cacheIndex = parseIndex(rawIndex);
  if (cacheIndex === undefined) {
    return { type: "unknown", raw };
  }

  return { type, cacheIndex };
}

function parseInspect(parts: string[], raw: string): ParsedCommand {
  const zone = parts[0]?.toLowerCase();
  if (!isInspectZone(zone)) {
    return { type: "unknown", raw };
  }

  const index = parseIndex(parts[1]);
  return index === undefined ? { type: "inspect", zone } : { type: "inspect", zone, index };
}

function parseIndex(rawIndex: string | undefined): number | undefined {
  if (rawIndex === undefined || !/^\d+$/.test(rawIndex)) {
    return undefined;
  }

  return Number.parseInt(rawIndex, 10);
}

function isInspectZone(zone: string | undefined): zone is InspectZone {
  return typeof zone === "string" && INSPECT_ZONES.includes(zone as InspectZone);
}
