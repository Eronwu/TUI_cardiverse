export type InspectZone = "cache" | "daemon" | "kernel" | "discard";

export type ParsedCommand =
  | { type: "help" }
  | { type: "new" }
  | { type: "status" }
  | { type: "compile"; prompt: string }
  | { type: "play"; cacheIndex: number }
  | { type: "mount"; cacheIndex: number }
  | { type: "trap"; cacheIndex: number }
  | { type: "inspect"; zone: InspectZone; index?: number }
  | { type: "end" }
  | { type: "log" }
  | { type: "save_log" }
  | { type: "settings" }
  | { type: "restart" }
  | { type: "quit" }
  | { type: "unknown"; raw: string };
