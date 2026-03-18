import { access, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextAdapter } from "../../src/adapters/next.adapter.js";
import { viteReactAdapter } from "../../src/adapters/vite.adapter.js";

const describeIf =
  process.env.SCAFIX_RUN_NETWORK_SMOKE === "1" ? describe : describe.skip;

describeIf.sequential("external CLI smoke", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "scafix-network-smoke-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it(
    "scaffolds a real Vite project through the official CLI",
    async () => {
      const projectName = "smoke-vite-app";
      await viteReactAdapter.create({
        packageManager: "npm",
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, "package.json"))).resolves.toBeUndefined();
      await expect(access(join(projectPath, "src", "main.tsx"))).resolves.toBeUndefined();

      const packageJson = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf8"),
      );
      expect(packageJson.name).toBe(projectName);
    },
    300000,
  );

  it(
    "scaffolds a real Next.js project through the official CLI",
    async () => {
      const projectName = "smoke-next-app";
      await nextAdapter.create({
        packageManager: "npm",
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, "package.json"))).resolves.toBeUndefined();
      await expect(access(join(projectPath, "src", "app", "page.tsx"))).resolves.toBeUndefined();

      const packageJson = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf8"),
      );
      expect(packageJson.name).toBe(projectName);
    },
    300000,
  );
});
