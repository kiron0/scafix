import { join } from 'path';
import { promptExpoCustomizations } from '../prompts/customizations.js';
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

export const expoAdapter: StackAdapter = {
  id: 'expo',
  name: 'Expo',
  description: 'Scaffold an Expo (React Native) project via the official create-expo-app CLI',
  category: 'mobile',

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

    logger.info(`Launching Expo's official CLI for: ${projectName}`);
    logger.info('');

    const customizations = await promptExpoCustomizations({
      yes: options.yes,
    });
    const templateArgs =
      customizations.template !== 'default' ? ['--template', customizations.template] : [];

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npx',
        args: ['--yes', 'create-expo-app@latest', directory, ...templateArgs],
      },
      pnpm: {
        cmd: 'pnpm',
        args: ['create', 'expo-app@latest', directory, ...templateArgs],
      },
      yarn: {
        cmd: 'yarn',
        args: ['create', 'expo-app', directory, ...templateArgs],
      },
      bun: {
        cmd: 'bun',
        args: ['create', 'expo-app@latest', directory, ...templateArgs],
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
