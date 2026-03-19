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
  promptHonoCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptHonoCustomizations: mocks.promptHonoCustomizations,
}));

import { honoAdapter } from '../../src/adapters/hono.adapter.js';

describe.sequential('honoAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptHonoCustomizations.mockResolvedValue({
      template: 'nodejs',
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-hono-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName = args[2] as string | undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, 'src'), { recursive: true });
      await writeFile(join(projectPath, 'src', 'index.ts'), 'console.log("hello hono");\n');
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
        'hono@latest',
        'demo-hono-npm',
        '--',
        '--template',
        'nodejs',
        '--install',
        '--pm',
        'npm',
      ],
      cmd: 'npm',
      packageManager: 'npm',
    },
    {
      args: [
        'create',
        'hono@latest',
        'demo-hono-pnpm',
        '--template',
        'nodejs',
        '--install',
        '--pm',
        'pnpm',
      ],
      cmd: 'pnpm',
      packageManager: 'pnpm',
    },
    {
      args: [
        'create',
        'hono',
        'demo-hono-yarn',
        '--template',
        'nodejs',
        '--install',
        '--pm',
        'yarn',
      ],
      cmd: 'yarn',
      packageManager: 'yarn',
    },
    {
      args: [
        'create',
        'hono@latest',
        'demo-hono-bun',
        '--template',
        'nodejs',
        '--install',
        '--pm',
        'bun',
      ],
      cmd: 'bun',
      packageManager: 'bun',
    },
  ])(
    'covers the Hono external CLI command mapping for $packageManager',
    async ({ args, cmd, packageManager }) => {
      const projectName = `demo-hono-${packageManager}`;

      await honoAdapter.create({
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
    await honoAdapter.create({
      directory: 'services/edge-api',
      packageManager: 'npm',
      projectName: 'Edge API',
      yes: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(tempDir, 'services', 'edge-api', 'package.json'), 'utf8')
    ) as { name: string };

    expect(packageJson.name).toBe('edge-api');
  });

  it('uses the selected Hono template when customizations request it', async () => {
    mocks.promptHonoCustomizations.mockResolvedValue({
      template: 'cloudflare-workers',
    });

    await honoAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-hono-workers',
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      [
        'create',
        'hono@latest',
        'demo-hono-workers',
        '--',
        '--template',
        'cloudflare-workers',
        '--install',
        '--pm',
        'npm',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up any parent directories it created when nested Hono scaffolding fails early', async () => {
    mocks.exec.mockRejectedValue(new Error('create hono failed'));

    await expect(
      honoAdapter.create({
        directory: 'services/demo-hono-failed',
        packageManager: 'npm',
        projectName: 'demo-hono-failed',
      })
    ).rejects.toThrow('create hono failed');

    await expect(access(join(tempDir, 'services'))).rejects.toThrow();
    await expect(access(join(tempDir, 'services', 'demo-hono-failed'))).rejects.toThrow();
  });
});
