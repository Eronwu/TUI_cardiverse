import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initEcho } from "../../src/content/bosses/initEcho.js";
import { createGameState } from "../../src/core/state.js";
import { saveBattleLog } from "../../src/storage/battleLog.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("saveBattleLog", () => {
  it("writes battle logs as json lines", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cardiverse-"));
    const state = createGameState(initEcho);
    const filePath = await saveBattleLog(state.logs, "init-echo", tempDir);
    const body = await readFile(filePath, "utf8");

    expect(filePath).toContain("init-echo");
    expect(body.trim().split("\n")).toHaveLength(state.logs.length);
    expect(JSON.parse(body.trim().split("\n")[0] ?? "{}")).toMatchObject({
      type: "system",
      message: "BOOT: INIT ECHO encounter initialized."
    });
  });
});
