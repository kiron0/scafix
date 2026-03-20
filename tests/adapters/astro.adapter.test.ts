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
  promptAstroCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptAstroCustomizations: mocks.promptAstroCustomizations,
}));

import { astroAdapter } from '../../src/adapters/astro.adapter.js';

describe.sequential('astroAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptAstroCustomizations.mockResolvedValue({
      template: 'minimal',
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-astro-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName = args[2] as string | undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, 'src', 'pages'), { recursive: true });
      await writeFile(
        join(projectPath, 'src', 'pages', 'index.astro'),
        '---\n---\n<h1>Hello</h1>\n'
      );
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
        'astro@latest',
        'demo-astro-npm',
        '--',
        '--template',
        'minimal',
        '--install',
        '--no-git',
        '--yes',
      ],
      cmd: 'npm',
      packageManager: 'npm',
    },
    {
      args: [
        'create',
        'astro@latest',
        'demo-astro-pnpm',
        '--template',
        'minimal',
        '--install',
        '--no-git',
        '--yes',
      ],
      cmd: 'pnpm',
      packageManager: 'pnpm',
    },
    {
      args: [
        'create',
        'astro',
        'demo-astro-yarn',
        '--template',
        'minimal',
        '--install',
        '--no-git',
        '--yes',
      ],
      cmd: 'yarn',
      packageManager: 'yarn',
    },
    {
      args: [
        'create',
        'astro@latest',
        'demo-astro-bun',
        '--template',
        'minimal',
        '--install',
        '--no-git',
        '--yes',
      ],
      cmd: 'bun',
      packageManager: 'bun',
    },
  ])(
    'covers the Astro external CLI command mapping for $packageManager',
    async ({ args, cmd, packageManager }) => {
      const projectName = `demo-astro-${packageManager}`;

      await astroAdapter.create({
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
    await astroAdapter.create({
      directory: 'apps/content-site',
      packageManager: 'npm',
      projectName: 'Marketing Site',
      yes: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(tempDir, 'apps', 'content-site', 'package.json'), 'utf8')
    ) as { name: string };

    expect(packageJson.name).toBe('marketing-site');
  });

  it('uses the selected Astro template when customizations request it', async () => {
    mocks.promptAstroCustomizations.mockResolvedValue({
      template: 'blog',
    });

    await astroAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-astro-blog',
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      [
        'create',
        'astro@latest',
        'demo-astro-blog',
        '--',
        '--template',
        'blog',
        '--install',
        '--no-git',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('rejects invalid template overrides instead of silently falling back', async () => {
    await expect(
      astroAdapter.create({
        packageManager: 'npm',
        projectName: 'demo-astro-invalid',
        template: 'starter',
        yes: true,
      })
    ).rejects.toThrow('Invalid value for --template: starter. Expected one of: minimal, blog, docs');

    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it('always disables Astro git initialisation so root commands remain the single git owner', async () => {
    await astroAdapter.create({
      git: true,
      packageManager: 'npm',
      projectName: 'demo-astro-git',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      [
        'create',
        'astro@latest',
        'demo-astro-git',
        '--',
        '--template',
        'minimal',
        '--install',
        '--no-git',
        '--yes',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up any parent directories it created when nested Astro scaffolding fails early', async () => {
    mocks.exec.mockRejectedValue(new Error('create astro failed'));

    await expect(
      astroAdapter.create({
        directory: 'apps/demo-astro-failed',
        packageManager: 'npm',
        projectName: 'demo-astro-failed',
      })
    ).rejects.toThrow('create astro failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
    await expect(access(join(tempDir, 'apps', 'demo-astro-failed'))).rejects.toThrow();
  });
});
