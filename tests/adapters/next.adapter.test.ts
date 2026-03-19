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
  promptNextCustomizations: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptNextCustomizations: mocks.promptNextCustomizations,
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

import { nextAdapter } from '../../src/adapters/next.adapter.js';

describe.sequential('nextAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-next-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName =
        args[0] === 'create-next-app@latest'
          ? (args[1] as string)
          : args[0] === 'create' && args[1] === 'next-app'
            ? (args[2] as string)
            : args[1] === 'create-next-app@latest'
              ? (args[2] as string)
              : undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(projectPath, { recursive: true });
      await writeFile(join(projectPath, 'package.json'), `${JSON.stringify({ name: projectName }, null, 2)}\n`);
    });
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('uses shared customizations to build create-next-app flags', async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: false,
      eslint: false,
      prettier: false,
      shadcn: false,
      srcDir: false,
      tailwind: false,
      typescript: false,
    });

    await nextAdapter.create({
      packageManager: 'pnpm',
      projectName: 'demo-next',
      yes: true,
    });

    expect(mocks.promptNextCustomizations).toHaveBeenCalledWith({
      yes: true,
    });
    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      [
        'dlx',
        'create-next-app@latest',
        'demo-next',
        '--js',
        '--no-eslint',
        '--no-app',
        '--no-src-dir',
        '--no-tailwind',
        '--import-alias',
        '@/*',
        '--use-pnpm',
        '--disable-git',
        '--yes',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it.each([
    {
      args: [
        'create-next-app@latest',
        'demo-next-npm',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-npm',
        '--disable-git',
        '--yes',
      ],
      cmd: 'npx',
      packageManager: 'npm',
    },
    {
      args: [
        'dlx',
        'create-next-app@latest',
        'demo-next-pnpm',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-pnpm',
        '--disable-git',
        '--yes',
      ],
      cmd: 'pnpm',
      packageManager: 'pnpm',
    },
    {
      args: [
        'create',
        'next-app',
        'demo-next-yarn',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-yarn',
        '--disable-git',
        '--yes',
      ],
      cmd: 'yarn',
      packageManager: 'yarn',
    },
    {
      args: [
        'create-next-app@latest',
        'demo-next-bun',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-bun',
        '--disable-git',
        '--yes',
      ],
      cmd: 'bunx',
      packageManager: 'bun',
    },
  ])(
    'covers the Next.js external CLI command mapping for $packageManager',
    async ({ args, cmd, packageManager }) => {
      mocks.promptNextCustomizations.mockResolvedValue({
        appRouter: true,
        eslint: true,
        prettier: false,
        shadcn: false,
        srcDir: true,
        tailwind: true,
        typescript: true,
      });

      const projectName = `demo-next-${packageManager}`;
      await nextAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      expect(mocks.exec).toHaveBeenCalledWith(
        cmd,
        args,
        expect.objectContaining({
          cwd: tempDir,
          stdio: 'inherit',
        })
      );
    }
  );

  it('adds prettier and shadcn when requested', async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: true,
      eslint: true,
      prettier: true,
      shadcn: true,
      srcDir: true,
      tailwind: true,
      typescript: true,
    });

    await nextAdapter.create({
      directory: 'demo-next-prettier',
      packageManager: 'bun',
      projectName: 'demo-next-prettier',
    });

    const projectPath = join(tempDir, 'demo-next-prettier');

    expect(mocks.exec).toHaveBeenCalledWith(
      'bunx',
      [
        'create-next-app@latest',
        'demo-next-prettier',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-bun',
        '--disable-git',
        '--yes',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'bun',
      ['add', '-D', 'prettier'],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'pipe',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'bunx',
      [
        'shadcn@latest',
        'init',
        '--defaults',
        '--yes',
        '--template',
        'next',
        '--cwd',
        projectPath,
      ],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'inherit',
      })
    );
    await expect(access(join(projectPath, '.prettierrc'))).resolves.toBeUndefined();
  });

  it('reconciles package.json name from the requested project name when directory differs', async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: true,
      eslint: true,
      prettier: false,
      shadcn: false,
      srcDir: true,
      tailwind: true,
      typescript: true,
    });

    await nextAdapter.create({
      directory: 'apps/web',
      packageManager: 'npm',
      projectName: 'Marketing Site',
      yes: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(tempDir, 'apps', 'web', 'package.json'), 'utf8')
    ) as { name: string };

    expect(packageJson.name).toBe('marketing-site');
  });

  it('uses yarn berry commands for Next.js follow-up tooling when the workspace is berry', async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: true,
      eslint: true,
      prettier: false,
      shadcn: true,
      srcDir: true,
      tailwind: true,
      typescript: true,
    });
    await writeFile(join(tempDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');

    await nextAdapter.create({
      directory: 'demo-next-yarn',
      packageManager: 'yarn',
      projectName: 'demo-next-yarn',
    });

    const projectPath = join(tempDir, 'demo-next-yarn');

    expect(mocks.exec).toHaveBeenCalledWith(
      'yarn',
      [
        'create',
        'next-app',
        'demo-next-yarn',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-yarn',
        '--disable-git',
        '--yes',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'yarn',
      [
        'dlx',
        'shadcn@latest',
        'init',
        '--defaults',
        '--yes',
        '--template',
        'next',
        '--cwd',
        projectPath,
      ],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up the generated project directory when shadcn setup fails', async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: true,
      eslint: true,
      prettier: false,
      shadcn: true,
      srcDir: true,
      tailwind: true,
      typescript: true,
    });
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName =
        args[0] === 'create-next-app@latest'
          ? (args[1] as string)
          : args[0] === 'create' && args[1] === 'next-app'
            ? (args[2] as string)
            : args[1] === 'create-next-app@latest'
              ? (args[2] as string)
              : undefined;
      if (projectName && options?.cwd === tempDir) {
        const projectPath = join(tempDir, projectName);
        await mkdir(projectPath, { recursive: true });
        await writeFile(join(projectPath, 'package.json'), `${JSON.stringify({ name: projectName }, null, 2)}\n`);
        return;
      }

      if (args.includes('shadcn@latest')) {
        throw new Error('shadcn init failed');
      }
    });

    await expect(
      nextAdapter.create({
        directory: 'demo-next-failed',
        packageManager: 'pnpm',
        projectName: 'demo-next-failed',
      })
    ).rejects.toThrow('shadcn init failed');

    await expect(access(join(tempDir, 'demo-next-failed'))).rejects.toThrow();
  });

  it('keeps create-next-app git initialisation enabled only when git is explicitly requested', async () => {
    mocks.promptNextCustomizations.mockResolvedValue({
      appRouter: true,
      eslint: true,
      prettier: false,
      shadcn: false,
      srcDir: true,
      tailwind: true,
      typescript: true,
    });

    await nextAdapter.create({
      git: true,
      packageManager: 'npm',
      projectName: 'demo-next-git',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      [
        'create-next-app@latest',
        'demo-next-git',
        '--ts',
        '--eslint',
        '--app',
        '--src-dir',
        '--tailwind',
        '--import-alias',
        '@/*',
        '--use-npm',
        '--yes',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).not.toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['--disable-git']),
      expect.anything()
    );
  });
});
