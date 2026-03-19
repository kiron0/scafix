import { access, mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
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
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));

import { elysiaAdapter } from '../../src/adapters/elysia.adapter.js';

describe.sequential('elysiaAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-elysia-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const projectName = args[2] as string | undefined;
        if (!projectName || options?.cwd !== tempDir) return;
        const projectPath = join(tempDir, projectName);
        await mkdir(join(projectPath, 'src'), { recursive: true });
        await writeFile(
          join(projectPath, 'package.json'),
          `${JSON.stringify({ name: projectName }, null, 2)}\n`
        );
      }
    );
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('calls bun create elysia', async () => {
    await elysiaAdapter.create({
      packageManager: 'bun',
      projectName: 'demo-elysia',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'bun',
      ['create', 'elysia', 'demo-elysia'],
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('warns when non-bun package manager is specified', async () => {
    await elysiaAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-elysia-npm',
      yes: true,
    });

    expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Bun-native'));
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('elysia failed'));

    await expect(
      elysiaAdapter.create({
        directory: 'services/demo-elysia-fail',
        packageManager: 'bun',
        projectName: 'demo-elysia-fail',
      })
    ).rejects.toThrow('elysia failed');

    await expect(access(join(tempDir, 'services'))).rejects.toThrow();
  });
});
