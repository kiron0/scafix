import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { angularAdapter } from '../../src/adapters/angular.adapter.js';
import { elysiaAdapter } from '../../src/adapters/elysia.adapter.js';
import { expoAdapter } from '../../src/adapters/expo.adapter.js';
import { fastifyAdapter } from '../../src/adapters/fastify.adapter.js';
import { remixAdapter } from '../../src/adapters/remix.adapter.js';
import { t3Adapter } from '../../src/adapters/t3.adapter.js';
import { tauriAdapter } from '../../src/adapters/tauri.adapter.js';
import { useEphemeralPackageManagerCache } from './utils/package-manager-cache.js';
import { isQuickSmokeProfile } from './utils/profile.js';
import { runGeneratedCommand } from '../utils/scaffold.js';

const describeIf = process.env.SCAFIX_RUN_NETWORK_SMOKE === '1' ? describe : describe.skip;
useEphemeralPackageManagerCache();

function isCommandAvailable(command: string): boolean {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(lookupCommand, [command], { stdio: 'ignore' }).status === 0;
}

const requestedPackageManagers = new Set(
  (process.env.SCAFIX_SMOKE_PACKAGE_MANAGERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => ['npm', 'pnpm', 'yarn', 'bun'].includes(value))
);

const runNpmSmoke =
  isCommandAvailable('npm') &&
  (requestedPackageManagers.size === 0 || requestedPackageManagers.has('npm'));
const runBunSmoke =
  isCommandAvailable('bun') &&
  (requestedPackageManagers.size === 0 || requestedPackageManagers.has('bun'));
const runTauriSmoke = runNpmSmoke && isCommandAvailable('cargo');

const itQuickNpmIf = isQuickSmokeProfile && runNpmSmoke ? it : it.skip;
const itNpmIf = !isQuickSmokeProfile && runNpmSmoke ? it : it.skip;
const itBunIf = !isQuickSmokeProfile && runBunSmoke ? it : it.skip;
const itTauriIf = !isQuickSmokeProfile && runTauriSmoke ? it : it.skip;

describeIf.sequential('additional adapter smoke', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-additional-smoke-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  itQuickNpmIf('quick smoke scaffolds and builds a representative Angular project', async () => {
    const projectName = 'smoke-angular-quick-app';

    await angularAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'angular.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'main.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);

    runGeneratedCommand(projectPath, 'npm', ['run', 'build']);
  }, 300000);

  itNpmIf('scaffolds and builds a real Angular project', async () => {
    const projectName = 'smoke-angular-app';

    await angularAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'angular.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'main.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);

    runGeneratedCommand(projectPath, 'npm', ['run', 'build']);
  }, 300000);

  itNpmIf('scaffolds and builds a real Angular project with zard/ui', async () => {
    const projectName = 'smoke-angular-zard-app';

    await angularAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      style: 'css',
      yes: true,
      zard: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
    const componentsJson = JSON.parse(await readFile(join(projectPath, 'components.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'components.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'angular.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'main.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);
    expect(componentsJson.style).toBe('css');

    runGeneratedCommand(projectPath, 'npm', ['run', 'build']);
  }, 300000);

  itNpmIf('scaffolds a real Remix project', async () => {
    const projectName = 'smoke-remix-app';

    await remixAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'app', 'root.tsx'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);
  }, 300000);

  itNpmIf('scaffolds and builds a real Fastify project', async () => {
    const projectName = 'smoke-fastify-app';

    await fastifyAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'app.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);

    runGeneratedCommand(projectPath, 'npm', ['run', 'build:ts']);
  }, 300000);

  itBunIf('scaffolds a real Elysia project', async () => {
    const projectName = 'smoke-elysia-app';

    await elysiaAdapter.create({
      directory: projectName,
      packageManager: 'bun',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'index.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);
  }, 300000);

  itNpmIf('scaffolds a real Expo project', async () => {
    const projectName = 'smoke-expo-app';

    await expoAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'app.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);
  }, 300000);

  itTauriIf('scaffolds a real Tauri project', async () => {
    const projectName = 'smoke-tauri-app';

    await tauriAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src-tauri', 'tauri.conf.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);
  }, 300000);

  itNpmIf('scaffolds a real T3 project', async () => {
    const projectName = 'smoke-t3-app';

    await t3Adapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));

    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'app', 'page.tsx'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'prisma', 'schema.prisma'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    expect(packageJson.name).toBe(projectName);
  }, 300000);
});
