import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CliExitError } from '../../src/utils/cli-error.js';

const mocks = vi.hoisted(() => ({
  adapters: [
    {
      category: 'frontend',
      create: vi.fn(),
      description: 'test adapter',
      id: 'vite',
      name: 'Vite',
    },
  ],
  detectPackageManagerFromCwd: vi.fn(),
  exec: vi.fn(),
  getDefaultDirectoryName: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  promptDirectory: vi.fn(),
  promptGit: vi.fn(),
  promptPackageManager: vi.fn(),
  promptProjectName: vi.fn(),
  selectStack: vi.fn(),
  validateDirectory: vi.fn(),
  validateNpmPackageName: vi.fn(),
  validateProjectName: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../../src/adapters/index.js', () => ({
  adapters: mocks.adapters,
}));

vi.mock('../../src/prompts/select-stack.js', () => ({
  promptDirectory: mocks.promptDirectory,
  promptGit: mocks.promptGit,
  promptPackageManager: mocks.promptPackageManager,
  promptProjectName: mocks.promptProjectName,
  selectStack: mocks.selectStack,
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/utils/package-manager.js', async () => {
  const actual = await vi.importActual('../../src/utils/package-manager.js');
  return {
    ...actual,
    detectPackageManagerFromCwd: mocks.detectPackageManagerFromCwd,
  };
});

vi.mock('../../src/utils/validate.js', () => ({
  getDefaultDirectoryName: mocks.getDefaultDirectoryName,
  validateDirectory: mocks.validateDirectory,
  validateNpmPackageName: mocks.validateNpmPackageName,
  validateProjectName: mocks.validateProjectName,
}));

import { initCommand } from '../../src/commands/init.js';

function setStdinTty(value: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value,
  });
}

