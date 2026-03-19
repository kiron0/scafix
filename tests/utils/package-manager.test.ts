import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectPackageManager,
  detectPackageManagerFromCwd,
  detectYarnFlavor,
  getAddCommand,
  getDevCommand,
  getDlxCommand,
  getInstallCommand,
  getPublishCommand,
  getRunCommand,
  isPackageManager,
  resolvePackageManagerOption,
} from '../../src/utils/package-manager.js';
import type { PackageManager } from '../../src/utils/package-manager.js';

const packageManagers: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];
let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'scafix-pm-utils-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempDir, { force: true, recursive: true });
});

describe('getInstallCommand', () => {
  const expected: Record<PackageManager, string> = {
    npm: 'npm install',
    pnpm: 'pnpm install',
    yarn: 'yarn install',
    bun: 'bun install',
  };

  it.each(packageManagers)('returns correct install command for %s', (pm) => {
    expect(getInstallCommand(pm)).toBe(expected[pm]);
  });
});

describe('getAddCommand', () => {
  const expected: Record<PackageManager, string> = {
    npm: 'npm install scafix',
    pnpm: 'pnpm add scafix',
    yarn: 'yarn add scafix',
    bun: 'bun add scafix',
  };

  it.each(packageManagers)('returns correct add command for %s', (pm) => {
    expect(getAddCommand(pm, 'scafix')).toBe(expected[pm]);
  });
});

describe('getDevCommand', () => {
  const expected: Record<PackageManager, string> = {
    npm: 'npm run dev',
    pnpm: 'pnpm dev',
    yarn: 'yarn dev',
    bun: 'bun dev',
  };

  it.each(packageManagers)('returns correct dev command for %s', (pm) => {
    expect(getDevCommand(pm)).toBe(expected[pm]);
  });
});

describe('getRunCommand', () => {
  const expected: Record<PackageManager, string> = {
    npm: 'npm run build',
    pnpm: 'pnpm build',
    yarn: 'yarn build',
    bun: 'bun run build',
  };

  it.each(packageManagers)('returns correct run command for %s', (pm) => {
    expect(getRunCommand(pm, 'build')).toBe(expected[pm]);
  });
});

describe('getPublishCommand', () => {
  const expected: Record<Exclude<PackageManager, 'yarn'>, string> = {
    npm: 'npm publish',
    pnpm: 'pnpm publish',
    bun: 'bun publish',
  };

  it.each(['npm', 'pnpm', 'bun'] as const)('returns correct publish command for %s', (pm) => {
    expect(getPublishCommand(pm)).toBe(expected[pm]);
  });

  it('returns yarn classic publish command when Yarn classic is detected', () => {
    expect(getPublishCommand('yarn', { yarnFlavor: 'classic' })).toBe('yarn publish');
  });

  it('returns yarn berry publish command when Yarn berry is detected', () => {
    expect(getPublishCommand('yarn', { yarnFlavor: 'berry' })).toBe('yarn npm publish');
  });
});

describe('getDlxCommand', () => {
  it('returns npx for npm', () => {
    expect(getDlxCommand('npm', 'shadcn@latest', ['init'])).toEqual({
      cmd: 'npx',
      args: ['--yes', 'shadcn@latest', 'init'],
    });
  });

  it('returns pnpm dlx for pnpm', () => {
    expect(getDlxCommand('pnpm', 'shadcn@latest', ['init'])).toEqual({
      cmd: 'pnpm',
      args: ['dlx', 'shadcn@latest', 'init'],
    });
  });

  it('returns npx for yarn classic to match classic node_modules workflows', () => {
    expect(getDlxCommand('yarn', 'shadcn@latest', ['init'], { yarnFlavor: 'classic' })).toEqual({
      cmd: 'npx',
      args: ['--yes', 'shadcn@latest', 'init'],
    });
  });

  it('returns yarn dlx for yarn berry', () => {
    expect(getDlxCommand('yarn', 'shadcn@latest', ['init'], { yarnFlavor: 'berry' })).toEqual({
      cmd: 'yarn',
      args: ['dlx', 'shadcn@latest', 'init'],
    });
  });

  it('returns bunx for bun', () => {
    expect(getDlxCommand('bun', 'shadcn@latest', ['init'])).toEqual({
      cmd: 'bunx',
      args: ['shadcn@latest', 'init'],
    });
  });
});

