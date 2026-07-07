import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../../src/cli/args.js";

describe("parseCliOptions", () => {
  it("defaults to stub mode with debug disabled", () => {
    expect(parseCliOptions({})).toEqual({
      llm: false,
      debug: false,
      autoPlayer: false
    });
  });

  it("supports forcing the local stub compiler", () => {
    expect(parseCliOptions({ llm: false })).toEqual({
      llm: false,
      debug: false,
      autoPlayer: false
    });
  });

  it("accepts supported providers", () => {
    expect(parseCliOptions({ provider: "ollama", debug: true })).toEqual({
      llm: false,
      debug: true,
      autoPlayer: false,
      provider: "ollama"
    });
  });

  it("supports auto-player mode", () => {
    expect(parseCliOptions({ autoPlayer: true })).toEqual({
      llm: false,
      debug: false,
      autoPlayer: true
    });
  });

  it("rejects unsupported providers", () => {
    expect(() => parseCliOptions({ provider: "invalid" })).toThrow("Unsupported provider");
  });
});
