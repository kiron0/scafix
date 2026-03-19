import { join } from 'path';
import { promptAstroCustomizations } from '../prompts/customizations.js';
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

export const astroAdapter: StackAdapter = {
  id: 'astro',
  name: 'Astro',
  description: 'Scaffold an Astro project via the official create astro CLI',
  category: 'frontend',

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

    logger.info(`Launching Astro's official CLI for: ${projectName}`);
    logger.info('');

    const customizations = await promptAstroCustomizations({
      yes: options.yes,
    });
    const yesFlag = options.yes ? ['--yes'] : [];

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npm',
        args: [
          'create',
          'astro@latest',
          directory,
          '--',
          '--template',
          customizations.template,
          '--install',
          '--no-git',
          ...yesFlag,
        ],
      },
      pnpm: {
        cmd: 'pnpm',
        args: [
          'create',
          'astro@latest',
          directory,
          '--template',
          customizations.template,
          '--install',
          '--no-git',
          ...yesFlag,
        ],
      },
      yarn: {
        cmd: 'yarn',
        args: [
          'create',
          'astro',
          directory,
          '--template',
          customizations.template,
          '--install',
          '--no-git',
          ...yesFlag,
        ],
      },
      bun: {
        cmd: 'bun',
        args: [
          'create',
          'astro@latest',
          directory,
          '--template',
          customizations.template,
          '--install',
          '--no-git',
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
