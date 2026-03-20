import { access, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe.sequential('expressAdapter mkdir cleanup regression', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-express-cleanup-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('removes created parent directories when project mkdir fails', async () => {
    const projectPath = join(tempDir, 'apps', 'demo-express-failed');
    const parentPath = join(tempDir, 'apps');
    const promptExpressCustomizations = vi.fn().mockResolvedValue({
      cors: false,
      dotenv: true,
      eslint: false,
      helmet: false,
      pattern: 'simple',
      prettier: false,
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
    vi.doMock('../../src/utils/logger.js', () => ({
      logger,
    }));
    vi.doMock('../../src/prompts/customizations.js', () => ({
      promptExpressCustomizations,
    }));

    const { expressAdapter } = await import('../../src/adapters/express.adapter.js');

    await expect(
      expressAdapter.create({
        directory: 'apps/demo-express-failed',
        packageManager: 'npm',
        projectName: 'demo-express-failed',
        yes: true,
      })
    ).rejects.toThrow('mkdir failed');

    await expect(access(projectPath)).rejects.toThrow();
    await expect(access(parentPath)).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create project'));
  });
});
