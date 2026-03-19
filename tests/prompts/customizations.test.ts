import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CliExitError } from '../../src/utils/cli-error.js';
import { APP_CONFIG } from '../../src/config/index.js';

const promptCancelled = Symbol('prompt-cancelled');

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  confirm: vi.fn(),
  logger: {
    debug: vi.fn(),
  },
  select: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  cancel: mocks.cancel,
  confirm: mocks.confirm,
  select: mocks.select,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

import {
  promptAngularCustomizations,
  promptAstroCustomizations,
  promptExpressCustomizations,
  promptHonoCustomizations,
  promptNestCustomizations,
  promptNextCustomizations,
  promptNuxtCustomizations,
  promptNpmPackageCustomizations,
  promptSvelteKitCustomizations,
  promptViteReactCustomizations,
} from '../../src/prompts/customizations.js';

describe('promptViteReactCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only supported defaults in --yes mode', async () => {
    const result = await promptViteReactCustomizations({ yes: true });
    expect(result.framework).toBe('react');
    expect(result.typescript).toBe(true);
    expect(result.tailwind).toBe(false);
    expect(result.shadcn).toBe(false);
    expect(result.prettier).toBe(false);
    expect('eslint' in result).toBe(false);
    expect('shadcnOptions' in result).toBe(false);
  });

  it('aborts cleanly when the prompt flow is cancelled', async () => {
    mocks.select.mockResolvedValue(promptCancelled);

    const result = promptViteReactCustomizations();

    await expect(result).rejects.toMatchObject({
      exitCode: 130,
    });
    await expect(result).rejects.toBeInstanceOf(CliExitError);
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
    expect(mocks.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Prompt cancelled'));
  });
});

describe('promptAngularCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptAngularCustomizations({ yes: true });
    expect(result.style).toBe('css');
    expect(result.ssr).toBe(false);
    expect(result.routing).toBe(true);
    expect(result.zard).toBe(false);
  });
});

describe('promptNextCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only supported defaults in --yes mode', async () => {
    const result = await promptNextCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.tailwind).toBe(true);
    expect(result.shadcn).toBe(false);
    expect(result.eslint).toBe(true);
    expect(result.prettier).toBe(false);
    expect(result.appRouter).toBe(true);
    expect(result.srcDir).toBe(true);
    expect('tailwindVersion' in result).toBe(false);
    expect('shadcnOptions' in result).toBe(false);
  });

  it('aborts cleanly when a later confirmation is cancelled', async () => {
    mocks.select.mockResolvedValueOnce(true);
    mocks.confirm
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(promptCancelled);

    const result = promptNextCustomizations();

    await expect(result).rejects.toMatchObject({
      exitCode: 130,
    });
    await expect(result).rejects.toBeInstanceOf(CliExitError);
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });
});

describe('promptAstroCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptAstroCustomizations({ yes: true });
    expect(result.template).toBe('minimal');
  });

  it('aborts cleanly when the template selection is cancelled', async () => {
    mocks.select.mockResolvedValue(promptCancelled);

    const result = promptAstroCustomizations();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
  });
});

describe('promptSvelteKitCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptSvelteKitCustomizations({ yes: true });
    expect(result.template).toBe('minimal');
    expect(result.types).toBe('ts');
  });

  it('aborts cleanly when the type selection is cancelled', async () => {
    mocks.select.mockResolvedValueOnce('minimal').mockResolvedValueOnce(promptCancelled);

    const result = promptSvelteKitCustomizations();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
  });
});

describe('promptNuxtCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptNuxtCustomizations({ yes: true });
    expect(result.template).toBe('minimal');
  });

  it('aborts cleanly when the template selection is cancelled', async () => {
    mocks.select.mockResolvedValue(promptCancelled);

    const result = promptNuxtCustomizations();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
  });
});

describe('promptNestCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptNestCustomizations({ yes: true });
    expect(result.language).toBe('ts');
    expect(result.strict).toBe(true);
  });

  it('aborts cleanly when strict mode confirmation is cancelled', async () => {
    mocks.select.mockResolvedValueOnce('ts');
    mocks.confirm.mockResolvedValueOnce(promptCancelled);

    const result = promptNestCustomizations();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
  });
});

describe('promptHonoCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptHonoCustomizations({ yes: true });
    expect(result.template).toBe('nodejs');
  });

  it('aborts cleanly when the runtime selection is cancelled', async () => {
    mocks.select.mockResolvedValue(promptCancelled);

    const result = promptHonoCustomizations();

    await expect(result).rejects.toBeInstanceOf(CliExitError);
    await expect(result).rejects.toMatchObject({ exitCode: 130 });
  });
});

describe('promptExpressCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptExpressCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.pattern).toBe('mvc');
    expect(result.eslint).toBe(true);
    expect(result.prettier).toBe(false);
    expect(result.cors).toBe(false);
    expect(result.helmet).toBe(false);
    expect(result.dotenv).toBe(true);
  });

  it('aborts cleanly when the architecture selection is cancelled', async () => {
    mocks.select.mockResolvedValueOnce(true).mockResolvedValueOnce(promptCancelled);

    const result = promptExpressCustomizations();

    await expect(result).rejects.toMatchObject({
      exitCode: 130,
    });
    await expect(result).rejects.toBeInstanceOf(CliExitError);
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });
});

describe('promptNpmPackageCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptNpmPackageCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.buildTool).toBe('tsup');
    expect(result.eslint).toBe(true);
    expect(result.prettier).toBe(false);
    expect(result.testFramework).toBe('none');
  });

  it('aborts cleanly when the build tool selection is cancelled', async () => {
    mocks.select.mockResolvedValueOnce(true).mockResolvedValueOnce(promptCancelled);

    const result = promptNpmPackageCustomizations();

    await expect(result).rejects.toMatchObject({
      exitCode: 130,
    });
    await expect(result).rejects.toBeInstanceOf(CliExitError);
    expect(mocks.cancel).toHaveBeenCalledWith(expect.stringContaining(APP_CONFIG.thankYouMessage));
  });
});
