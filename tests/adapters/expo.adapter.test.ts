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
  promptExpoCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptExpoCustomizations: mocks.promptExpoCustomizations,
}));

import { expoAdapter } from '../../src/adapters/expo.adapter.js';

describe.sequential('expoAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptExpoCustomizations.mockResolvedValue({ template: 'default' });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-expo-adapter-'));
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

  it('calls create-expo-app via npx for npm', async () => {
    await expoAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-expo-npm',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      ['--yes', 'create-expo-app@latest', 'demo-expo-npm'],
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('reconciles package.json name when directory differs', async () => {
    await expoAdapter.create({
      directory: 'apps/my-app',
      packageManager: 'npm',
      projectName: 'My App',
      yes: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(tempDir, 'apps', 'my-app', 'package.json'), 'utf8')
    ) as { name: string };
    expect(packageJson.name).toBe('my-app');
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('expo failed'));

    await expect(
      expoAdapter.create({
        directory: 'apps/demo-expo-failed',
        packageManager: 'npm',
        projectName: 'demo-expo-failed',
      })
    ).rejects.toThrow('expo failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
