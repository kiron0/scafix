import { access, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  promptNpmPackageCustomizations: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@clack/prompts", () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../../src/utils/exec.js", () => ({
  exec: mocks.exec,
}));

vi.mock("../../src/prompts/customizations.js", () => ({
  promptNpmPackageCustomizations: mocks.promptNpmPackageCustomizations,
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: mocks.logger,
}));

import { npmPackageAdapter } from "../../src/adapters/npm.adapter.js";

describe.sequential("npmPackageAdapter", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "scafix-npm-adapter-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it("writes ESM-safe config files and declaration-aware esbuild output", async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: true,
      buildTool: "esbuild",
      eslint: true,
      prettier: false,
      testFramework: "jest",
    });

    await npmPackageAdapter.create({
      directory: "demo-pkg",
      packageManager: "pnpm",
      projectName: "demo-pkg",
      yes: true,
    });

    const projectPath = join(tempDir, "demo-pkg");
    const generatedPackageJson = JSON.parse(
      await readFile(join(projectPath, "package.json"), "utf8"),
    );
    const generatedReadme = await readFile(join(projectPath, "README.md"), "utf8");

    expect(generatedPackageJson.scripts.build).toContain(
      "tsc --emitDeclarationOnly",
    );
    expect(generatedPackageJson.scripts.prepublishOnly).toBe(
      generatedPackageJson.scripts.build,
    );
    expect(generatedPackageJson.types).toBe("dist/index.d.ts");
    expect(generatedReadme).toContain("pnpm add demo-pkg");
    expect(generatedReadme).toContain("pnpm install");
    expect(generatedReadme).toContain("pnpm build");
    expect(generatedReadme).toContain("pnpm test");
    expect(generatedReadme).toContain("pnpm publish");

    await expect(access(join(projectPath, ".eslintrc.cjs"))).resolves.toBeUndefined();
    await expect(access(join(projectPath, "jest.config.cjs"))).resolves.toBeUndefined();
    await expect(access(join(projectPath, ".eslintrc.js"))).rejects.toThrow();
    await expect(access(join(projectPath, "jest.config.js"))).rejects.toThrow();
  });

  it("prints next steps without a redundant install command", async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: true,
      buildTool: "tsup",
      eslint: false,
      prettier: false,
      testFramework: "vitest",
    });

    await npmPackageAdapter.create({
      directory: "demo-bun",
      packageManager: "bun",
      projectName: "demo-bun",
      yes: true,
    });

    const infoMessages = mocks.logger.info.mock.calls.map(([message]) => message);

    expect(infoMessages).toContain("  bun run build");
    expect(infoMessages).toContain("  bun run test");
    expect(infoMessages).toContain("  bun publish");
    expect(infoMessages).not.toContain("  bun install");
  });
});
