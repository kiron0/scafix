import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CliExitError } from '../../src/utils/cli-error.js';

const mocks = vi.hoisted(() => ({
  initCommand: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  note: vi.fn(),
  intro: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  intro: mocks.intro,
  note: mocks.note,
}));

vi.mock('../../src/commands/init.js', () => ({
  initCommand: mocks.initCommand,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

import { rootCommand } from '../../src/commands/root.js';

describe('rootCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-interactive root usage without an explicit stack', async () => {
    await expect(rootCommand({ yes: true })).rejects.toBeInstanceOf(CliExitError);
    expect(mocks.initCommand).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Non-interactive usage requires an explicit stack: use `scafix create <stack> --yes`.'
    );
  });
});
