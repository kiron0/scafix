import { spawnSync } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const describeIf = process.env.SCAFIX_RUN_NETWORK_SMOKE === '1' ? describe : describe.skip;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntry = join(packageRoot, 'dist', 'index.js');

function runBuiltCli(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'pipe',
  });
}

async function createFailingNpmBin(tempDir: string): Promise<string> {
  const binDir = join(tempDir, 'fake-bin');
  const scriptName = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const scriptPath = join(binDir, scriptName);
  const scriptContent =
    process.platform === 'win32'
      ? '@echo off\r\necho registry timeout 1>&2\r\nexit /b 1\r\n'
      : '#!/bin/sh\necho "registry timeout" >&2\nexit 1\n';

  await mkdir(binDir, { recursive: true });
  await writeFile(scriptPath, scriptContent);
  if (process.platform !== 'win32') {
    await chmod(scriptPath, 0o755);
  }

  return binDir;
}

describeIf.sequential('built CLI smoke', () => {
  let tempDir: string;

  beforeAll(
    () => {
      const buildResult = spawnSync('npm', ['run', 'build'], {
        cwd: packageRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      if (buildResult.status !== 0) {
        throw new Error(buildResult.stderr || buildResult.stdout || 'Failed to build package');
      }
    },
    30_000
  );

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-built-cli-smoke-'));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it(
    'scaffolds through the built CLI without creating a git repository when --no-git is used',
    async () => {
      const projectName = 'smoke-cli-no-git';
      const result = runBuiltCli(
        ['create', 'npm', '--name', projectName, '--yes', '--no-git', '--package-manager', 'npm'],
        tempDir
      );

      expect(result.status).toBe(0);
      await expect(access(join(tempDir, projectName, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(tempDir, projectName, '.git'))).rejects.toThrow();
    },
    300_000
  );

  it(
    'cleans up nested parent directories when an express scaffold fails through the built CLI',
    async () => {
      const fakeBin = await createFailingNpmBin(tempDir);
      const result = runBuiltCli(
        [
          'create',
          'express',
          '--name',
          'smoke-failed-express',
          '--directory',
          'apps/smoke-failed-express',
          '--yes',
          '--no-git',
          '--package-manager',
          'npm',
        ],
        tempDir,
        {
          PATH: `${fakeBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
        }
      );

      expect(result.status).toBe(1);
      await expect(access(join(tempDir, 'apps', 'smoke-failed-express'))).rejects.toThrow();
      await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
    },
    30_000
  );

  it(
    'cleans up nested parent directories when an npm package scaffold fails through the built CLI',
    async () => {
      const fakeBin = await createFailingNpmBin(tempDir);
      const result = runBuiltCli(
        [
          'create',
          'npm',
          '--name',
          'smoke-failed-package',
          '--directory',
          'packages/smoke-failed-package',
          '--yes',
          '--no-git',
          '--package-manager',
          'npm',
        ],
        tempDir,
        {
          PATH: `${fakeBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
        }
      );

      expect(result.status).toBe(1);
      await expect(access(join(tempDir, 'packages', 'smoke-failed-package'))).rejects.toThrow();
      await expect(access(join(tempDir, 'packages'))).rejects.toThrow();
    },
    30_000
  );
});
