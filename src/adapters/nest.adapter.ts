import { join } from 'path';
import { promptNestCustomizations } from '../prompts/customizations.js';
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
import { assertSupportedOverrides, shouldAcceptPromptDefaults } from './shared/prompting.js';

function resolveBooleanOverride(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export const nestAdapter: StackAdapter = {
  id: 'nest',
  name: 'NestJS',
  description: 'Scaffold a NestJS API via the official Nest CLI',
  category: 'backend',

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

    assertSupportedOverrides(options, ['typescript', 'strict']);

    logger.info(`Launching NestJS's official CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptNestCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = {
      ...promptedCustomizations,
      language:
        resolveBooleanOverride(options.typescript) === undefined
          ? promptedCustomizations.language
          : resolveBooleanOverride(options.typescript)
            ? 'ts'
            : 'js',
      strict: resolveBooleanOverride(options.strict) ?? promptedCustomizations.strict,
    };
    const scaffoldPackageManager = packageManager === 'bun' ? 'npm' : packageManager;
    const projectPath = join(process.cwd(), directory);
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(
        'npx',
        [
          '--yes',
          '@nestjs/cli@latest',
          'new',
          directory,
          '--language',
          customizations.language === 'ts' ? 'TypeScript' : 'JavaScript',
          '--skip-git',
          '--skip-install',
          ...(customizations.strict ? ['--strict'] : []),
          '--package-manager',
          scaffoldPackageManager,
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
