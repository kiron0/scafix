import { cancel, confirm, select, text } from '@clack/prompts';
import chalk from 'chalk';
import { APP_CONFIG } from '../config/index.js';
import { CliExitError } from '../utils/cli-error.js';
import { StackAdapter } from '../types/stack.js';

function isPromptCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Prompt cancelled';
}

function abortPromptCancellation(): never {
  cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
  throw new CliExitError(130);
}

function unwrapPromptResponse<T>(response: T | symbol | undefined | null): T | undefined {
  if (typeof response === 'symbol') {
    throw new Error('Prompt cancelled');
  }

  return response ?? undefined;
}

export async function selectStack(adapters: StackAdapter[]): Promise<StackAdapter | null> {
  try {
    const response = await select({
      message: 'Select a stack:',
      options: adapters.map((adapter) => ({
        label: `${adapter.name}${adapter.backend ? ' (Backend)' : ''}`,
        hint: adapter.description,
        value: adapter,
      })),
    });

    return unwrapPromptResponse(response) ?? null;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortPromptCancellation();
    }

    throw error;
  }
}

export async function promptProjectName(
  options: { yes?: boolean; default?: string } = {}
): Promise<string | null> {
  if (options.yes && options.default) {
    return options.default;
  }

  try {
    const response = await text({
      message: 'Project name:',
      initialValue: options.default || 'my-project',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name cannot be empty';
        }
        return;
      },
    });

    return unwrapPromptResponse(response) ?? null;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortPromptCancellation();
    }

    throw error;
  }
}

export async function promptDirectory(
  projectName: string,
  options: { yes?: boolean } = {}
): Promise<string | null> {
  if (options.yes) {
    return projectName;
  }

  try {
    const response = await text({
      message: 'Directory:',
      initialValue: projectName,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Directory cannot be empty';
        }
        return;
      },
    });

    return unwrapPromptResponse(response) ?? null;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortPromptCancellation();
    }

    throw error;
  }
}

export async function promptPackageManager(
  options: { yes?: boolean } = {}
): Promise<'npm' | 'pnpm' | 'yarn' | 'bun' | null> {
  if (options.yes) {
    return 'npm';
  }

  try {
    const response = await select({
      message: 'Package manager:',
      options: [
        { label: 'npm', value: 'npm' },
        { label: 'pnpm', value: 'pnpm' },
        { label: 'yarn', value: 'yarn' },
        { label: 'bun', value: 'bun' },
      ],
    });

    return unwrapPromptResponse(response) ?? null;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortPromptCancellation();
    }

    throw error;
  }
}

export async function promptGit(options: { yes?: boolean } = {}): Promise<boolean> {
  if (options.yes) {
    return false;
  }

  try {
    const response = await confirm({
      message: 'Initialize Git repository?',
      initialValue: false,
    });

    return unwrapPromptResponse(response) ?? false;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortPromptCancellation();
    }

    throw error;
  }
}
