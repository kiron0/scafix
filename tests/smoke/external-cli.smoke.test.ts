import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextAdapter } from '../../src/adapters/next.adapter.js';
import { viteReactAdapter } from '../../src/adapters/vite.adapter.js';
import type { PackageManager } from '../../src/utils/package-manager.js';
import { runGeneratedCommand } from '../utils/scaffold.js';

const describeIf = process.env.SCAFIX_RUN_NETWORK_SMOKE === '1' ? describe : describe.skip;

function isCommandAvailable(command: string): boolean {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(lookupCommand, [command], { stdio: 'ignore' }).status === 0;
}

const availablePackageManagers: PackageManager[] = (['npm', 'pnpm', 'yarn', 'bun'] as const).filter(
  (pm) => isCommandAvailable(pm)
);

function getScriptCommand(packageManager: PackageManager, script: string): [string, string[]] {
  if (packageManager === 'bun') {
    return ['bun', ['run', script]];
  }

  return [packageManager, ['run', script]];
}

describeIf.sequential('external CLI smoke', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-network-smoke-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each(availablePackageManagers)(
    'scaffolds a real Vite project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-vite-app-${packageManager}`;
      await viteReactAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'main.tsx'))).resolves.toBeUndefined();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.lint).toBeTruthy();
      expect(packageJson.scripts?.build).toBeTruthy();

      const [lintCommand, lintArgs] = getScriptCommand(packageManager, 'lint');
      runGeneratedCommand(projectPath, lintCommand, lintArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    },
    300000
  );

  it('keeps Vite package metadata tied to the requested project name when scaffolding into a custom directory', async () => {
    await viteReactAdapter.create({
      directory: 'apps/marketing-web',
      packageManager: 'npm',
      projectName: 'Marketing Site',
      yes: true,
    });

    const projectPath = join(tempDir, 'apps', 'marketing-web');
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('marketing-site');

    runGeneratedCommand(projectPath, 'npm', ['run', 'lint']);
    runGeneratedCommand(projectPath, 'npm', ['run', 'build']);

    await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
  }, 300000);

  it.each(availablePackageManagers)(
    'scaffolds a real Next.js project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-next-app-${packageManager}`;
      await nextAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'app', 'page.tsx'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.lint).toBeTruthy();
      expect(packageJson.scripts?.build).toBeTruthy();

      const [lintCommand, lintArgs] = getScriptCommand(packageManager, 'lint');
      runGeneratedCommand(projectPath, lintCommand, lintArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs, {
        CI: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      });

      await expect(access(join(projectPath, '.next', 'BUILD_ID'))).resolves.toBeUndefined();
    },
    300000
  );

  it('keeps Next.js package metadata tied to the requested project name when scaffolding into a custom directory', async () => {
    await nextAdapter.create({
      directory: 'apps/marketing-web',
      packageManager: 'npm',
      projectName: 'Marketing Site',
      yes: true,
    });

    const projectPath = join(tempDir, 'apps', 'marketing-web');
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();

    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('marketing-site');

    runGeneratedCommand(projectPath, 'npm', ['run', 'lint']);
    runGeneratedCommand(projectPath, 'npm', ['run', 'build'], {
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    });

    await expect(access(join(projectPath, '.next', 'BUILD_ID'))).resolves.toBeUndefined();
  }, 300000);
});
