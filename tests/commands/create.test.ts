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

describe('createCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('aborts when the directory prompt is cancelled', async () => {
    mocks.promptDirectory.mockRejectedValue(new CliExitError(130));

    await expect(
      createCommand('vite', {
        name: 'demo-app',
      })
    ).rejects.toMatchObject({ exitCode: 130 });

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
});
