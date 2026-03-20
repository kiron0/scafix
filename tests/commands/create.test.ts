import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CliExitError } from '../../src/utils/cli-error.js';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  detectPackageManagerFromCwd: vi.fn(),
  exec: vi.fn(),
  getDefaultDirectoryName: vi.fn(),
  getAdapterById: vi.fn(),
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
  stripGeneratedGitDirectory: vi.fn(),
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
  getAdapterById: mocks.getAdapterById,
}));

vi.mock('../../src/prompts/select-stack.js', () => ({
  promptDirectory: mocks.promptDirectory,
  promptGit: mocks.promptGit,
  promptPackageManager: mocks.promptPackageManager,
  promptProjectName: mocks.promptProjectName,
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: mocks.exec,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/utils/git.js', () => ({
  stripGeneratedGitDirectory: mocks.stripGeneratedGitDirectory,
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

import { createCommand } from '../../src/commands/create.js';

function setStdinTty(value: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value,
  });
}

describe('createCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStdinTty(true);
    mocks.getAdapterById.mockReturnValue({
      id: 'vite',
      name: 'Vite',
      description: 'test adapter',
      create: mocks.create,
    });
    mocks.detectPackageManagerFromCwd.mockReturnValue(null);
    mocks.promptDirectory.mockResolvedValue('demo-app');
    mocks.promptGit.mockResolvedValue(false);
    mocks.promptPackageManager.mockResolvedValue('npm');
    mocks.promptProjectName.mockResolvedValue('demo-app');
    mocks.stripGeneratedGitDirectory.mockResolvedValue(undefined);
    mocks.getDefaultDirectoryName.mockImplementation((name: string) => name);
    mocks.validateDirectory.mockReturnValue({
      exists: false,
      path: '/tmp/demo-app',
      valid: true,
    });
    mocks.validateNpmPackageName.mockReturnValue(true);
    mocks.validateProjectName.mockReturnValue(true);
  });

  it('respects an explicit directory without prompting again', async () => {
    await createCommand('vite', {
      directory: 'custom-dir',
      name: 'demo-app',
    });

    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'custom-dir',
        projectName: 'demo-app',
      })
    );
  });

  it('does not let a blank directory override the derived project directory', async () => {
    await createCommand('vite', {
      directory: '   ',
      name: 'demo-app',
      yes: true,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'demo-app',
        projectName: 'demo-app',
      })
    );
  });

  it('defaults git initialization to true in --yes mode', async () => {
    await createCommand('vite', {
      name: 'demo-app',
      yes: true,
    });

    expect(mocks.promptGit).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        git: true,
      })
    );
    expect(mocks.stripGeneratedGitDirectory).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]demo-app$/)
    );
    expect(mocks.exec).toHaveBeenCalledWith('git', ['init'], {
      cwd: expect.stringMatching(/[\\/]demo-app$/),
      stdio: 'pipe',
    });
  });

  it('allows --no-git to override the --yes git default', async () => {
    await createCommand('vite', {
      git: false,
      name: 'demo-app',
      yes: true,
    });

    expect(mocks.promptGit).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        git: false,
      })
    );
    expect(mocks.stripGeneratedGitDirectory).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]demo-app$/)
    );
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it('aborts when the directory prompt is cancelled', async () => {
    mocks.promptDirectory.mockRejectedValue(new CliExitError(130));

    await expect(
      createCommand('vite', {
        name: 'demo-app',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns early when the project-name prompt is cancelled', async () => {
    mocks.promptProjectName.mockResolvedValue(null);

    await createCommand('vite', {});

    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('uses detected package manager without prompting when available', async () => {
    mocks.detectPackageManagerFromCwd.mockReturnValue('pnpm');

    await createCommand('vite', {
      name: 'demo-app',
    });

    expect(mocks.promptPackageManager).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        packageManager: 'pnpm',
      })
    );
  });

  it('aborts when the package-manager prompt is cancelled', async () => {
    mocks.promptPackageManager.mockRejectedValue(new CliExitError(130));

    await expect(
      createCommand('vite', {
        name: 'demo-app',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('aborts when the git prompt is cancelled', async () => {
    mocks.promptGit.mockRejectedValue(new CliExitError(130));

    await expect(
      createCommand('vite', {
        name: 'demo-app',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('fails fast when interactive prompts would be needed without a TTY', async () => {
    setStdinTty(false);

    await expect(createCommand('vite', {})).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.promptProjectName).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Interactive prompts require a TTY. Re-run in a terminal or provide the required options explicitly.'
    );
  });

  it('allows fully explicit create usage without a TTY', async () => {
    setStdinTty(false);

    await createCommand('vite', {
      directory: 'demo-app',
      git: false,
      name: 'demo-app',
      packageManager: 'npm',
    });

    expect(mocks.promptProjectName).not.toHaveBeenCalled();
    expect(mocks.promptDirectory).not.toHaveBeenCalled();
    expect(mocks.promptPackageManager).not.toHaveBeenCalled();
    expect(mocks.promptGit).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'demo-app',
        git: false,
        packageManager: 'npm',
        projectName: 'demo-app',
      })
    );
  });

  it('rejects unsupported package managers before adapter execution', async () => {
    await expect(
      createCommand('vite', {
        name: 'demo-app',
        packageManager: 'pip',
        yes: true,
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.create).not.toHaveBeenCalled();
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
      createCommand('vite', {
        directory: 'CON.txt',
        name: 'demo-app',
        yes: true,
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Directory path segment is a reserved Windows name'
    );
  });

  it('rejects absolute explicit directories before adapter execution', async () => {
    mocks.validateDirectory.mockReturnValue({
      exists: false,
      path: '/tmp/demo-app',
      reason: 'Directory must be a relative path inside the current working directory',
      valid: false,
    });

    await expect(
      createCommand('vite', {
        directory: '/tmp/demo-app',
        name: 'demo-app',
        yes: true,
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Directory must be a relative path inside the current working directory'
    );
  });

  it('uses npm package validation and derives a safe directory for scoped packages', async () => {
    mocks.getAdapterById.mockReturnValue({
      id: 'npm',
      name: 'NPM Package',
      description: 'test adapter',
      create: mocks.create,
    });
    mocks.getDefaultDirectoryName.mockReturnValue('demo-pkg');

    await createCommand('npm', {
      name: '@scope/demo-pkg',
      yes: true,
    });

    expect(mocks.validateNpmPackageName).toHaveBeenCalledWith('@scope/demo-pkg');
    expect(mocks.validateProjectName).not.toHaveBeenCalledWith('@scope/demo-pkg');
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'demo-pkg',
        projectName: '@scope/demo-pkg',
      })
    );
  });

  it('uses npm-safe validation for express project names', async () => {
    mocks.getAdapterById.mockReturnValue({
      id: 'express',
      name: 'Express',
      description: 'test adapter',
      create: mocks.create,
    });
    mocks.validateNpmPackageName.mockReturnValue(false);

    await expect(
      createCommand('express', {
        name: 'My Express App',
        yes: true,
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.validateNpmPackageName).toHaveBeenCalledWith('My Express App');
    expect(mocks.validateProjectName).not.toHaveBeenCalledWith('My Express App');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('surfaces unexpected project-name prompt failures instead of treating them as cancellations', async () => {
    mocks.promptProjectName.mockRejectedValue(new Error('prompt renderer crashed'));

    await expect(createCommand('vite', {})).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith('Error: prompt renderer crashed');
  });

  it('rejects non-npm project names with leading whitespace before adapter execution', async () => {
    mocks.validateProjectName.mockReturnValue(false);

    await expect(
      createCommand('vite', {
        name: ' demo-app',
        yes: true,
      })
    ).rejects.toBeInstanceOf(CliExitError);

    expect(mocks.validateProjectName).toHaveBeenCalledWith(' demo-app');
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
