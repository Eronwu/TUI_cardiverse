import type { InspectZone, ParsedCommand } from "./types.js";

const INSPECT_ZONES = ["cache", "daemon", "kernel", "discard"] as const;

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { type: "unknown", raw: input };
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
      return { type: "unknown", raw: input };
  }
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
