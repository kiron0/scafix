import { join } from 'path';
import { promptHonoCustomizations } from '../prompts/customizations.js';
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

function resolveHonoTemplateOverride(
  value: unknown
): Awaited<ReturnType<typeof promptHonoCustomizations>>['template'] | undefined {
  return value === 'nodejs' || value === 'bun' || value === 'cloudflare-workers' || value === 'vercel'
    ? value
    : undefined;
}

export const honoAdapter: StackAdapter = {
  id: 'hono',
  name: 'Hono',
  description: 'Scaffold a Hono API via the official create-hono CLI',
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

    logger.info(`Launching Hono's official CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptHonoCustomizations({
      yes: options.yes,
    });
    const customizations = {
      ...promptedCustomizations,
      template: resolveHonoTemplateOverride(options.template) ?? promptedCustomizations.template,
    };
    const commonArgs = ['--template', customizations.template, '--install', '--pm', packageManager];
    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npm',
        args: ['create', 'hono@latest', directory, '--', ...commonArgs],
      },
      pnpm: {
        cmd: 'pnpm',
        args: ['create', 'hono@latest', directory, ...commonArgs],
      },
      yarn: {
        cmd: 'yarn',
        args: ['create', 'hono', directory, ...commonArgs],
      },
      bun: {
        cmd: 'bun',
        args: ['create', 'hono@latest', directory, ...commonArgs],
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
