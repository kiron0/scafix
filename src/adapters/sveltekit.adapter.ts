import { join } from 'path';
import { promptSvelteKitCustomizations } from '../prompts/customizations.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { detectYarnFlavor, getDlxCommand } from '../utils/package-manager.js';
import { validateDirectory, validateProjectName } from '../utils/validate.js';
import {
  cleanupFailedScaffold,
  createMissingParentDirectories,
  reconcileGeneratedPackageJsonName,
} from './shared/scaffold.js';

export const sveltekitAdapter: StackAdapter = {
  id: 'sveltekit',
  name: 'SvelteKit',
  description: 'Scaffold a SvelteKit project via the official sv CLI',
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

    logger.info(`Launching SvelteKit's official CLI for: ${projectName}`);
    logger.info('');

    const customizations = await promptSvelteKitCustomizations({
      yes: options.yes,
    });
    const yarnFlavor = packageManager === 'yarn' ? detectYarnFlavor() : undefined;
    const addArgs =
      customizations.template === 'minimal' ? ['--no-add-ons'] : ['--add', 'prettier', 'eslint'];
    const dlx = getDlxCommand(
      packageManager,
      'sv',
      [
        'create',
        directory,
        '--template',
        customizations.template,
        '--types',
        customizations.types,
        '--install',
        packageManager,
        ...addArgs,
      ],
      { yarnFlavor }
    );

    const projectPath = join(process.cwd(), directory);
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(dlx.cmd, dlx.args, { cwd: process.cwd(), stdio: 'inherit' });
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
