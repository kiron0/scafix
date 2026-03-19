import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  minify: "terser",
  target: "es2020",
  treeshake: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  esbuildOptions(options) {
    options.drop = ["debugger"];
  },
});