describe('detectYarnFlavor', () => {
  it('detects yarn berry from a .yarnrc.yml marker in the current directory tree', async () => {
    const projectPath = join(tempDir, 'berry-project');
    await mkdir(projectPath, { recursive: true });
    await writeFile(join(tempDir, '.yarnrc.yml'), 'nodeLinker: pnp\n');

    expect(detectYarnFlavor(projectPath)).toBe('berry');
  });

  it('detects yarn berry from the packageManager field in the nearest package.json', async () => {
    const projectPath = join(tempDir, 'workspace', 'demo-app');
    await mkdir(projectPath, { recursive: true });
    await writeFile(
      join(tempDir, 'workspace', 'package.json'),
      JSON.stringify({ packageManager: 'yarn@4.7.0' }, null, 2)
    );

    expect(detectYarnFlavor(projectPath)).toBe('berry');
  });

  it('detects yarn classic from the packageManager field in the nearest package.json', async () => {
    const projectPath = join(tempDir, 'workspace', 'demo-app');
    await mkdir(projectPath, { recursive: true });
    await writeFile(
      join(tempDir, 'workspace', 'package.json'),
      JSON.stringify({ packageManager: 'yarn@1.22.22' }, null, 2)
    );

    expect(detectYarnFlavor(projectPath)).toBe('classic');
  });
});

describe('detectPackageManager', () => {
  it('detects the nearest ancestor package manager lockfile', async () => {
    const projectPath = join(tempDir, 'workspace', 'apps', 'web');
    await mkdir(projectPath, { recursive: true });
    await writeFile(join(tempDir, 'workspace', 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');

    expect(detectPackageManager(projectPath)).toBe('pnpm');
  });

  it('prefers a closer child lockfile over a workspace root lockfile', async () => {
    const projectPath = join(tempDir, 'workspace', 'apps', 'web');
    await mkdir(projectPath, { recursive: true });
    await writeFile(join(tempDir, 'workspace', 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    await writeFile(join(tempDir, 'workspace', 'apps', 'yarn.lock'), '');

    expect(detectPackageManager(projectPath)).toBe('yarn');
  });

  it.each([
    ['npm', 'npm@10.9.0'],
    ['pnpm', 'pnpm@9.15.0'],
    ['bun', 'bun@1.2.0'],
  ] as const)(
    'detects %s from the nearest packageManager field when no lockfile exists',
    async (expected, packageManagerField) => {
      const projectPath = join(tempDir, 'workspace', 'apps', 'web');
      await mkdir(projectPath, { recursive: true });
      await writeFile(
        join(tempDir, 'workspace', 'package.json'),
        JSON.stringify({ packageManager: packageManagerField }, null, 2)
      );

      expect(detectPackageManager(projectPath)).toBe(expected);
    }
  );

  it('prefers a closer packageManager field over a more distant lockfile', async () => {
    const projectPath = join(tempDir, 'workspace', 'apps', 'web');
    await mkdir(projectPath, { recursive: true });
    await writeFile(join(tempDir, 'workspace', 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    await writeFile(
      join(tempDir, 'workspace', 'apps', 'package.json'),
      JSON.stringify({ packageManager: 'bun@1.2.0' }, null, 2)
    );

    expect(detectPackageManager(projectPath)).toBe('bun');
  });
});

describe('detectPackageManagerFromCwd', () => {
  it('detects a package manager from ancestor lockfiles in monorepo subdirectories', async () => {
    const projectPath = join(tempDir, 'workspace', 'packages', 'api');
    await mkdir(projectPath, { recursive: true });
    await writeFile(join(tempDir, 'workspace', 'bun.lock'), '');
    vi.spyOn(process, 'cwd').mockReturnValue(projectPath);

    expect(detectPackageManagerFromCwd()).toBe('bun');
  });

  it('returns null when no supported lockfile exists in the cwd tree', async () => {
    const projectPath = join(tempDir, 'workspace', 'packages', 'api');
    await mkdir(projectPath, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(projectPath);

    expect(detectPackageManagerFromCwd()).toBeNull();
  });

  it('detects a package manager from ancestor packageManager metadata when no lockfile exists', async () => {
    const projectPath = join(tempDir, 'workspace', 'packages', 'api');
    await mkdir(projectPath, { recursive: true });
    await writeFile(
      join(tempDir, 'workspace', 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@9.15.0' }, null, 2)
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectPath);

    expect(detectPackageManagerFromCwd()).toBe('pnpm');
  });
});

describe('package manager validation', () => {
  it.each(packageManagers)('recognizes %s as a supported package manager', (pm) => {
    expect(isPackageManager(pm)).toBe(true);
    expect(resolvePackageManagerOption(pm)).toBe(pm);
  });

  it('rejects unsupported package managers', () => {
    expect(isPackageManager('pip')).toBe(false);
    expect(resolvePackageManagerOption('pip')).toBeNull();
    expect(resolvePackageManagerOption(undefined)).toBeNull();
  });
});
