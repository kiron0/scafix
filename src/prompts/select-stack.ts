import prompts from 'prompts'
import { StackAdapter } from '../types/stack.js'
import { logger } from '../utils/logger.js'

export async function selectStack(
  adapters: StackAdapter[],
  options: { yes?: boolean } = {}
): Promise<StackAdapter | null> {
  if (options.yes) {
    // Return first adapter as default when --yes is used
    return adapters[0] || null
  }

  try {
    const response = await prompts({
      type: 'select',
      name: 'stack',
      message: 'Select a stack:',
      choices: adapters.map((adapter) => ({
        title: `${adapter.name}${adapter.backend ? ' (Backend)' : ''}`,
        description: adapter.description,
        value: adapter,
      })),
      initial: 0,
    })

    return response.stack || null
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`)
    return null
  }
}

export async function promptProjectName(
  options: { yes?: boolean; default?: string } = {}
): Promise<string | null> {
  if (options.yes && options.default) {
    return options.default
  }

  try {
    const response = await prompts({
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: options.default || 'my-project',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name cannot be empty'
        }
        return true
      },
    })

    return response.projectName || null
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`)
    return null
  }
}

export async function promptDirectory(
  projectName: string,
  options: { yes?: boolean } = {}
): Promise<string | null> {
  if (options.yes) {
    return projectName
  }

  try {
    const response = await prompts({
      type: 'text',
      name: 'directory',
      message: 'Directory:',
      initial: projectName,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Directory cannot be empty'
        }
        return true
      },
    })

    return response.directory || null
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`)
    return null
  }
}

export async function promptPackageManager(
  options: { yes?: boolean } = {}
): Promise<'npm' | 'pnpm' | 'yarn' | null> {
  if (options.yes) {
    return 'npm'
  }

  try {
    const response = await prompts({
      type: 'select',
      name: 'packageManager',
      message: 'Package manager:',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'pnpm', value: 'pnpm' },
        { title: 'yarn', value: 'yarn' },
      ],
      initial: 0,
    })

    return response.packageManager || null
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`)
    return null
  }
}

export async function promptGit(
  options: { yes?: boolean } = {}
): Promise<boolean> {
  if (options.yes) {
    return false
  }

  try {
    const response = await prompts({
      type: 'confirm',
      name: 'git',
      message: 'Initialize Git repository?',
      initial: false,
    })

    return response.git ?? false
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`)
    return false
  }
}
