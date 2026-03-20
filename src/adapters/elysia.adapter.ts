import { join } from 'path';
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
import { assertSupportedOverrides } from './shared/prompting.js';

export const elysiaAdapter: StackAdapter = {
  id: 'elysia',
  name: 'Elysia',
  description: 'Scaffold an Elysia (Bun) backend via the official create-elysia CLI',
  category: 'backend',

  async create(options: CreateOptions): Promise<void> {
    const { projectName, directory = projectName } = options;

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

    assertSupportedOverrides(options, []);

    logger.info(`Launching Elysia's official CLI for: ${projectName}`);
    if (options.packageManager && options.packageManager !== 'bun') {
      logger.warn('Elysia is Bun-native; using bun as the package manager.');
    }
    logger.info('');

    const projectPath = join(process.cwd(), directory);
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec('bun', ['create', 'elysia', directory], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
