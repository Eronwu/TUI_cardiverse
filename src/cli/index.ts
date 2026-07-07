#!/usr/bin/env node
import "dotenv/config";
import { createProgram, parseCliOptions } from "./args.js";
import { runTerminalGame } from "../tui/terminalGame.js";

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();

  program.action(async () => {
    const options = parseCliOptions(program.opts());
    const compilerMode = options.llm ? "llm" : "stub";
    await runTerminalGame({ compilerMode });
  });

  await program.parseAsync(argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`cardiverse: ${message}`);
  process.exitCode = 1;
});
