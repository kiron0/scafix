import { spawnSync } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expressAdapter } from '../../src/adapters/express.adapter.js';
import { useEphemeralPackageManagerCache } from './utils/package-manager-cache.js';
import { isQuickSmokeProfile } from './utils/profile.js';

const describeIf = process.env.SCAFIX_RUN_NETWORK_SMOKE === '1' ? describe : describe.skip;
useEphemeralPackageManagerCache();
const itQuickIf = isQuickSmokeProfile ? it : it.skip;
const itFullIf = isQuickSmokeProfile ? it.skip : it;

function runPackageScript(projectPath: string, script: string) {
  return spawnSync('npm', ['run', script], {
    cwd: projectPath,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function runNodeModuleImport(projectPath: string, modulePath: string) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import(${JSON.stringify(modulePath)}).then(() => process.exit(0))`,
    ],
    {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );
}

describeIf.sequential('express adapter smoke', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-express-smoke-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  itQuickIf('quick smoke installs, lints, and builds a representative TypeScript express scaffold', async () => {
    const projectName = 'smoke-express-quick';

    await expressAdapter.create({
      directory: projectName,
      dotenv: true,
      eslint: true,
      packageManager: 'npm',
      pattern: 'simple',
      prettier: false,
      projectName,
      typescript: true,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();

    const lintResult = runPackageScript(projectPath, 'lint');
    expect(lintResult.status).toBe(0);

    const buildResult = runPackageScript(projectPath, 'build');
    expect(buildResult.status).toBe(0);
  }, 300000);

  itFullIf('installs, lints, and builds a TypeScript express scaffold', async () => {
    const projectName = 'smoke-express-ts';

    await expressAdapter.create({
      directory: projectName,
      dotenv: true,
      eslint: true,
      packageManager: 'npm',
      pattern: 'simple',
      prettier: false,
      projectName,
      typescript: true,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();

    const lintResult = runPackageScript(projectPath, 'lint');
    expect(lintResult.status).toBe(0);

    const buildResult = runPackageScript(projectPath, 'build');
    expect(buildResult.status).toBe(0);
  }, 300000);

  itFullIf('installs, lints, and builds a JavaScript express scaffold', async () => {
    const projectName = 'smoke-express-js';

    await expressAdapter.create({
      cors: true,
      directory: projectName,
      dotenv: true,
      eslint: true,
      packageManager: 'npm',
      pattern: 'simple',
      prettier: false,
      projectName,
      typescript: false,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();

    const lintResult = runPackageScript(projectPath, 'lint');
    expect(lintResult.status).toBe(0);

    const buildResult = runPackageScript(projectPath, 'build');
    expect(buildResult.status).toBe(0);
  }, 300000);

  itFullIf.each([
    {
      modulePath: './src/models/example.js',
      pattern: 'mvc',
      projectName: 'smoke-express-mvc-js',
      sourcePath: ['src', 'models', 'example.js'],
    },
    {
      modulePath: './src/controllers/user.js',
      pattern: 'rest',
      projectName: 'smoke-express-rest-js',
      sourcePath: ['src', 'controllers', 'user.js'],
    },
    {
      modulePath: './src/presentation/controllers/product.js',
      pattern: 'layered',
      projectName: 'smoke-express-layered-js',
      sourcePath: ['src', 'presentation', 'controllers', 'product.js'],
    },
  ])(
    'loads the JavaScript $pattern pattern scaffold without runtime import errors',
    async ({ modulePath, pattern, projectName, sourcePath }) => {
      await expressAdapter.create({
        directory: projectName,
        dotenv: true,
        eslint: true,
        packageManager: 'npm',
        pattern,
        prettier: false,
        projectName,
        typescript: false,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, ...sourcePath))).resolves.toBeUndefined();

      const importResult = runNodeModuleImport(projectPath, modulePath);
      expect(importResult.status).toBe(0);
    },
    300000
  );
});
