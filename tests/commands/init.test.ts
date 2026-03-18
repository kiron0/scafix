import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliExitError } from "../../src/utils/cli-error.js";

const mocks = vi.hoisted(() => ({
  adapters: [
    {
      backend: false,
      create: vi.fn(),
      description: "test adapter",
      id: "vite",
      name: "Vite",
    },
  ],
  detectPackageManagerFromCwd: vi.fn(),
  exec: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  promptDirectory: vi.fn(),
  promptGit: vi.fn(),
  promptPackageManager: vi.fn(),
  promptProjectName: vi.fn(),
  selectStack: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../../src/adapters/index.js", () => ({
  adapters: mocks.adapters,
}));

vi.mock("../../src/prompts/select-stack.js", () => ({
  promptDirectory: mocks.promptDirectory,
  promptGit: mocks.promptGit,
  promptPackageManager: mocks.promptPackageManager,
  promptProjectName: mocks.promptProjectName,
  selectStack: mocks.selectStack,
}));

vi.mock("../../src/utils/exec.js", () => ({
  exec: mocks.exec,
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: mocks.logger,
}));

vi.mock("../../src/utils/package-manager.js", async () => {
  const actual = await vi.importActual("../../src/utils/package-manager.js");
  return {
    ...actual,
    detectPackageManagerFromCwd: mocks.detectPackageManagerFromCwd,
  };
});

import { initCommand } from "../../src/commands/init.js";

describe("initCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectStack.mockResolvedValue(mocks.adapters[0]);
    mocks.promptProjectName.mockResolvedValue("my-project");
  });

  it("rejects stack-less non-interactive usage", async () => {
    await expect(initCommand({ yes: true })).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.selectStack).not.toHaveBeenCalled();
    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Non-interactive usage requires an explicit stack: use `scafix create <stack> --yes`.",
    );
  });

  it("honors explicit project metadata without prompting over it", async () => {
    await initCommand({
      directory: "custom-dir",
      name: "custom-name",
      packageManager: "pnpm",
    });

    expect(mocks.promptProjectName).not.toHaveBeenCalled();
    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.selectStack).toHaveBeenCalledWith(mocks.adapters);
    expect(mocks.adapters[0].create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "custom-dir",
        packageManager: "pnpm",
        projectName: "custom-name",
      }),
    );
  });

  it("uses a detected package manager without prompting", async () => {
    mocks.detectPackageManagerFromCwd.mockReturnValue("bun");

    await initCommand({});

    expect(mocks.promptPackageManager).not.toHaveBeenCalled();
    expect(mocks.adapters[0].create).toHaveBeenCalledWith(
      expect.objectContaining({
        packageManager: "bun",
      }),
    );
  });

  it("rejects unsupported package manager input before adapter execution", async () => {
    await expect(
      initCommand({
        packageManager: "pip",
      }),
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Unsupported package manager: pip",
    );
  });
});
