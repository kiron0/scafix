import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
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
  promptViteReactCustomizations: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../../src/prompts/customizations.js", () => ({
  promptViteReactCustomizations: mocks.promptViteReactCustomizations,
}));

vi.mock("../../src/utils/exec.js", () => ({
  exec: mocks.exec,
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: mocks.logger,
}));

import { viteReactAdapter } from "../../src/adapters/vite.adapter.js";

describe.sequential("viteReactAdapter", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "scafix-vite-adapter-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName = args[2] as string | undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, "src"), { recursive: true });
      await writeFile(join(projectPath, "src", "index.css"), "body {}\n");
      await writeFile(join(projectPath, "vite.config.js"), "export default { plugins: [] }\n");
    });
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it("uses shared customizations to select the Vite template in --yes mode", async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: false,
      shadcn: false,
      tailwind: false,
      typescript: true,
    });

    await viteReactAdapter.create({
      packageManager: "npm",
      projectName: "demo-vite",
      yes: true,
    });

    expect(mocks.promptViteReactCustomizations).toHaveBeenCalledWith({
      yes: true,
    });
    expect(mocks.exec).toHaveBeenCalledWith(
      "npm",
      ["create", "vite@latest", "demo-vite", "--", "--template", "react-ts"],
      expect.objectContaining({
        cwd: tempDir,
        stdio: "inherit",
      }),
    );
  });

  it("applies JS template, tailwind v3, and prettier when requested", async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: true,
      shadcn: false,
      tailwind: true,
      tailwindVersion: "v3",
      typescript: false,
    });
    await viteReactAdapter.create({
      directory: "demo-vite-js",
      packageManager: "pnpm",
      projectName: "demo-vite-js",
    });

    const projectPath = join(tempDir, "demo-vite-js");

    expect(mocks.exec).toHaveBeenCalledWith(
      "pnpm",
      ["create", "vite", "demo-vite-js", "--template", "react"],
      expect.objectContaining({
        cwd: tempDir,
        stdio: "inherit",
      }),
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-D", "tailwindcss", "postcss", "autoprefixer"],
      expect.objectContaining({
        cwd: projectPath,
        stdio: "pipe",
      }),
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-D", "prettier"],
      expect.objectContaining({
        cwd: projectPath,
        stdio: "pipe",
      }),
    );
    await expect(access(join(projectPath, ".prettierrc"))).resolves.toBeUndefined();
    expect(await readFile(join(projectPath, "src", "index.css"), "utf8")).toContain(
      "@tailwind base;",
    );
  });
});
