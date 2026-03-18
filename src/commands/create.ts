import { spinner } from "@clack/prompts";
import { join } from "path";
import { getAdapterById } from "../adapters/index.js";
import {
  promptDirectory,
  promptGit,
  promptPackageManager,
  promptProjectName,
} from "../prompts/select-stack.js";
import type { CliOptions, CreateOptions } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { detectPackageManagerFromCwd } from "../utils/package-manager.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

export async function createCommand(
  stackId: string | undefined,
  options: CliOptions = {},
): Promise<void> {
  try {
    // If no stack ID provided, we'll handle it in interactive mode
    if (!stackId) {
      logger.error("Stack ID is required. Use: scafix create <stack>");
      logger.info("Available stacks: vite, next, express, npm");
      process.exit(1);
    }

    const adapter = getAdapterById(stackId);
    if (!adapter) {
      logger.error(`Unknown stack: ${stackId}`);
      logger.info("Available stacks: vite, next, express, npm");
      process.exit(1);
    }

    // Prompt for project name if not provided
    let projectName = (options.name || options.projectName) as
      | string
      | undefined;
    if (!projectName) {
      projectName = (await promptProjectName({ yes: options.yes })) as string;
      if (!projectName) {
        process.exit(0);
      }
    }

    if (!validateProjectName(projectName)) {
      process.exit(1);
    }

    // Prompt for directory
    let directory = (options.directory as string) || projectName;
    if (!options.yes) {
      const dirResponse = await promptDirectory(projectName, {
        yes: options.yes,
      });
      if (dirResponse) {
        directory = dirResponse;
      }
    }

    // Check if directory exists
    const dirInfo = validateDirectory(directory);
    if (dirInfo.exists) {
      logger.warn(`The directory "${directory}" already exists.`);
      logger.info(
        `Please choose a different project name or remove the existing directory.`,
      );
      process.exit(1);
    }

    // Detect or prompt for package manager
    let packageManager: "npm" | "pnpm" | "yarn" | "bun" = "npm";

    // First, check if explicitly provided via CLI
    if (options.packageManager) {
      packageManager = options.packageManager as
        | "npm"
        | "pnpm"
        | "yarn"
        | "bun";
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
      projectName,
      directory,
      packageManager,
      git,
      ...options,
    };

    // Create the project
    await adapter.create(createOptions);

    // Initialize Git if requested
    if (git) {
      const gitSpinner = spinner();
      gitSpinner.start("Initializing Git repository...");
      const projectPath = join(process.cwd(), directory);
      try {
        await exec("git", ["init"], { cwd: projectPath, stdio: "pipe" });
        gitSpinner.stop("Git repository initialized");
      } catch (error) {
        gitSpinner.stop("Failed to initialize Git repository");
        logger.debug(`Git init error: ${error}`);
      }
    }
  } catch (error) {
    if (options.debug) {
      logger.error(
        `Error: ${error instanceof Error ? error.stack : String(error)}`,
      );
    } else {
      logger.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exit(1);
  }
}
