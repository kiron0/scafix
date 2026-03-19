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
  promptNuxtCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptNuxtCustomizations: mocks.promptNuxtCustomizations,
}));

import { nuxtAdapter } from '../../src/adapters/nuxt.adapter.js';

describe.sequential('nuxtAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptNuxtCustomizations.mockResolvedValue({
      template: 'minimal',
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-nuxt-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName = args[2] as string | undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, 'app'), { recursive: true });
      await writeFile(join(projectPath, 'app', 'app.vue'), '<template><NuxtPage /></template>\n');
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
    {
      args: [
        'create',
        'nuxt@latest',
        'demo-nuxt-npm',
        '--',
        '--template',
        'minimal',
        '--packageManager',
        'npm',
        '--no-modules',
        '--no-gitInit',
      ],
      cmd: 'npm',
      packageManager: 'npm',
    },
    {
      args: [
        'create',
        'nuxt@latest',
        'demo-nuxt-pnpm',
        '--template',
        'minimal',
        '--packageManager',
        'pnpm',
        '--no-modules',
        '--no-gitInit',
      ],
      cmd: 'pnpm',
      packageManager: 'pnpm',
    },
    {
      args: [
        'create',
        'nuxt',
        'demo-nuxt-yarn',
        '--template',
        'minimal',
        '--packageManager',
        'yarn',
        '--no-modules',
        '--no-gitInit',
      ],
      cmd: 'yarn',
      packageManager: 'yarn',
    },
    {
      args: [
        'create',
        'nuxt@latest',
        'demo-nuxt-bun',
        '--template',
        'minimal',
        '--packageManager',
        'bun',
        '--no-modules',
        '--no-gitInit',
      ],
      cmd: 'bun',
      packageManager: 'bun',
    },
  ])(
    'covers the Nuxt external CLI command mapping for $packageManager',
    async ({ args, cmd, packageManager }) => {
      const projectName = `demo-nuxt-${packageManager}`;

      await nuxtAdapter.create({
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

  it('reconciles package.json name from the requested project name when directory differs', async () => {
    await nuxtAdapter.create({
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

  it('uses the selected Nuxt template when customizations request it', async () => {
    mocks.promptNuxtCustomizations.mockResolvedValue({
      template: 'content',
    });

    await nuxtAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-nuxt-content',
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      [
        'create',
        'nuxt@latest',
        'demo-nuxt-content',
        '--',
        '--template',
        'content',
        '--packageManager',
        'npm',
        '--no-modules',
        '--no-gitInit',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up any parent directories it created when nested scaffolding fails early', async () => {
    mocks.exec.mockRejectedValue(new Error('create nuxt failed'));

    await expect(
      nuxtAdapter.create({
        directory: 'apps/demo-nuxt-failed',
        packageManager: 'npm',
        projectName: 'demo-nuxt-failed',
      })
    ).rejects.toThrow('create nuxt failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
    await expect(access(join(tempDir, 'apps', 'demo-nuxt-failed'))).rejects.toThrow();
  });
});
