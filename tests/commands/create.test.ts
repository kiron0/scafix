import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliExitError } from "../../src/utils/cli-error.js";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  detectPackageManagerFromCwd: vi.fn(),
  exec: vi.fn(),
  getAdapterById: vi.fn(),
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
  validateDirectory: vi.fn(),
  validateProjectName: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../../src/adapters/index.js", () => ({
  getAdapterById: mocks.getAdapterById,
}));

vi.mock("../../src/prompts/select-stack.js", () => ({
  promptDirectory: mocks.promptDirectory,
  promptGit: mocks.promptGit,
  promptPackageManager: mocks.promptPackageManager,
  promptProjectName: mocks.promptProjectName,
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

vi.mock("../../src/utils/validate.js", () => ({
  validateDirectory: mocks.validateDirectory,
  validateProjectName: mocks.validateProjectName,
}));

import { createCommand } from "../../src/commands/create.js";

describe("createCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdapterById.mockReturnValue({
      id: "vite",
      name: "Vite",
      description: "test adapter",
      create: mocks.create,
    });
    mocks.promptGit.mockResolvedValue(false);
    mocks.promptPackageManager.mockResolvedValue("npm");
    mocks.promptProjectName.mockResolvedValue("demo-app");
    mocks.validateDirectory.mockReturnValue({
      exists: false,
      path: "/tmp/demo-app",
      valid: true,
    });
    mocks.validateProjectName.mockReturnValue(true);
  });

  it("respects an explicit directory without prompting again", async () => {
    await createCommand("vite", {
      directory: "custom-dir",
      name: "demo-app",
    });

    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "custom-dir",
        projectName: "demo-app",
      }),
    );
  });

  it("does not let a blank directory override the derived project directory", async () => {
    await createCommand("vite", {
      directory: "   ",
      name: "demo-app",
      yes: true,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "demo-app",
        projectName: "demo-app",
      }),
    );
  });

  it("uses detected package manager without prompting when available", async () => {
    mocks.detectPackageManagerFromCwd.mockReturnValue("pnpm");

    await createCommand("vite", {
      name: "demo-app",
    });

    expect(mocks.promptPackageManager).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        packageManager: "pnpm",
      }),
    );
  });

  it("rejects unsupported package managers before adapter execution", async () => {
    await expect(
      createCommand("vite", {
        name: "demo-app",
        packageManager: "pip",
        yes: true,
      }),
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Unsupported package manager: pip",
    );
  });
});
