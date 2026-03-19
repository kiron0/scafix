import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../../src/config/index.js';
import { CliExitError } from '../../src/utils/cli-error.js';

const promptCancelled = Symbol('prompt-cancelled');

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  cancel: mocks.cancel,
  confirm: mocks.confirm,
  select: mocks.select,
  text: mocks.text,
}));

import {
  promptDirectory,
  promptGit,
  promptPackageManager,
  promptProjectName,
  selectStack,
} from '../../src/prompts/select-stack.js';

describe('select-stack prompt cancellations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts when the directory prompt is cancelled', async () => {
    mocks.text.mockResolvedValue(promptCancelled);

    const result = promptDirectory('demo-app');

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });

  it('aborts when the package-manager prompt is cancelled', async () => {
    mocks.select.mockResolvedValue(promptCancelled);

    const result = promptPackageManager();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });

  it('aborts when the git prompt is cancelled', async () => {
    mocks.confirm.mockResolvedValue(promptCancelled);

    const result = promptGit();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });

  it('aborts when the stack selection is cancelled', async () => {
    mocks.select.mockResolvedValue(promptCancelled);

    const result = selectStack([
      {
        create: vi.fn(),
        description: 'test adapter',
        id: 'vite',
        name: 'Vite',
        category: 'frontend',
      },
    ]);

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });

  it('aborts when the project-name prompt is cancelled', async () => {
    mocks.text.mockResolvedValue(promptCancelled);

    const result = promptProjectName({ default: 'demo-app' });

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });

  it('rethrows unexpected prompt runtime errors without masking them as cancellations', async () => {
    const promptError = new Error('prompt renderer crashed');
    mocks.select.mockRejectedValue(promptError);

    const result = selectStack([
      {
        create: vi.fn(),
        description: 'test adapter',
        id: 'vite',
        name: 'Vite',
        category: 'frontend',
      },
    ]);

    await expect(result).rejects.toThrow('prompt renderer crashed');
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
