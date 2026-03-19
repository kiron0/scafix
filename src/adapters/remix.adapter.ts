import { join } from 'path';
import { promptRemixCustomizations } from '../prompts/customizations.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { validateDirectory, validateProjectName } from '../utils/validate.js';
import {
  cleanupFailedScaffold,
  createMissingParentDirectories,
  reconcileGeneratedPackageJsonName,
} from './shared/scaffold.js';

export const remixAdapter: StackAdapter = {
  id: 'remix',
  name: 'Remix',
  description: 'Scaffold a Remix project via the official create-remix CLI',
  category: 'fullstack',

  async create(options: CreateOptions): Promise<void> {
    const { projectName, directory = projectName, packageManager = 'npm' } = options;

    if (!validateProjectName(projectName)) {
      throw new Error('Invalid project name');
    }

    const dirInfo = validateDirectory(directory);
    if (!dirInfo.valid) {
      throw new Error(dirInfo.reason ?? `Invalid directory: ${directory}`);
    }
    if (dirInfo.exists) {
      logger.warn(`The directory "${directory}" already exists.`);
      logger.info(`Please choose a different project name or remove the existing directory.`);
      throw new CliExitError(1);
    }

    logger.info(`Launching Remix's official CLI for: ${projectName}`);
    logger.info('');

    const customizations = await promptRemixCustomizations({
      yes: options.yes,
    });
    const yesFlag = options.yes ? ['--yes'] : [];
    const templateArgs =
      customizations.template !== 'remix' ? ['--template', customizations.template] : [];

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npx',
        args: [
          '--yes',
          'create-remix@latest',
          directory,
          '--no-git-init',
          '--no-install',
          '--package-manager',
          packageManager,
          ...templateArgs,
          ...yesFlag,
        ],
      },
      pnpm: {
        cmd: 'pnpm',
        args: [
          'create',
          'remix@latest',
          directory,
          '--no-git-init',
          '--no-install',
          '--package-manager',
          packageManager,
          ...templateArgs,
          ...yesFlag,
        ],
      },
      yarn: {
        cmd: 'yarn',
        args: [
          'create',
          'remix',
          directory,
          '--no-git-init',
          '--no-install',
          '--package-manager',
          packageManager,
          ...templateArgs,
          ...yesFlag,
        ],
      },
      bun: {
        cmd: 'bun',
        args: [
          'create',
          'remix@latest',
          directory,
          '--no-git-init',
          '--no-install',
          '--package-manager',
          packageManager,
          ...templateArgs,
          ...yesFlag,
        ],
      },
    };

    const projectPath = join(process.cwd(), directory);
    const { cmd, args } = pmCommands[packageManager] ?? pmCommands.npm;
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(cmd, args, { cwd: process.cwd(), stdio: 'inherit' });
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
