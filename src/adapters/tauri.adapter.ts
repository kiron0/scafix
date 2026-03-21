import { join } from 'path';
import { promptTauriCustomizations } from '../prompts/customizations.js';
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
import {
  assertSupportedStackOverrides,
  resolveChoiceOverride,
  shouldAcceptPromptDefaults,
} from './shared/prompting.js';

function resolveTauriTemplateOverride(
  value: unknown
): Awaited<ReturnType<typeof promptTauriCustomizations>>['template'] | undefined {
  return resolveChoiceOverride(value, 'template', [
    'vanilla',
    'vanilla-ts',
    'react',
    'react-ts',
    'vue',
    'vue-ts',
    'svelte',
    'svelte-ts',
  ]);
}

export const tauriAdapter: StackAdapter = {
  id: 'tauri',
  name: 'Tauri',
  description: 'Scaffold a Tauri desktop app via the official create-tauri-app CLI',
  category: 'desktop',

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

    assertSupportedStackOverrides('tauri', options);

    logger.info(`Launching Tauri's official CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptTauriCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = {
      ...promptedCustomizations,
      template: resolveTauriTemplateOverride(options.template) ?? promptedCustomizations.template,
    };
    const managerFlag =
      packageManager === 'bun'
        ? ['--manager', 'bun']
        : packageManager === 'pnpm'
          ? ['--manager', 'pnpm']
          : packageManager === 'yarn'
            ? ['--manager', 'yarn']
            : ['--manager', 'npm'];

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npm',
        args: [
          'create',
          'tauri-app@latest',
          directory,
          '--',
          '--template',
          customizations.template,
          ...managerFlag,
          '--yes',
        ],
      },
      pnpm: {
        cmd: 'pnpm',
        args: [
          'create',
          'tauri-app@latest',
          directory,
          '--template',
          customizations.template,
          ...managerFlag,
          '--yes',
        ],
      },
      yarn: {
        cmd: 'yarn',
        args: [
          'create',
          'tauri-app',
          directory,
          '--template',
          customizations.template,
          ...managerFlag,
          '--yes',
        ],
      },
      bun: {
        cmd: 'bun',
        args: [
          'create',
          'tauri-app@latest',
          directory,
          '--template',
          customizations.template,
          ...managerFlag,
          '--yes',
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
      await installProjectDependencies(projectPath, packageManager);
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
