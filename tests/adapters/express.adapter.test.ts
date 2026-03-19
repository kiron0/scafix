import { access, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expressAdapter } from '../../src/adapters/express.adapter.js';
import { getEslintPackages } from '../../src/utils/eslint.js';
import { runGeneratedLint } from '../utils/scaffold.js';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  promptExpressCustomizations: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptExpressCustomizations: mocks.promptExpressCustomizations,
}));

describe.sequential('expressAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-express-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it(
    'writes an ESM-safe eslint config for generated express projects',
    async () => {
      mocks.promptExpressCustomizations.mockResolvedValue({
        cors: false,
        dotenv: true,
        eslint: true,
        helmet: false,
        pattern: 'mvc',
        prettier: false,
        typescript: true,
      });

      await expressAdapter.create({
        directory: 'demo-express',
        packageManager: 'npm',
        projectName: 'demo-express',
        yes: true,
      });

      const projectPath = join(tempDir, 'demo-express');
      const generatedPackageJson = JSON.parse(
        await readFile(join(projectPath, 'package.json'), 'utf8')
      );

      await expect(access(join(projectPath, '.eslintrc.cjs'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.eslintrc.js'))).rejects.toThrow();
      expect(generatedPackageJson.scripts.lint).toBe('eslint "src/**/*.ts"');
      expect(mocks.exec).toHaveBeenCalledWith(
        'npm',
        ['install', '--save-dev', ...getEslintPackages({ typescript: true })],
        expect.objectContaining({
          cwd: projectPath,
          stdio: 'inherit',
        })
      );

      runGeneratedLint(projectPath, 'src/**/*.ts');
    },
    30_000
  );

  it('installs TS tooling as dev dependencies and keeps JS eslint lean', async () => {
    mocks.promptExpressCustomizations.mockResolvedValue({
      cors: true,
      dotenv: true,
      eslint: true,
      helmet: false,
      pattern: 'simple',
      prettier: false,
      typescript: false,
    });

    await expressAdapter.create({
      directory: 'demo-express-js',
      packageManager: 'pnpm',
      projectName: 'demo-express-js',
    });

    const generatedPackageJson = JSON.parse(
      await readFile(join(tempDir, 'demo-express-js', 'package.json'), 'utf8')
    );

    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['add', 'express', 'dotenv', 'cors'],
      expect.objectContaining({
        cwd: join(tempDir, 'demo-express-js'),
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', ...getEslintPackages({ typescript: false })],
      expect.objectContaining({
        cwd: join(tempDir, 'demo-express-js'),
        stdio: 'inherit',
      })
    );

    const allExecArgs = mocks.exec.mock.calls.map((call) => call[1]);
    expect(allExecArgs.some((args) => args.includes('@typescript-eslint/parser'))).toBe(false);
    expect(allExecArgs.some((args) => args.includes('typescript'))).toBe(false);
    expect(allExecArgs.some((args) => args.includes('tsx'))).toBe(false);
    expect(generatedPackageJson.scripts.lint).toBe('eslint "src/**/*.js"');
  });

  it.each([
    {
      pattern: 'mvc',
      paths: ['src/routes/index.ts', 'src/controllers/example.ts', 'src/models/example.ts'],
    },
    {
      pattern: 'rest',
      paths: ['src/routes/api.ts', 'src/controllers/user.ts', 'src/services/user.ts'],
    },
    {
      pattern: 'layered',
      paths: [
        'src/presentation/routes.ts',
        'src/presentation/controllers/product.ts',
        'src/business/product.ts',
        'src/data/product.ts',
      ],
    },
    {
      pattern: 'simple',
      paths: ['src/routes/index.ts'],
    },
  ])('generates the expected %s pattern structure', async ({ pattern, paths }) => {
    mocks.promptExpressCustomizations.mockResolvedValue({
      cors: false,
      dotenv: true,
      eslint: false,
      helmet: false,
      pattern,
      prettier: false,
      typescript: true,
    });

    const projectName = `demo-express-${pattern}`;
    await expressAdapter.create({
      directory: projectName,
      packageManager: 'npm',
      projectName,
      yes: true,
    });

    const projectPath = join(tempDir, projectName);
    for (const relativePath of paths) {
      await expect(access(join(projectPath, relativePath))).resolves.toBeUndefined();
    }
  });

  it.each([
    {
      controllerPath: 'src/controllers/example.js',
      dataPath: 'src/models/example.js',
      pattern: 'mvc',
    },
    {
      controllerPath: 'src/controllers/user.js',
      dataPath: 'src/services/user.js',
      pattern: 'rest',
    },
    {
      controllerPath: 'src/presentation/controllers/product.js',
      dataPath: 'src/data/product.js',
      pattern: 'layered',
    },
  ])(
    'strips TypeScript-only syntax from JavaScript %s scaffolds',
    async ({ controllerPath, dataPath, pattern }) => {
      mocks.promptExpressCustomizations.mockResolvedValue({
        cors: false,
        dotenv: true,
        eslint: false,
        helmet: false,
        pattern,
        prettier: false,
        typescript: false,
      });

      const projectName = `demo-express-js-${pattern}`;
      await expressAdapter.create({
        directory: projectName,
        packageManager: 'npm',
        projectName,
        yes: true,
      });

      const controllerContent = await readFile(join(tempDir, projectName, controllerPath), 'utf8');
      const dataContent = await readFile(join(tempDir, projectName, dataPath), 'utf8');

      expect(controllerContent).not.toContain("import { Request, Response } from 'express'");
      expect(controllerContent).not.toContain(': Request');
      expect(controllerContent).not.toContain(': Response');
      expect(dataContent).not.toContain('Map<string');
      expect(dataContent).not.toContain('Record<string, unknown>');
      expect(dataContent).not.toContain(': string');
      expect(dataContent).not.toContain(': any');
    }
  );

  it('applies explicit customization overrides on top of prompt defaults', async () => {
    mocks.promptExpressCustomizations.mockResolvedValue({
      cors: false,
      dotenv: true,
      eslint: true,
      helmet: false,
      pattern: 'mvc',
      prettier: false,
      typescript: true,
    });

    await expressAdapter.create({
      cors: true,
      directory: 'demo-express-overrides',
      dotenv: false,
      eslint: false,
      packageManager: 'npm',
      pattern: 'simple',
      prettier: true,
      projectName: 'demo-express-overrides',
      typescript: false,
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-express-overrides');
    const generatedPackageJson = JSON.parse(
      await readFile(join(projectPath, 'package.json'), 'utf8')
    );
    const generatedEntry = await readFile(join(projectPath, 'src', 'index.js'), 'utf8');

    expect(generatedPackageJson.scripts.dev).toBe('node --watch src/index.js');
    expect(generatedPackageJson.scripts.build).toBe('echo "No build step needed"');
    expect(generatedPackageJson.scripts.lint).toBeUndefined();
    expect(generatedEntry).toContain("import cors from 'cors'");
    expect(generatedEntry).not.toContain('dotenv/config');
    await expect(access(join(projectPath, '.prettierrc'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'routes', 'index.js'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'controllers', 'example.js'))).rejects.toThrow();
  });

  it('rejects express project names that are not valid npm package names', async () => {
    await expect(
      expressAdapter.create({
        directory: 'demo-express-invalid',
        packageManager: 'npm',
        projectName: 'My Express App',
        yes: true,
      })
    ).rejects.toThrow('Invalid npm package name');

    expect(mocks.promptExpressCustomizations).not.toHaveBeenCalled();
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it('cleans up the generated project directory when dependency installation fails', async () => {
    mocks.promptExpressCustomizations.mockResolvedValue({
      cors: false,
      dotenv: true,
      eslint: false,
      helmet: false,
      pattern: 'simple',
      prettier: false,
      typescript: true,
    });
    mocks.exec.mockRejectedValueOnce(new Error('registry timeout'));

    await expect(
      expressAdapter.create({
        directory: 'demo-express-failed',
        packageManager: 'npm',
        projectName: 'demo-express-failed',
        yes: true,
      })
    ).rejects.toThrow('registry timeout');

    await expect(access(join(tempDir, 'demo-express-failed'))).rejects.toThrow();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create project: registry timeout')
    );
  });

  it('cleans up nested parent directories it created when scaffolding fails', async () => {
    mocks.promptExpressCustomizations.mockResolvedValue({
      cors: false,
      dotenv: true,
      eslint: false,
      helmet: false,
      pattern: 'simple',
      prettier: false,
      typescript: true,
    });
    mocks.exec.mockRejectedValueOnce(new Error('registry timeout'));

    await expect(
      expressAdapter.create({
        directory: 'apps/demo-express-failed',
        packageManager: 'npm',
        projectName: 'demo-express-failed',
        yes: true,
      })
    ).rejects.toThrow('registry timeout');

    await expect(access(join(tempDir, 'apps', 'demo-express-failed'))).rejects.toThrow();
    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
