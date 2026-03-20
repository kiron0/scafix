import { spinner } from '@clack/prompts';
import { join } from 'path';
import { AVAILABLE_STACK_IDS_LABEL, getAdapterById } from '../adapters/index.js';
import {
  promptDirectory,
  promptGit,
  promptPackageManager,
  promptProjectName,
} from '../prompts/select-stack.js';
import type { CliOptions, CreateOptions } from '../types/stack.js';
import { exec } from '../utils/exec.js';
import { CliExitError, isCliExitError } from '../utils/cli-error.js';
import { stripGeneratedGitDirectory } from '../utils/git.js';
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
      'Interactive prompts require a TTY. Re-run in a terminal or provide the required options explicitly.'
    );
    throw new CliExitError(1);
  }
}

export async function createCommand(
  stackId: string | undefined,
  options: CliOptions = {}
): Promise<void> {
  try {
    // If no stack ID provided, we'll handle it in interactive mode
    if (!stackId) {
      logger.error('Stack ID is required. Use: scafix create <stack>');
      logger.info(`Available stacks: ${AVAILABLE_STACK_IDS_LABEL}`);
      throw new CliExitError(1);
    }

    const adapter = getAdapterById(stackId);
    if (!adapter) {
      logger.error(`Unknown stack: ${stackId}`);
      logger.info(`Available stacks: ${AVAILABLE_STACK_IDS_LABEL}`);
      throw new CliExitError(1);
    }

    // Prompt for project name if not provided
    const explicitProjectName =
      typeof options.name === 'string'
        ? options.name
        : typeof options.projectName === 'string'
          ? options.projectName
          : undefined;
    let projectName: string | undefined = explicitProjectName;
    if (!projectName) {
      ensureInteractiveTty();
      const projectNameResponse = await promptProjectName({
        yes: options.yes,
        default: 'my-project',
      });
      if (!projectNameResponse) {
        return;
      }
      projectName = projectNameResponse;
    }

    const isValidProjectName = requiresNpmSafeProjectName(stackId)
      ? validateNpmPackageName(projectName)
      : validateProjectName(projectName);
    if (!isValidProjectName) {
      throw new CliExitError(1);
    }

    // Prompt for directory
    const explicitDirectory =
      typeof options.directory === 'string' && options.directory.trim().length > 0
        ? options.directory.trim()
        : undefined;
    const hasExplicitDirectory = explicitDirectory !== undefined;
    const defaultDirectory = getDefaultDirectoryName(projectName);
    let directory = explicitDirectory ?? defaultDirectory;
    if (!hasExplicitDirectory && !options.yes) {
      ensureInteractiveTty();
      const dirResponse = await promptDirectory(defaultDirectory, {
        yes: options.yes,
      });
      if (dirResponse) {
        directory = dirResponse;
      }
    }

    // Check if directory exists
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
        ensureInteractiveTty();
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
    } else if (options.yes) {
      git = true;
    } else if (!options.yes) {
      ensureInteractiveTty();
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

    const projectPath = join(process.cwd(), directory);

    // Create the project
    await adapter.create(createOptions);

    // Keep root commands as the single owner of git initialisation.
    await stripGeneratedGitDirectory(projectPath);

    // Initialize Git if requested
    if (git) {
      const gitSpinner = spinner();
      gitSpinner.start('Initializing Git repository...');
      try {
        await exec('git', ['init'], { cwd: projectPath, stdio: 'pipe' });
        gitSpinner.stop('Git repository initialized');
      } catch (error) {
        gitSpinner.stop('Failed to initialize Git repository');
        logger.debug(`Git init error: ${error}`);
      }
    }
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
