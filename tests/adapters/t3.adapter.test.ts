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
  promptT3Customizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptT3Customizations: mocks.promptT3Customizations,
}));

import { t3Adapter } from '../../src/adapters/t3.adapter.js';

describe.sequential('t3Adapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptT3Customizations.mockResolvedValue({
      packages: ['tailwind', 'trpc', 'prisma'],
      appRouter: true,
    });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-t3-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const dir = args[2] as string | undefined;
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

  it('calls create-t3-app via npx', async () => {
    await t3Adapter.create({
      packageManager: 'npm',
      projectName: 'demo-t3',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        'create-t3-app@latest',
        'demo-t3',
        '--CI',
        '--tailwind',
        'true',
        '--trpc',
        'true',
        '--prisma',
        'true',
        '--nextAuth',
        'false',
        '--appRouter',
        'true',
      ]),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('always disables create-t3-app git initialisation so root commands remain the single git owner', async () => {
    await t3Adapter.create({
      git: true,
      packageManager: 'npm',
      projectName: 'demo-t3-git',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        'create-t3-app@latest',
        'demo-t3-git',
        '--noGit',
      ]),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('t3 failed'));

    await expect(
      t3Adapter.create({
        directory: 'apps/demo-t3-fail',
        packageManager: 'npm',
        projectName: 'demo-t3-fail',
      })
    ).rejects.toThrow('t3 failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
