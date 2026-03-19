import { spinner } from '@clack/prompts';
import { join } from 'path';
import { adapters } from '../adapters/index.js';
import {
  promptDirectory,
  promptGit,
  promptPackageManager,
  promptProjectName,
  selectStack,
} from '../prompts/select-stack.js';
import type { CliOptions, CreateOptions } from '../types/stack.js';
import { exec } from '../utils/exec.js';
import { CliExitError, isCliExitError } from '../utils/cli-error.js';
import { logger } from '../utils/logger.js';
import {
  detectPackageManagerFromCwd,
  resolvePackageManagerOption,
} from '../utils/package-manager.js';
import {
  getDefaultDirectoryName,
  validateDirectory,
  validateNpmPackageName,
  validateProjectName,
} from '../utils/validate.js';

function requiresNpmSafeProjectName(stackId: string): boolean {
  return stackId === 'npm' || stackId === 'express';
}

function ensureInteractiveTty(): void {
  if (!process.stdin.isTTY) {
    logger.error(
      'Interactive init usage requires a TTY. Re-run in a terminal or use `scafix create <stack> --yes`.'
    );
    throw new CliExitError(1);
  }
}

export async function initCommand(options: CliOptions = {}): Promise<void> {
  try {
    if (options.yes) {
      logger.error(
        'Non-interactive usage requires an explicit stack: use `scafix create <stack> --yes`.'
      );
      throw new CliExitError(1);
    }

    ensureInteractiveTty();

    const adapter = await selectStack(adapters);
    if (!adapter) {
      return;
    }

    logger.info(`Selected: ${adapter.name}`);
    logger.info('');

    // Prompt for project name only when it is not already provided.
    const explicitProjectName =
      typeof options.name === 'string'
        ? options.name
        : typeof options.projectName === 'string'
          ? options.projectName
          : undefined;
    let projectName: string | undefined = explicitProjectName;
    if (!projectName) {
      const projectNameResponse = await promptProjectName({
        yes: options.yes,
        default: 'my-project',
      });
      if (!projectNameResponse) {
        return;
      }
      projectName = projectNameResponse;
    }

    const isValidProjectName = requiresNpmSafeProjectName(adapter.id)
      ? validateNpmPackageName(projectName)
      : validateProjectName(projectName);
    if (!isValidProjectName) {
      throw new CliExitError(1);
    }

    // Prompt for directory only when it is not already provided.
    const explicitDirectory =
      typeof options.directory === 'string' && options.directory.trim().length > 0
        ? options.directory.trim()
        : undefined;
    const hasExplicitDirectory = explicitDirectory !== undefined;
    const defaultDirectory = getDefaultDirectoryName(projectName);
    let directory = explicitDirectory ?? defaultDirectory;
    if (!hasExplicitDirectory && !options.yes) {
      const dirResponse = await promptDirectory(defaultDirectory, {
        yes: options.yes,
      });
      if (dirResponse) {
        directory = dirResponse;
      }
    }

    const dirInfo = validateDirectory(directory);
    if (!dirInfo.valid) {
      logger.error(dirInfo.reason ?? `Invalid directory: ${directory}`);
      throw new CliExitError(1);
    }
    if (dirInfo.exists) {
      logger.warn(`The directory "${directory}" already exists.`);
      logger.info(`Please choose a different project name or remove the existing directory.`);
      throw new CliExitError(1);
    }

    // Detect or prompt for package manager
    let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';

    // First, check if explicitly provided via CLI
    if (options.packageManager !== undefined) {
      const resolvedPackageManager = resolvePackageManagerOption(options.packageManager);
      if (!resolvedPackageManager) {
        logger.error(`Unsupported package manager: ${String(options.packageManager)}`);
        logger.info('Supported package managers: npm, pnpm, yarn, bun');
        throw new CliExitError(1);
      }

      packageManager = resolvedPackageManager;
    } else {
      // Try to detect from current directory
      const detectedPm = detectPackageManagerFromCwd();
      if (detectedPm) {
        packageManager = detectedPm;
        logger.debug(`Detected package manager: ${packageManager}`);
      } else if (!options.yes) {
        // Only prompt if not detected and not in --yes mode
        const pmResponse = await promptPackageManager({ yes: options.yes });
        if (pmResponse) {
          packageManager = pmResponse;
        }
      }
      // Otherwise default to npm
    }

    // Prompt for Git initialization
    let git = false;
    if (options.git !== undefined) {
      git = Boolean(options.git);
    } else if (!options.yes) {
      git = await promptGit({ yes: options.yes });
    }

    // Create options for adapter
    const createOptions: CreateOptions = {
      ...options,
      projectName,
      directory,
      packageManager,
      git,
    };

    logger.info('');
    logger.info('Creating project...');
    logger.info('');

    // Create the project
    await adapter.create(createOptions);

    // Initialize Git if requested
    if (git) {
      const gitSpinner = spinner();
      gitSpinner.start('Initializing Git repository...');
      const projectPath = join(process.cwd(), directory);
      try {
        await exec('git', ['init'], { cwd: projectPath, stdio: 'pipe' });
        gitSpinner.stop('Git repository initialized');
      } catch (error) {
        gitSpinner.stop('Failed to initialize Git repository');
        logger.debug(`Git init error: ${error}`);
      }
    }

    logger.info('');
    logger.success('Project created successfully!');
  } catch (error) {
    if (isCliExitError(error)) {
      throw error;
    }

    if (options.debug) {
      logger.error(`Error: ${error instanceof Error ? error.stack : String(error)}`);
    } else {
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw new CliExitError(1);
  }
}
