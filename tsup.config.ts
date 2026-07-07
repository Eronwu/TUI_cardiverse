import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli/index.ts"
  },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  splitting: false,
  skipNodeModulesBundle: true
});
