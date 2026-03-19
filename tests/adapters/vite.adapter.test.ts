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
  promptViteReactCustomizations: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptViteReactCustomizations: mocks.promptViteReactCustomizations,
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

import { viteReactAdapter } from '../../src/adapters/vite.adapter.js';

describe.sequential('viteReactAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-vite-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName = args[2] as string | undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, 'src'), { recursive: true });
      await writeFile(join(projectPath, 'src', 'index.css'), 'body {}\n');
      await writeFile(join(projectPath, 'vite.config.js'), 'export default { plugins: [] }\n');
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

  it('uses shared customizations to select the Vite template in --yes mode', async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: false,
      shadcn: false,
      tailwind: false,
      typescript: true,
    });

    await viteReactAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-vite',
      yes: true,
    });

    expect(mocks.promptViteReactCustomizations).toHaveBeenCalledWith({
      yes: true,
    });
    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      ['create', 'vite@latest', 'demo-vite', '--', '--template', 'react-ts'],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      ['install'],
      expect.objectContaining({
        cwd: join(tempDir, 'demo-vite'),
        stdio: 'inherit',
      })
    );
  });

  it('applies JS template, tailwind v3, and prettier when requested', async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: true,
      shadcn: false,
      tailwind: true,
      tailwindVersion: 'v3',
      typescript: false,
    });
    await viteReactAdapter.create({
      directory: 'demo-vite-js',
      packageManager: 'pnpm',
      projectName: 'demo-vite-js',
    });

    const projectPath = join(tempDir, 'demo-vite-js');

    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['create', 'vite', 'demo-vite-js', '--template', 'react'],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['install'],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'inherit',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'tailwindcss@^3', 'postcss', 'autoprefixer'],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'pipe',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      process.platform === 'win32'
        ? join(projectPath, 'node_modules', '.bin', 'tailwindcss.cmd')
        : join(projectPath, 'node_modules', '.bin', 'tailwindcss'),
      ['init', '-p'],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'pipe',
      })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'prettier'],
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'pipe',
      })
    );
    await expect(access(join(projectPath, '.prettierrc'))).resolves.toBeUndefined();
    expect(await readFile(join(projectPath, 'src', 'index.css'), 'utf8')).toContain(
      '@tailwind base;'
    );
  });

  it('uses the selected package manager to run shadcn for bun projects', async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: false,
      shadcn: true,
      tailwind: true,
      tailwindVersion: 'v4',
      typescript: true,
    });

    await viteReactAdapter.create({
      directory: 'demo-vite-bun',
      packageManager: 'bun',
      projectName: 'demo-vite-bun',
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'bun',
      ['install'],
      expect.objectContaining({
        cwd: join(tempDir, 'demo-vite-bun'),
        stdio: 'inherit',
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
        'vite',
        '--cwd',
        join(tempDir, 'demo-vite-bun'),
      ],
      expect.objectContaining({
        cwd: join(tempDir, 'demo-vite-bun'),
        stdio: 'inherit',
      })
    );
  });

  it('reconciles package.json name from the requested project name when directory differs', async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: false,
      shadcn: false,
      tailwind: false,
      typescript: true,
    });

    await viteReactAdapter.create({
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

  it('cleans up the generated project directory when shadcn setup fails', async () => {
    mocks.promptViteReactCustomizations.mockResolvedValue({
      prettier: false,
      shadcn: true,
      tailwind: true,
      tailwindVersion: 'v4',
      typescript: true,
    });
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName = args[2] as string | undefined;
      if (projectName && options?.cwd === tempDir) {
        const projectPath = join(tempDir, projectName);
        await mkdir(join(projectPath, 'src'), { recursive: true });
        await writeFile(join(projectPath, 'src', 'index.css'), 'body {}\n');
        await writeFile(join(projectPath, 'vite.config.js'), 'export default { plugins: [] }\n');
        await writeFile(
          join(projectPath, 'package.json'),
          `${JSON.stringify({ name: projectName }, null, 2)}\n`
        );
        return;
      }

      if (args[0] === 'shadcn@latest') {
        throw new Error('shadcn init failed');
      }
    });

    await expect(
      viteReactAdapter.create({
        directory: 'demo-vite-failed',
        packageManager: 'npm',
        projectName: 'demo-vite-failed',
      })
    ).rejects.toThrow('shadcn init failed');

    await expect(access(join(tempDir, 'demo-vite-failed'))).rejects.toThrow();
  });

  it.each([
    {
      args: ['create', 'vite@latest', 'demo-vite-npm', '--', '--template', 'react-ts'],
      cmd: 'npm',
      packageManager: 'npm',
    },
    {
      args: ['create', 'vite', 'demo-vite-pnpm', '--template', 'react-ts'],
      cmd: 'pnpm',
      packageManager: 'pnpm',
    },
    {
      args: ['create', 'vite', 'demo-vite-yarn', '--template', 'react-ts'],
      cmd: 'yarn',
      packageManager: 'yarn',
    },
    {
      args: ['create', 'vite', 'demo-vite-bun', '--template', 'react-ts'],
      cmd: 'bun',
      packageManager: 'bun',
    },
  ])(
    'covers the Vite external CLI command mapping for $packageManager',
    async ({ args, cmd, packageManager }) => {
      mocks.promptViteReactCustomizations.mockResolvedValue({
        prettier: false,
        shadcn: false,
        tailwind: false,
        typescript: true,
      });

      const projectName = `demo-vite-${packageManager}`;
      await viteReactAdapter.create({
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
});
