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
  promptSvelteKitCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/prompts/customizations.js', () => ({
  promptSvelteKitCustomizations: mocks.promptSvelteKitCustomizations,
}));

import { sveltekitAdapter } from '../../src/adapters/sveltekit.adapter.js';

describe.sequential('sveltekitAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptSvelteKitCustomizations.mockResolvedValue({
      template: 'minimal',
      types: 'ts',
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-sveltekit-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(async (_command, args, options) => {
      const projectName =
        args[0] === 'sv' && args[1] === 'create'
          ? (args[2] as string)
          : args[0] === 'dlx' && args[1] === 'sv' && args[2] === 'create'
            ? (args[3] as string)
            : undefined;
      if (!projectName || options?.cwd !== tempDir) {
        return;
      }

      const projectPath = join(tempDir, projectName);
      await mkdir(join(projectPath, 'src', 'routes'), { recursive: true });
      await writeFile(join(projectPath, 'src', 'routes', '+page.svelte'), '<h1>Hello</h1>\n');
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
        'sv',
        'create',
        'demo-sveltekit-npm',
        '--template',
        'minimal',
        '--types',
        'ts',
        '--install',
        'npm',
        '--no-add-ons',
      ],
      cmd: 'npx',
      packageManager: 'npm',
    },
    {
      args: [
        'dlx',
        'sv',
        'create',
        'demo-sveltekit-pnpm',
        '--template',
        'minimal',
        '--types',
        'ts',
        '--install',
        'pnpm',
        '--no-add-ons',
      ],
      cmd: 'pnpm',
      packageManager: 'pnpm',
    },
    {
      args: [
        'sv',
        'create',
        'demo-sveltekit-yarn',
        '--template',
        'minimal',
        '--types',
        'ts',
        '--install',
        'yarn',
        '--no-add-ons',
      ],
      cmd: 'npx',
      packageManager: 'yarn',
    },
    {
      args: [
        'sv',
        'create',
        'demo-sveltekit-bun',
        '--template',
        'minimal',
        '--types',
        'ts',
        '--install',
        'bun',
        '--no-add-ons',
      ],
      cmd: 'bunx',
      packageManager: 'bun',
    },
  ])(
    'covers the SvelteKit external CLI command mapping for $packageManager',
    async ({ args, cmd, packageManager }) => {
      const projectName = `demo-sveltekit-${packageManager}`;

      await sveltekitAdapter.create({
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

  it('uses yarn berry dlx when the workspace is configured for yarn berry', async () => {
    await writeFile(join(tempDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');

    await sveltekitAdapter.create({
      packageManager: 'yarn',
      projectName: 'demo-sveltekit-yarn-berry',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'yarn',
      [
        'dlx',
        'sv',
        'create',
        'demo-sveltekit-yarn-berry',
        '--template',
        'minimal',
        '--types',
        'ts',
        '--install',
        'yarn',
        '--no-add-ons',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('reconciles package.json name from the requested project name when directory differs', async () => {
    await sveltekitAdapter.create({
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

  it('uses the selected SvelteKit template and type mode when customizations request it', async () => {
    mocks.promptSvelteKitCustomizations.mockResolvedValue({
      template: 'demo',
      types: 'jsdoc',
    });

    await sveltekitAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-sveltekit-demo',
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      [
        'sv',
        'create',
        'demo-sveltekit-demo',
        '--template',
        'demo',
        '--types',
        'jsdoc',
        '--install',
        'npm',
        '--add',
        'prettier',
        'eslint',
      ],
      expect.objectContaining({
        cwd: tempDir,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up any parent directories it created when nested scaffolding fails early', async () => {
    mocks.exec.mockRejectedValue(new Error('sv create failed'));

    await expect(
      sveltekitAdapter.create({
        directory: 'apps/demo-sveltekit-failed',
        packageManager: 'npm',
        projectName: 'demo-sveltekit-failed',
      })
    ).rejects.toThrow('sv create failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
    await expect(access(join(tempDir, 'apps', 'demo-sveltekit-failed'))).rejects.toThrow();
  });
});
