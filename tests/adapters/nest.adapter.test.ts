import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  promptNestCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptNestCustomizations: mocks.promptNestCustomizations,
}));

import { nestAdapter } from '../../src/adapters/nest.adapter.js';

describe.sequential('nestAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptNestCustomizations.mockResolvedValue({
      language: 'ts',
      strict: true,
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-nest-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (command, args, options) => {
      if (command !== 'npx' || options?.cwd !== tempDir) {
        return;
      }

      const projectName = args[3] as string | undefined;
      if (!projectName) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, 'src'), { recursive: true });
      await writeFile(join(projectPath, 'src', 'main.ts'), 'console.log("hello nest");\n');
      await writeFile(
        join(projectPath, 'package.json'),
        `${JSON.stringify({ name: projectName }, null, 2)}\n`
      );
    });
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each([
    { expectedScaffoldPackageManager: 'npm', packageManager: 'npm' },
    { expectedScaffoldPackageManager: 'pnpm', packageManager: 'pnpm' },
    { expectedScaffoldPackageManager: 'yarn', packageManager: 'yarn' },
    { expectedScaffoldPackageManager: 'npm', packageManager: 'bun' },
  ])(
    'scaffolds Nest and installs dependencies for $packageManager',
    async ({ expectedScaffoldPackageManager, packageManager }) => {
      const projectName = `demo-nest-${packageManager}`;

      await nestAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      expect(mocks.exec).toHaveBeenNthCalledWith(
        1,
        'npx',
        [
          '--yes',
          '@nestjs/cli@latest',
          'new',
          projectName,
          '--language',
          'TypeScript',
          '--skip-git',
          '--skip-install',
          '--strict',
          '--package-manager',
          expectedScaffoldPackageManager,
        ],
        expect.objectContaining({
          cwd: tempDir,
          stdio: 'inherit',
        })
      );

      expect(mocks.exec).toHaveBeenNthCalledWith(
        2,
        packageManager === 'npm' ? 'npm' : packageManager,
        ['install'],
        expect.objectContaining({
          cwd: join(tempDir, projectName),
          stdio: 'inherit',
        })
      );
    }
  );

  it('reconciles package.json name from the requested project name when directory differs', async () => {
    await nestAdapter.create({
      directory: 'services/api',
      packageManager: 'npm',
      projectName: 'Core API',
      yes: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(tempDir, 'services', 'api', 'package.json'), 'utf8')
    ) as { name: string };

    expect(packageJson.name).toBe('core-api');
  });

  it('always disables Nest git initialisation so root commands remain the single git owner', async () => {
    await nestAdapter.create({
      git: true,
      packageManager: 'npm',
      projectName: 'demo-nest-git',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenNthCalledWith(
      1,
      'npx',
      [
        '--yes',
        '@nestjs/cli@latest',
        'new',
        'demo-nest-git',
        '--language',
        'TypeScript',
        '--skip-git',
        '--skip-install',
        '--strict',
        '--package-manager',
        'npm',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up any parent directories it created when nested Nest scaffolding fails early', async () => {
    mocks.exec.mockRejectedValue(new Error('create nest failed'));

    await expect(
      nestAdapter.create({
        directory: 'services/demo-nest-failed',
        packageManager: 'npm',
        projectName: 'demo-nest-failed',
      })
    ).rejects.toThrow('create nest failed');

    await expect(access(join(tempDir, 'services'))).rejects.toThrow();
    await expect(access(join(tempDir, 'services', 'demo-nest-failed'))).rejects.toThrow();
  });

  it('uses the selected language and can disable strict mode when customizations request it', async () => {
    mocks.promptNestCustomizations.mockResolvedValue({
      language: 'js',
      strict: false,
    });

    await nestAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-nest-js',
    });

    expect(mocks.exec).toHaveBeenNthCalledWith(
      1,
      'npx',
      [
        '--yes',
        '@nestjs/cli@latest',
        'new',
        'demo-nest-js',
        '--language',
        'JavaScript',
        '--skip-git',
        '--skip-install',
        '--package-manager',
        'npm',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });
});
