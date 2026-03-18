import { describe, expect, it } from "vitest";
import { promptNpmPackageCustomizations } from "../../src/prompts/customizations.js";

describe("promptNpmPackageCustomizations", () => {
  it("returns deterministic defaults in --yes mode", async () => {
    const result = await promptNpmPackageCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.buildTool).toBe("tsup");
    expect(result.eslint).toBe(true);
    expect(result.prettier).toBe(false);
    expect(result.testFramework).toBe("none");
  });
});

