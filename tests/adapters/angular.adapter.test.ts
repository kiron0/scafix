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
  promptAngularCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptAngularCustomizations: mocks.promptAngularCustomizations,
}));

import { angularAdapter } from '../../src/adapters/angular.adapter.js';

describe.sequential('angularAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptAngularCustomizations.mockResolvedValue({
      style: 'css',
      ssr: false,
      routing: true,
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-angular-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const dirIdx = args.indexOf('new');
        const dir = dirIdx >= 0 ? (args[dirIdx + 1] as string) : undefined;
        if (!dir || options?.cwd !== tempDir) return;
        const projectPath = join(tempDir, dir);
        await mkdir(join(projectPath, 'src'), { recursive: true });
        await writeFile(
          join(projectPath, 'package.json'),
          `${JSON.stringify({ name: dir }, null, 2)}\n`
        );
      }
    );
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('calls @angular/cli new via npx', async () => {
    await angularAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-angular',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['@angular/cli@latest', 'new', 'demo-angular']),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('angular failed'));

    await expect(
      angularAdapter.create({
        directory: 'apps/demo-angular-fail',
        packageManager: 'npm',
        projectName: 'demo-angular-fail',
      })
    ).rejects.toThrow('angular failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
