import { access, mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  promptNextCustomizations: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../../src/prompts/customizations.js", () => ({
  promptNextCustomizations: mocks.promptNextCustomizations,
}));

vi.mock("../../src/utils/exec.js", () => ({
  exec: mocks.exec,
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: mocks.logger,
}));

import { nextAdapter } from "../../src/adapters/next.adapter.js";

describe.sequential("nextAdapter", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "scafix-next-adapter-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName =
        args[0] === "create-next-app@latest"
          ? (args[1] as string)
          : args[1] === "create-next-app@latest"
            ? (args[2] as string)
            : undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(projectPath, { recursive: true });
      await writeFile(join(projectPath, "package.json"), "{}\n");
    });
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it("uses shared customizations to build create-next-app flags", async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: false,
      eslint: false,
      prettier: false,
      shadcn: false,
      srcDir: false,
      tailwind: false,
      typescript: false,
    });

    await nextAdapter.create({
      packageManager: "pnpm",
      projectName: "demo-next",
      yes: true,
    });

    expect(mocks.promptNextCustomizations).toHaveBeenCalledWith({
      yes: true,
    });
    expect(mocks.exec).toHaveBeenCalledWith(
      "pnpm",
      [
        "dlx",
        "create-next-app@latest",
        "demo-next",
        "--js",
        "--no-eslint",
        "--no-app",
        "--no-src-dir",
        "--no-tailwind",
        "--import-alias",
        "@/*",
        "--use-pnpm",
        "--yes",
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: "inherit",
      }),
    );
  });

  it("adds prettier and shadcn when requested", async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: true,
      eslint: true,
      prettier: true,
      shadcn: true,
      srcDir: true,
      tailwind: true,
      typescript: true,
    });

    await nextAdapter.create({
      directory: "demo-next-prettier",
      packageManager: "bun",
      projectName: "demo-next-prettier",
    });

    const projectPath = join(tempDir, "demo-next-prettier");

    expect(mocks.exec).toHaveBeenCalledWith(
      "bunx",
      [
        "create-next-app@latest",
        "demo-next-prettier",
        "--ts",
        "--eslint",
        "--app",
        "--src-dir",
        "--tailwind",
        "--import-alias",
        "@/*",
        "--use-bun",
        "--yes",
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: "inherit",
      }),
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      "bun",
      ["add", "-D", "prettier"],
      expect.objectContaining({
        cwd: projectPath,
        stdio: "pipe",
      }),
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      "npx",
      ["shadcn@latest", "init"],
      expect.objectContaining({
        cwd: projectPath,
        stdio: "inherit",
      }),
    );
    await expect(access(join(projectPath, ".prettierrc"))).resolves.toBeUndefined();
  });
});
