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
  promptRemixCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptRemixCustomizations: mocks.promptRemixCustomizations,
}));

import { remixAdapter } from '../../src/adapters/remix.adapter.js';

describe.sequential('remixAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptRemixCustomizations.mockResolvedValue({ template: 'remix' });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-remix-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const projectName = args[2] as string | undefined;
        if (!projectName || options?.cwd !== tempDir) return;
        const projectPath = join(tempDir, projectName);
        await mkdir(join(projectPath, 'app'), { recursive: true });
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

  it('calls create-react-router via a dlx command for npm', async () => {
    await remixAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-remix',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['create-react-router@latest', 'demo-remix']),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      ['install'],
      expect.objectContaining({ cwd: join(tempDir, 'demo-remix'), stdio: 'inherit' })
    );
  });

  it('always disables React Router git initialisation so root commands remain the single git owner', async () => {
    await remixAdapter.create({
      git: true,
      packageManager: 'npm',
      projectName: 'demo-remix-git',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        'create-react-router@latest',
        'demo-remix-git',
        '--no-git-init',
      ]),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('remix failed'));

    await expect(
      remixAdapter.create({
        directory: 'apps/demo-remix-fail',
        packageManager: 'npm',
        projectName: 'demo-remix-fail',
      })
    ).rejects.toThrow('remix failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
