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

  it('writes an ESM-safe eslint config for generated express projects', async () => {
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
  });

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
});
