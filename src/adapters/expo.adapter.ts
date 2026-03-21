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
import {
  assertSupportedStackOverrides,
  resolveChoiceOverride,
  shouldAcceptPromptDefaults,
} from './shared/prompting.js';

function resolveExpoTemplateOverride(
  value: unknown
): Awaited<ReturnType<typeof promptExpoCustomizations>>['template'] | undefined {
  return resolveChoiceOverride(value, 'template', [
    'default@sdk-55',
    'blank',
    'tabs',
    'bare-minimum',
  ]);
}

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

    assertSupportedStackOverrides('expo', options);

    logger.info(`Launching Expo's official CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptExpoCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = {
      ...promptedCustomizations,
      template: resolveExpoTemplateOverride(options.template) ?? promptedCustomizations.template,
    };
    const templateArgs = ['--template', customizations.template];
    const yesArgs = ['--yes'];

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npx',
        args: ['--yes', 'create-expo-app@latest', directory, ...templateArgs, ...yesArgs],
      },
      pnpm: {
        cmd: 'pnpm',
        args: ['create', 'expo-app@latest', directory, ...templateArgs, ...yesArgs],
      },
      yarn: {
        cmd: 'yarn',
        args: ['create', 'expo-app', directory, ...templateArgs, ...yesArgs],
      },
      bun: {
        cmd: 'bun',
        args: ['create', 'expo-app@latest', directory, ...templateArgs, ...yesArgs],
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
