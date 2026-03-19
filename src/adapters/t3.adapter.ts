import { join } from 'path';
import { promptT3Customizations } from '../prompts/customizations.js';
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

export const t3Adapter: StackAdapter = {
  id: 't3',
  name: 'T3 Stack',
  description: 'Scaffold a T3 project (Next.js + tRPC + Prisma + Tailwind) via create-t3-app',
  category: 'fullstack',

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

    logger.info(`Launching T3 Stack CLI for: ${projectName}`);
    logger.info('');

    const customizations = await promptT3Customizations({
      yes: options.yes,
    });
    const hasPackage = (pkg: string): boolean => customizations.packages.includes(pkg);
    const projectPath = join(process.cwd(), directory);
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(
        'npx',
        [
          '--yes',
          'create-t3-app@latest',
          directory,
          '--noGit',
          '--noInstall',
          '--CI',
          '--tailwind',
          String(hasPackage('tailwind')),
          '--trpc',
          String(hasPackage('trpc')),
          '--prisma',
          String(hasPackage('prisma')),
          '--nextAuth',
          String(hasPackage('nextAuth')),
          '--appRouter',
          String(customizations.appRouter),
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
