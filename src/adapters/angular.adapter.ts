import { join } from 'path';
import { promptAngularCustomizations } from '../prompts/customizations.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { validateDirectory, validateProjectName } from '../utils/validate.js';
import {
  cleanupFailedScaffold,
  createMissingParentDirectories,
  installProjectDependencies,
  reconcileGeneratedPackageJsonName,
} from './shared/scaffold.js';

export const angularAdapter: StackAdapter = {
  id: 'angular',
  name: 'Angular',
  description: 'Scaffold an Angular project via the official @angular/cli',
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

    logger.info(`Launching Angular CLI for: ${projectName}`);
    logger.info('');

    const customizations = await promptAngularCustomizations({
      yes: options.yes,
    });
    const styleFlag = ['--style', customizations.style];
    const ssrFlag = customizations.ssr ? ['--ssr'] : ['--no-ssr'];
    const scaffoldPm = packageManager === 'bun' ? 'npm' : packageManager;
    const projectPath = join(process.cwd(), directory);
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(
        'npx',
        [
          '--yes',
          '@angular/cli@latest',
          'new',
          directory,
          '--skip-git',
          '--skip-install',
          '--package-manager',
          scaffoldPm,
          ...styleFlag,
          ...ssrFlag,
          ...(customizations.routing ? ['--routing'] : ['--no-routing']),
        ],
        { cwd: process.cwd(), stdio: 'inherit' }
      );
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);
      await installProjectDependencies(projectPath, packageManager);
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
