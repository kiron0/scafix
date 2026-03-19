import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execa: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('execa', () => ({
  execa: mocks.execa,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

import { exec } from '../../src/utils/exec.js';

describe('exec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('lets explicit env values override process env values', async () => {
    vi.stubEnv('SCAFIX_EXEC_TEST', 'from-process');
    mocks.execa.mockResolvedValue(undefined);

    await exec('node', ['--version'], {
      env: {
        ONLY_IN_OPTIONS: 'yes',
        SCAFIX_EXEC_TEST: 'from-options',
      },
    });

    expect(mocks.execa).toHaveBeenCalledWith(
      'node',
      ['--version'],
      expect.objectContaining({
        env: expect.objectContaining({
          ONLY_IN_OPTIONS: 'yes',
          SCAFIX_EXEC_TEST: 'from-options',
        }),
      })
    );
  });

  it('logs and rethrows execution failures', async () => {
    const error = new Error('command failed');
    mocks.execa.mockRejectedValue(error);

    await expect(exec('node', ['broken'])).rejects.toThrow('command failed');
    expect(mocks.logger.error).toHaveBeenCalledWith('Failed to execute node: command failed');
  });
});
