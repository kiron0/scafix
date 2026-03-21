import { join } from 'path';
import { promptNuxtCustomizations } from '../prompts/customizations.js';
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

function resolveNuxtTemplateOverride(
  value: unknown
): Awaited<ReturnType<typeof promptNuxtCustomizations>>['template'] | undefined {
  return resolveChoiceOverride(value, 'template', ['minimal', 'content', 'ui']);
}

export const nuxtAdapter: StackAdapter = {
  id: 'nuxt',
  name: 'Nuxt',
  description: 'Scaffold a Nuxt project via the official create nuxt CLI',
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

    assertSupportedStackOverrides('nuxt', options);

    logger.info(`Launching Nuxt's official CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptNuxtCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = {
      ...promptedCustomizations,
      template: resolveNuxtTemplateOverride(options.template) ?? promptedCustomizations.template,
    };
    const commonArgs = [
      '--template',
      customizations.template,
      '--packageManager',
      packageManager,
      '--no-modules',
      '--no-gitInit',
    ];
    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npm',
        args: ['create', 'nuxt@latest', directory, '--', ...commonArgs],
      },
      pnpm: {
        cmd: 'pnpm',
        args: ['create', 'nuxt@latest', directory, ...commonArgs],
      },
      yarn: {
        cmd: 'yarn',
        args: ['create', 'nuxt', directory, ...commonArgs],
      },
      bun: {
        cmd: 'bun',
        args: ['create', 'nuxt@latest', directory, ...commonArgs],
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
