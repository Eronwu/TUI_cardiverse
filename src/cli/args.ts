import { Command } from "commander";

export type CliOptions = {
  llm: boolean;
  debug: boolean;
  provider?: "ollama" | "openai";
};

export function createProgram(): Command {
  return new Command()
    .name("cardiverse")
    .description("Terminal Cardiverse - a terminal-native prompt-compiled card strategy game.")
    .version("0.1.0")
    .option("--llm", "enable the configured LLM compiler", false)
    .option("--no-llm", "force the local stub compiler")
    .option("--provider <provider>", "set LLM provider: ollama or openai")
    .option("--debug", "enable debug output", false);
}

export function parseCliOptions(rawOptions: {
  llm?: boolean;
  debug?: boolean;
  provider?: string;
}): CliOptions {
  const provider = parseProvider(rawOptions.provider);

  return {
    llm: rawOptions.llm ?? false,
    debug: rawOptions.debug ?? false,
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
