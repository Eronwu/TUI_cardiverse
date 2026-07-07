#!/usr/bin/env node
import "dotenv/config";
import { createProgram, parseCliOptions } from "./args.js";
import { printAutoPlayerChallenge } from "../tui/autoPlayer.js";
import { runTerminalGame } from "../tui/terminalGame.js";

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();

  program.action(async () => {
    const options = parseCliOptions(program.opts());
    const compilerMode = options.llm ? "llm" : "stub";
    if (options.llm && options.provider !== undefined && options.provider !== "openai") {
      console.error(`cardiverse: provider "${options.provider}" is not implemented yet. Use --provider openai.`);
      process.exitCode = 1;
      return;
    }
    if (options.autoPlayer) {
      await printAutoPlayerChallenge({ compilerMode, output: process.stdout });
      return;
    }
    await runTerminalGame({ compilerMode });
  });

  await program.parseAsync(argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`cardiverse: ${message}`);
  process.exitCode = 1;
});
