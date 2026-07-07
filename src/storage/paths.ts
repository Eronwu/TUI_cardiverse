import { homedir } from "node:os";
import { join } from "node:path";

export function getDataDir(): string {
  return join(homedir(), ".terminal-cardiverse");
}

export function getLogsDir(): string {
  return join(getDataDir(), "logs");
}
