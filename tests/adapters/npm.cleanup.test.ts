import { access, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe.sequential('npmPackageAdapter mkdir cleanup regression', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-npm-cleanup-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('removes created parent directories when project mkdir fails', async () => {
    const projectPath = join(tempDir, 'packages', 'demo-failed-pkg');
    const parentPath = join(tempDir, 'packages');
    const promptNpmPackageCustomizations = vi.fn().mockResolvedValue({
      buildTool: 'tsup',
      eslint: false,
      prettier: false,
      testFramework: 'none',
      typescript: true,
    });
    const exec = vi.fn();
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    };
    const actualFs = await vi.importActual<typeof import('fs/promises')>('fs/promises');

    vi.doMock('fs/promises', () => ({
      ...actualFs,
      mkdir: vi.fn(async (path: string | Buffer | URL, options?: { recursive?: boolean }) => {
        if (typeof path === 'string' && path === projectPath) {
          throw new Error('mkdir failed');
        }

        return actualFs.mkdir(path, options);
      }),
    }));
    vi.doMock('@clack/prompts', () => ({
      spinner: () => ({
        start: vi.fn(),
        stop: vi.fn(),
      }),
    }));
    vi.doMock('../../src/utils/exec.js', () => ({
      exec,
    }));
    vi.doMock('../../src/prompts/customizations.js', () => ({
      promptNpmPackageCustomizations,
    }));
    vi.doMock('../../src/utils/logger.js', () => ({
      logger,
    }));

    const { npmPackageAdapter } = await import('../../src/adapters/npm.adapter.js');

    await expect(
      npmPackageAdapter.create({
        directory: 'packages/demo-failed-pkg',
        packageManager: 'npm',
        projectName: 'demo-failed-pkg',
        yes: true,
      })
    ).rejects.toThrow('mkdir failed');

    await expect(access(projectPath)).rejects.toThrow();
    await expect(access(parentPath)).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create package'));
  });
});
