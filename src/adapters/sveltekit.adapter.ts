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
import {
  assertSupportedStackOverrides,
  resolveChoiceOverride,
  shouldAcceptPromptDefaults,
} from './shared/prompting.js';

function resolveBooleanOverride(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function resolveSvelteKitTemplateOverride(
  value: unknown
): Awaited<ReturnType<typeof promptSvelteKitCustomizations>>['template'] | undefined {
  return resolveChoiceOverride(value, 'template', ['minimal', 'demo', 'library']);
}

function resolveSvelteKitTypesOverride(
  value: unknown
): Awaited<ReturnType<typeof promptSvelteKitCustomizations>>['types'] | undefined {
  return resolveChoiceOverride(value, 'types', ['ts', 'jsdoc']);
}

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

    assertSupportedStackOverrides('sveltekit', options);

    logger.info(`Launching SvelteKit's official CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptSvelteKitCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = {
      ...promptedCustomizations,
      template:
        resolveSvelteKitTemplateOverride(options.template) ?? promptedCustomizations.template,
      types:
        resolveSvelteKitTypesOverride(options.types) ??
        (resolveBooleanOverride(options.typescript) === undefined
          ? promptedCustomizations.types
          : resolveBooleanOverride(options.typescript)
            ? 'ts'
            : 'jsdoc'),
    };
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
