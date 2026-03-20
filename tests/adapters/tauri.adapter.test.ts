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
  promptTauriCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptTauriCustomizations: mocks.promptTauriCustomizations,
}));

import { tauriAdapter } from '../../src/adapters/tauri.adapter.js';

describe.sequential('tauriAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptTauriCustomizations.mockResolvedValue({ template: 'react-ts' });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-tauri-adapter-'));
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

  it('calls create-tauri-app via npm create for npm', async () => {
    await tauriAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-tauri',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      expect.arrayContaining(['create', 'tauri-app@latest', 'demo-tauri']),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('removes a scaffold-created git repository during direct adapter usage', async () => {
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const projectName = args[2] as string | undefined;
        if (!projectName || options?.cwd !== tempDir) return;
        const projectPath = join(tempDir, projectName);
        await mkdir(join(projectPath, '.git'), { recursive: true });
        await writeFile(
          join(projectPath, 'package.json'),
          `${JSON.stringify({ name: projectName }, null, 2)}\n`
        );
      }
    );

    await tauriAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-tauri-git',
      yes: true,
    });

    await expect(access(join(tempDir, 'demo-tauri-git', '.git'))).rejects.toThrow();
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('tauri failed'));

    await expect(
      tauriAdapter.create({
        directory: 'apps/demo-tauri-fail',
        packageManager: 'npm',
        projectName: 'demo-tauri-fail',
      })
    ).rejects.toThrow('tauri failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
