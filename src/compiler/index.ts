import { compilePromptWithLlm } from "./llmCompiler.js";
import { compilePromptWithStub } from "./stubCompiler.js";
import type { CompileInput, CompileResult } from "./types.js";

export async function compilePrompt(input: CompileInput): Promise<CompileResult> {
  return input.mode === "llm" ? compilePromptWithLlm(input) : compilePromptWithStub(input);
}
