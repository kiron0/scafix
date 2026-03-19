import { access, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEslintPackages } from '../../src/utils/eslint.js';
import { npmPackageAdapter } from '../../src/adapters/npm.adapter.js';
import { getPackedFileNames, runGeneratedLint } from '../utils/scaffold.js';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  promptNpmPackageCustomizations: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
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

vi.mock('../../src/prompts/customizations.js', () => ({
  promptNpmPackageCustomizations: mocks.promptNpmPackageCustomizations,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

describe.sequential('npmPackageAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-npm-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('writes ESM-safe config files and declaration-aware esbuild output', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: true,
      buildTool: 'esbuild',
      eslint: true,
      prettier: false,
      testFramework: 'jest',
    });

    await npmPackageAdapter.create({
      directory: 'demo-pkg',
      packageManager: 'pnpm',
      projectName: 'demo-pkg',
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-pkg');
    const generatedPackageJson = JSON.parse(
      await readFile(join(projectPath, 'package.json'), 'utf8')
    );
    const generatedReadme = await readFile(join(projectPath, 'README.md'), 'utf8');

    expect(generatedPackageJson.scripts.build).toContain('tsc --emitDeclarationOnly');
    expect(generatedPackageJson.scripts.test).toContain('node --experimental-vm-modules');
    expect(generatedPackageJson.scripts.prepublishOnly).toBe(generatedPackageJson.scripts.build);
    expect(generatedPackageJson.types).toBe('dist/index.d.ts');
    expect(generatedReadme).toContain('pnpm add demo-pkg');
    expect(generatedReadme).toContain('pnpm install');
    expect(generatedReadme).toContain('pnpm build');
    expect(generatedReadme).toContain('pnpm test');
    expect(generatedReadme).toContain('pnpm publish');
    expect(generatedPackageJson.scripts.lint).toBe('eslint "src/**/*.ts"');
    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      [
        'add',
        '-D',
        'typescript',
        '@types/node',
        'esbuild',
        ...getEslintPackages({ typescript: true }),
        'jest',
        '@types/jest',
        'ts-jest',
      ],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'inherit',
      })
    );

    expect(await readFile(join(projectPath, 'jest.config.cjs'), 'utf8')).toContain(
      'ts-jest/presets/default-esm'
    );
    await expect(access(join(projectPath, '.eslintrc.cjs'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'jest.config.cjs'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, '.eslintrc.js'))).rejects.toThrow();
    await expect(access(join(projectPath, 'jest.config.js'))).rejects.toThrow();

    runGeneratedLint(projectPath, 'src/**/*.ts');
  });

  it('prints next steps without a redundant install command', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: true,
      buildTool: 'tsup',
      eslint: false,
      prettier: false,
      testFramework: 'vitest',
    });

    await npmPackageAdapter.create({
      directory: 'demo-bun',
      packageManager: 'bun',
      projectName: 'demo-bun',
      yes: true,
    });

    const infoMessages = mocks.logger.info.mock.calls.map(([message]) => message);

    expect(infoMessages).toContain('  bun run build');
    expect(infoMessages).toContain('  bun run test');
    expect(infoMessages).toContain('  bun publish');
    expect(infoMessages).not.toContain('  bun install');
  });

  it('generates ESM-friendly JavaScript Jest tests', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: false,
      buildTool: 'tsup',
      eslint: false,
      prettier: false,
      testFramework: 'jest',
    });

    await npmPackageAdapter.create({
      directory: 'demo-js-jest',
      packageManager: 'npm',
      projectName: 'demo-js-jest',
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-js-jest');
    const generatedPackageJson = JSON.parse(
      await readFile(join(projectPath, 'package.json'), 'utf8')
    );
    const generatedTest = await readFile(
      join(projectPath, 'src', '__tests__', 'index.test.js'),
      'utf8'
    );

    expect(generatedPackageJson.type).toBe('module');
    expect(generatedPackageJson.scripts.test).toContain('node --experimental-vm-modules');
    expect(generatedTest).toContain("import { greet } from '../index.js';");
    expect(generatedTest).not.toContain('require(');
  });

  it('supports scoped package names while deriving a safe default directory', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: false,
      buildTool: 'tsup',
      eslint: false,
      prettier: false,
      testFramework: 'none',
    });

    await npmPackageAdapter.create({
      packageManager: 'npm',
      projectName: '@scope/demo-pkg',
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-pkg');
    const generatedPackageJson = JSON.parse(
      await readFile(join(projectPath, 'package.json'), 'utf8')
    );

    expect(generatedPackageJson.name).toBe('@scope/demo-pkg');
    await expect(access(join(projectPath, 'src', 'index.js'))).resolves.toBeUndefined();
  });

  it('installs tslib for rollup-based TypeScript packages', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: true,
      buildTool: 'rollup',
      eslint: false,
      prettier: false,
      testFramework: 'none',
    });

    await npmPackageAdapter.create({
      directory: 'demo-rollup',
      packageManager: 'pnpm',
      projectName: 'demo-rollup',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'typescript', '@types/node', 'rollup', '@rollup/plugin-typescript', 'tslib'],
      expect.objectContaining({
        cwd: join(tempDir, 'demo-rollup'),
        stdio: 'inherit',
      })
    );
  });

  it('adds a JavaScript lint script when eslint is selected', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: false,
      buildTool: 'tsup',
      eslint: true,
      prettier: false,
      testFramework: 'none',
    });

    await npmPackageAdapter.create({
      directory: 'demo-js-eslint',
      packageManager: 'npm',
      projectName: 'demo-js-eslint',
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-js-eslint');
    const generatedPackageJson = JSON.parse(
      await readFile(join(projectPath, 'package.json'), 'utf8')
    );

    expect(generatedPackageJson.scripts.lint).toBe('eslint "src/**/*.js"');
    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      ['install', '--save-dev', ...getEslintPackages({ typescript: false })],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'inherit',
      })
    );
  });

  it('rejects overlong npm package names before scaffolding', async () => {
    const overlongName = 'a'.repeat(215);

    await expect(
      npmPackageAdapter.create({
        packageManager: 'npm',
        projectName: overlongName,
        yes: true,
      })
    ).rejects.toThrow('Invalid npm package name');

    expect(mocks.promptNpmPackageCustomizations).not.toHaveBeenCalled();
  });

  it('rejects invalid explicit directories before scaffolding', async () => {
    await expect(
      npmPackageAdapter.create({
        directory: 'CON.txt',
        packageManager: 'npm',
        projectName: 'demo-pkg',
        yes: true,
      })
    ).rejects.toThrow('Directory path segment is a reserved Windows name');

    expect(mocks.promptNpmPackageCustomizations).not.toHaveBeenCalled();
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it('keeps generated JavaScript test files out of the published tarball', async () => {
    mocks.promptNpmPackageCustomizations.mockResolvedValue({
      typescript: false,
      buildTool: 'tsup',
      eslint: false,
      prettier: false,
      testFramework: 'jest',
    });

    await npmPackageAdapter.create({
      directory: 'demo-js-pack',
      packageManager: 'npm',
      projectName: 'demo-js-pack',
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-js-pack');
    const packedFiles = getPackedFileNames(projectPath, join(projectPath, '.npm-cache'));

    expect(packedFiles).toContain('src/index.js');
    expect(packedFiles).not.toContain('src/__tests__/index.test.js');
  });
});
