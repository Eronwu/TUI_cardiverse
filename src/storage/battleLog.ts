import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BattleLogEvent } from "../core/types.js";
import { getLogsDir } from "./paths.js";

export async function saveBattleLog(logs: BattleLogEvent[], label = "battle", logsDir = getLogsDir()): Promise<string> {
  await mkdir(logsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "battle";
  const filePath = join(logsDir, `${timestamp}-${safeLabel}.jsonl`);
  const body = logs.map((log) => JSON.stringify(log)).join("\n") + "\n";

  await writeFile(filePath, body, "utf8");

  return filePath;
}
