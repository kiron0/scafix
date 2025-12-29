import { join } from 'path'
import { exec } from '../utils/exec.js'
import { logger } from '../utils/logger.js'
import { detectPackageManagerFromCwd } from '../utils/package-manager.js'
import { adapters } from '../adapters/index.js'
import {
  selectStack,
  promptProjectName,
  promptDirectory,
  promptPackageManager,
  promptGit,
} from '../prompts/select-stack.js'
import type { CreateOptions, CliOptions } from '../types/stack.js'

export async function initCommand(options: CliOptions = {}): Promise<void> {
  try {
    logger.info('Welcome to Scafix!')
    logger.info('')

    // Select stack
    const adapter = await selectStack(adapters, { yes: options.yes })
    if (!adapter) {
      logger.warn('Stack selection cancelled')
      process.exit(0)
    }

    logger.info(`Selected: ${adapter.name}`)
    logger.info('')

    // Prompt for project name
    const projectName = await promptProjectName({ yes: options.yes })
    if (!projectName) {
      logger.warn('Project creation cancelled')
      process.exit(0)
    }

    // Prompt for directory
    let directory = projectName
    if (!options.yes) {
      const dirResponse = await promptDirectory(projectName, { yes: options.yes })
      if (dirResponse) {
        directory = dirResponse
      }
    }

    // Detect or prompt for package manager
    let packageManager: 'npm' | 'pnpm' | 'yarn' = 'npm'

    // First, check if explicitly provided via CLI
    if (options.packageManager) {
      packageManager = options.packageManager as 'npm' | 'pnpm' | 'yarn'
    } else {
      // Try to detect from current directory
      const detectedPm = detectPackageManagerFromCwd()
      if (detectedPm) {
        packageManager = detectedPm
        logger.debug(`Detected package manager: ${packageManager}`)
      } else if (!options.yes) {
        // Only prompt if not detected and not in --yes mode
        const pmResponse = await promptPackageManager({ yes: options.yes })
        if (pmResponse) {
          packageManager = pmResponse
        }
      }
      // Otherwise default to npm
    }

    // Prompt for Git initialization
    let git = false
    if (options.git !== undefined) {
      git = Boolean(options.git)
    } else if (!options.yes) {
      git = await promptGit({ yes: options.yes })
    }

    // Create options for adapter
    const createOptions: CreateOptions = {
      projectName,
      directory,
      packageManager,
      git,
      ...options,
    }

    logger.info('')
    logger.info('Creating project...')
    logger.info('')

    // Create the project
    await adapter.create(createOptions)

    // Initialize Git if requested
    if (git) {
      logger.info('Initializing Git repository...')
      const projectPath = join(process.cwd(), directory)
      try {
        await exec('git', ['init'], { cwd: projectPath, stdio: 'pipe' })
        logger.success('Git repository initialized')
      } catch (error) {
        logger.warn('Failed to initialize Git repository')
        logger.debug(`Git init error: ${error}`)
      }
    }

    logger.info('')
    logger.success('Project created successfully!')
  } catch (error) {
    if (options.debug) {
      logger.error(`Error: ${error instanceof Error ? error.stack : String(error)}`)
    } else {
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
    process.exit(1)
  }
}
