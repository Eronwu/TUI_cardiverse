import { Command } from "commander";

export type CliOptions = {
  llm: boolean;
  debug: boolean;
  autoPlayer: boolean;
  provider?: "ollama" | "openai";
};

export function createProgram(): Command {
  return new Command()
    .name("cardiverse")
    .description("Terminal Cardiverse - a terminal-native prompt-compiled card strategy game.")
    .version("0.1.0")
    .option("--llm", "enable the configured LLM compiler", false)
    .option("--no-llm", "force the local stub compiler")
    .option("--auto-player", "let the rule-based AI play the challenge")
    .option("--provider <provider>", "set LLM provider: openai (ollama planned)")
    .option("--debug", "enable debug output", false);
}

export function parseCliOptions(rawOptions: {
  llm?: boolean;
  debug?: boolean;
  autoPlayer?: boolean;
  provider?: string;
}): CliOptions {
  const provider = parseProvider(rawOptions.provider);

  return {
    llm: rawOptions.llm ?? false,
    debug: rawOptions.debug ?? false,
    autoPlayer: rawOptions.autoPlayer ?? false,
    ...(provider ? { provider } : {})
  };
}

function parseProvider(provider: string | undefined): CliOptions["provider"] {
  if (provider === undefined) {
    return undefined;
  }

  if (provider === "ollama" || provider === "openai") {
    return provider;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
