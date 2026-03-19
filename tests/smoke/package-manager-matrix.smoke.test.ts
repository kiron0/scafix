import { access, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { npmPackageAdapter } from '../../src/adapters/npm.adapter.js';
import { detectPackageManager } from '../../src/utils/package-manager.js';
import { runGeneratedCommand } from '../utils/scaffold.js';

const describeIf = process.env.SCAFIX_RUN_NETWORK_SMOKE === '1' ? describe : describe.skip;
const requestedPackageManagers = new Set(
  (process.env.SCAFIX_SMOKE_PACKAGE_MANAGERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => ['npm', 'pnpm', 'yarn', 'bun'].includes(value))
);

const packageManagers = [
  {
    expectedLockfiles: ['package-lock.json'],
    value: 'npm',
  },
  {
    expectedLockfiles: ['pnpm-lock.yaml'],
    value: 'pnpm',
  },
  {
    expectedLockfiles: ['yarn.lock'],
    value: 'yarn',
  },
  {
    expectedLockfiles: ['bun.lock', 'bun.lockb'],
    value: 'bun',
  },
].filter(
  (entry) => requestedPackageManagers.size === 0 || requestedPackageManagers.has(entry.value)
) as const;

describeIf.sequential('package manager install smoke', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-pm-smoke-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each(packageManagers)(
    'creates a real npm package scaffold with %s lockfile behavior',
    async ({ expectedLockfiles, value }) => {
      const projectName = `smoke-pkg-${value}`;
      await npmPackageAdapter.create({
        packageManager: value,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
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
    300000
  );
});

const npmPackageBuildVariants = [
  {
    buildTool: 'tsup',
    expectedEntry: 'dist/index.js',
    projectName: 'smoke-pkg-tsup',
    testFramework: 'vitest',
    typescript: true,
  },
  {
    buildTool: 'rollup',
    expectedEntry: 'dist/index.js',
    projectName: 'smoke-pkg-rollup',
    testFramework: 'vitest',
    typescript: true,
  },
  {
    buildTool: 'esbuild',
    expectedEntry: 'dist/index.js',
    projectName: 'smoke-pkg-esbuild',
    testFramework: 'jest',
    typescript: true,
  },
  {
    buildTool: 'tsup',
    expectedEntry: 'src/index.js',
    projectName: 'smoke-pkg-js',
    testFramework: 'jest',
    typescript: false,
  },
] as const;

describeIf.sequential('npm package build variant smoke', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-pkg-variant-smoke-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each(npmPackageBuildVariants)(
    'installs, builds, tests, and packs the generated $projectName template',
    async ({ buildTool, expectedEntry, projectName, testFramework, typescript }) => {
      await npmPackageAdapter.create({
        buildTool,
        eslint: false,
        packageManager: 'npm',
        prettier: false,
        projectName,
        testFramework,
        typescript,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      const packCachePath = join(projectPath, '.npm-cache');

      runGeneratedCommand(projectPath, 'npm', ['run', 'build']);
      runGeneratedCommand(projectPath, 'npm', ['test']);
      runGeneratedCommand(projectPath, 'npm', ['pack', '--json', '--cache', packCachePath]);

      await expect(access(join(projectPath, expectedEntry))).resolves.toBeUndefined();
    },
    300000
  );
});