describe('initCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStdinTty(true);
    mocks.detectPackageManagerFromCwd.mockReturnValue(null);
    mocks.selectStack.mockResolvedValue(mocks.adapters[0]);
    mocks.promptDirectory.mockResolvedValue('my-project');
    mocks.promptGit.mockResolvedValue(false);
    mocks.promptPackageManager.mockResolvedValue('npm');
    mocks.promptProjectName.mockResolvedValue('my-project');
    mocks.getDefaultDirectoryName.mockImplementation((name: string) => name);
    mocks.validateDirectory.mockReturnValue({
      exists: false,
      path: '/tmp/my-project',
      valid: true,
    });
    mocks.validateNpmPackageName.mockReturnValue(true);
    mocks.validateProjectName.mockReturnValue(true);
  });

  it('rejects stack-less non-interactive usage', async () => {
    await expect(initCommand({ yes: true })).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.selectStack).not.toHaveBeenCalled();
    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Non-interactive usage requires an explicit stack: use `scafix create <stack> --yes`.'
    );
  });

  it('fails fast when interactive init usage runs without a TTY', async () => {
    setStdinTty(false);

    await expect(initCommand({})).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.selectStack).not.toHaveBeenCalled();
    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Interactive init usage requires a TTY. Re-run in a terminal or use `scafix create <stack> --yes`.'
    );
  });

  it('honors explicit project metadata without prompting over it', async () => {
    await initCommand({
      directory: 'custom-dir',
      name: 'custom-name',
      packageManager: 'pnpm',
    });

    expect(mocks.promptProjectName).not.toHaveBeenCalled();
    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.selectStack).toHaveBeenCalledWith(mocks.adapters);
    expect(mocks.adapters[0].create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'custom-dir',
        packageManager: 'pnpm',
        projectName: 'custom-name',
      })
    );
  });

  it('returns early when the project-name prompt is cancelled', async () => {
    mocks.promptProjectName.mockResolvedValue(null);

    await initCommand({});

    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
  });

  it('aborts when the directory prompt is cancelled', async () => {
    mocks.promptDirectory.mockRejectedValue(new CliExitError(130));

    await expect(
      initCommand({
        name: 'my-project',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
  });

  it('uses a detected package manager without prompting', async () => {
    mocks.detectPackageManagerFromCwd.mockReturnValue('bun');

    await initCommand({});

    expect(mocks.promptPackageManager).not.toHaveBeenCalled();
    expect(mocks.adapters[0].create).toHaveBeenCalledWith(
      expect.objectContaining({
        packageManager: 'bun',
      })
    );
  });

  it('aborts when the package-manager prompt is cancelled', async () => {
    mocks.promptPackageManager.mockRejectedValue(new CliExitError(130));

    await expect(
      initCommand({
        name: 'my-project',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
  });

  it('aborts when the git prompt is cancelled', async () => {
    mocks.promptGit.mockRejectedValue(new CliExitError(130));

    await expect(
      initCommand({
        name: 'my-project',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
  });

  it('rejects unsupported package manager input before adapter execution', async () => {
    await expect(
      initCommand({
        packageManager: 'pip',
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith('Unsupported package manager: pip');
  });

  it('rejects invalid explicit directories before adapter execution', async () => {
    mocks.validateDirectory.mockReturnValue({
      exists: false,
      path: '/tmp/CON.txt',
      reason: 'Directory path segment is a reserved Windows name',
      valid: false,
    });

    await expect(
      initCommand({
        directory: 'CON.txt',
        name: 'custom-name',
        packageManager: 'pnpm',
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Directory path segment is a reserved Windows name'
    );
  });

  it('rejects absolute explicit directories before adapter execution', async () => {
    mocks.validateDirectory.mockReturnValue({
      exists: false,
      path: '/tmp/custom-name',
      reason: 'Directory must be a relative path inside the current working directory',
      valid: false,
    });

    await expect(
      initCommand({
        directory: '/tmp/custom-name',
        name: 'custom-name',
        packageManager: 'pnpm',
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Directory must be a relative path inside the current working directory'
    );
  });

  it('rejects existing directories before adapter execution', async () => {
    mocks.validateDirectory.mockReturnValue({
      exists: true,
      path: '/tmp/custom-name',
      valid: true,
    });

    await expect(
      initCommand({
        directory: 'custom-name',
        name: 'custom-name',
        packageManager: 'pnpm',
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalledWith('The directory "custom-name" already exists.');
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'Please choose a different project name or remove the existing directory.'
    );
  });

  it('uses npm package validation and a safe default directory for scoped packages', async () => {
    const npmAdapter = {
      category: 'library',
      create: vi.fn(),
      description: 'test adapter',
      id: 'npm',
      name: 'NPM Package',
    };
    mocks.selectStack.mockResolvedValue(npmAdapter);
    mocks.getDefaultDirectoryName.mockReturnValue('demo-pkg');
    mocks.promptDirectory.mockResolvedValue('demo-pkg');

    await initCommand({
      name: '@scope/demo-pkg',
    });

    expect(mocks.validateNpmPackageName).toHaveBeenCalledWith('@scope/demo-pkg');
    expect(npmAdapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'demo-pkg',
        projectName: '@scope/demo-pkg',
      })
    );
  });

  it('uses npm-safe validation for express project names', async () => {
    const expressAdapter = {
      category: 'backend',
      create: vi.fn(),
      description: 'test adapter',
      id: 'express',
      name: 'Express',
    };
    mocks.selectStack.mockResolvedValue(expressAdapter);
    mocks.validateNpmPackageName.mockReturnValue(false);

    await expect(
      initCommand({
        name: 'My Express App',
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.validateNpmPackageName).toHaveBeenCalledWith('My Express App');
    expect(mocks.validateProjectName).not.toHaveBeenCalledWith('My Express App');
    expect(expressAdapter.create).not.toHaveBeenCalled();
  });

  it('surfaces unexpected stack-selection prompt failures instead of treating them as cancellations', async () => {
    mocks.selectStack.mockRejectedValue(new Error('prompt renderer crashed'));

    await expect(initCommand({})).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith('Error: prompt renderer crashed');
  });

  it('rejects non-npm project names with leading whitespace before adapter execution', async () => {
    mocks.validateProjectName.mockReturnValue(false);

    await expect(
      initCommand({
        name: ' my-project',
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.validateProjectName).toHaveBeenCalledWith(' my-project');
    expect(mocks.adapters[0].create).not.toHaveBeenCalled();
  });
});
