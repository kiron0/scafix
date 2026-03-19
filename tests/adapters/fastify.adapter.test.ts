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
  promptFastifyCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptFastifyCustomizations: mocks.promptFastifyCustomizations,
}));

import { fastifyAdapter } from '../../src/adapters/fastify.adapter.js';

describe.sequential('fastifyAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptFastifyCustomizations.mockResolvedValue({ language: 'ts' });
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-fastify-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const generateIdx = args.indexOf('generate');
        const dir = generateIdx >= 0 ? (args[generateIdx + 1] as string) : undefined;
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

  it('calls fastify-cli generate via npx', async () => {
    await fastifyAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-fastify',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      ['--yes', 'fastify-cli', 'generate', 'demo-fastify', '--lang=ts'],
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('fastify failed'));

    await expect(
      fastifyAdapter.create({
        directory: 'services/demo-fastify-fail',
        packageManager: 'npm',
        projectName: 'demo-fastify-fail',
      })
    ).rejects.toThrow('fastify failed');

    await expect(access(join(tempDir, 'services'))).rejects.toThrow();
  });
});
