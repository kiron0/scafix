import { access, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { npmPackageAdapter } from "../../src/adapters/npm.adapter.js";
import { detectPackageManager } from "../../src/utils/package-manager.js";

const describeIf =
  process.env.SCAFIX_RUN_NETWORK_SMOKE === "1" ? describe : describe.skip;

const packageManagers = [
  {
    expectedLockfiles: ["package-lock.json"],
    value: "npm",
  },
  {
    expectedLockfiles: ["pnpm-lock.yaml"],
    value: "pnpm",
  },
  {
    expectedLockfiles: ["yarn.lock"],
    value: "yarn",
  },
  {
    expectedLockfiles: ["bun.lock", "bun.lockb"],
    value: "bun",
  },
] as const;

describeIf.sequential("package manager install smoke", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "scafix-pm-smoke-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each(packageManagers)(
    "creates a real npm package scaffold with %s lockfile behavior",
    async ({ expectedLockfiles, value }) => {
      const projectName = `smoke-pkg-${value}`;
      await npmPackageAdapter.create({
        packageManager: value,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, "package.json"))).resolves.toBeUndefined();

      const packageJson = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf8"),
      );
      expect(packageJson.name).toBe(projectName);
      expect(detectPackageManager(projectPath)).toBe(value);

      let foundLockfile = false;
      for (const lockfile of expectedLockfiles) {
        try {
          await access(join(projectPath, lockfile));
          foundLockfile = true;
          break;
        } catch {
          // try next candidate
        }
      }

      expect(foundLockfile).toBe(true);
    },
    300000,
  );
});
