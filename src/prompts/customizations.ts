import { cancel, confirm, select } from '@clack/prompts';
import chalk from 'chalk';
import { APP_CONFIG } from '../config/index.js';
import { CliExitError } from '../utils/cli-error.js';
import { logger } from '../utils/logger.js';

export interface ViteReactCustomizations {
  typescript: boolean;
  tailwind: boolean;
  tailwindVersion?: 'v3' | 'v4';
  shadcn: boolean;
  prettier: boolean;
}

export interface NextCustomizations {
  typescript: boolean;
  tailwind: boolean;
  shadcn: boolean;
  eslint: boolean;
  prettier: boolean;
  appRouter: boolean;
  srcDir: boolean;
}

export interface ExpressCustomizations {
  typescript: boolean;
  pattern: 'mvc' | 'rest' | 'layered' | 'simple';
  eslint: boolean;
  prettier: boolean;
  cors: boolean;
  helmet: boolean;
  dotenv: boolean;
}

export interface NpmPackageCustomizations {
  typescript: boolean;
  buildTool: 'tsup' | 'rollup' | 'esbuild' | 'none';
  eslint: boolean;
  prettier: boolean;
  testFramework: 'vitest' | 'jest' | 'none';
}

function isPromptCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Prompt cancelled';
}

function unwrapPromptResponse<T>(response: T | symbol | undefined | null): T | undefined {
  if (typeof response === 'symbol') {
    throw new Error('Prompt cancelled');
  }

  return response ?? undefined;
}

function abortCustomizationPrompt(error: unknown): never {
  logger.debug(`Prompt cancelled: ${error}`);
  cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
  throw new CliExitError(130);
}

export async function promptViteReactCustomizations(
  options: { yes?: boolean } = {}
): Promise<ViteReactCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      tailwind: false,
      shadcn: false,
      prettier: false,
    };
  }

  try {
    const customizations: ViteReactCustomizations = {
      typescript: true,
      tailwind: false,
      shadcn: false,
      prettier: false,
    };

    // TypeScript or JavaScript
    const tsResponse = await select({
      message: 'Use TypeScript?',
      options: [
        { label: 'Yes', value: true },
        { label: 'No (JavaScript)', value: false },
      ],
    });
    customizations.typescript = unwrapPromptResponse(tsResponse) ?? true;

    // Tailwind CSS
    const tailwindResponse = await confirm({
      message: 'Add Tailwind CSS?',
      initialValue: false,
    });
    customizations.tailwind = unwrapPromptResponse(tailwindResponse) ?? false;

    if (customizations.tailwind) {
      const tailwindVersionResponse = await select({
        message: 'Tailwind CSS version:',
        options: [
          { label: 'v4 (Latest)', value: 'v4' },
          { label: 'v3 (Stable)', value: 'v3' },
        ],
      });
      customizations.tailwindVersion = unwrapPromptResponse(tailwindVersionResponse) ?? 'v4';
    }

    // Shadcn UI
    if (customizations.tailwind) {
      const shadcnResponse = await confirm({
        message: 'Add shadcn/ui?',
        initialValue: false,
      });
      customizations.shadcn = unwrapPromptResponse(shadcnResponse) ?? false;
    }

    // Prettier
    const prettierResponse = await confirm({
      message: 'Add Prettier?',
      initialValue: false,
    });
    customizations.prettier = unwrapPromptResponse(prettierResponse) ?? false;

    return customizations;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptNextCustomizations(
  options: { yes?: boolean } = {}
): Promise<NextCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      tailwind: true,
      shadcn: false,
      eslint: true,
      prettier: false,
      appRouter: true,
      srcDir: true,
    };
  }

  try {
    const customizations: NextCustomizations = {
      typescript: true,
      tailwind: true,
      shadcn: false,
      eslint: true,
      prettier: false,
      appRouter: true,
      srcDir: true,
    };

    // TypeScript
    const tsResponse = await select({
      message: 'Use TypeScript?',
      options: [
        { label: 'Yes', value: true },
        { label: 'No (JavaScript)', value: false },
      ],
    });
    customizations.typescript = unwrapPromptResponse(tsResponse) ?? true;

    // Tailwind CSS
    const tailwindResponse = await confirm({
      message: 'Add Tailwind CSS?',
      initialValue: true,
    });
    customizations.tailwind = unwrapPromptResponse(tailwindResponse) ?? true;

    // Shadcn UI
    if (customizations.tailwind) {
      const shadcnResponse = await confirm({
        message: 'Add shadcn/ui?',
        initialValue: false,
      });
      customizations.shadcn = unwrapPromptResponse(shadcnResponse) ?? false;
    }

    // ESLint
    const eslintResponse = await confirm({
      message: 'Add ESLint?',
      initialValue: true,
    });
    customizations.eslint = unwrapPromptResponse(eslintResponse) ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: 'Add Prettier?',
      initialValue: false,
    });
    customizations.prettier = unwrapPromptResponse(prettierResponse) ?? false;

    // App Router
    const appRouterResponse = await confirm({
      message: 'Use App Router?',
      initialValue: true,
    });
    customizations.appRouter = unwrapPromptResponse(appRouterResponse) ?? true;

    // src directory
    const srcDirResponse = await confirm({
      message: 'Use src/ directory?',
      initialValue: true,
    });
    customizations.srcDir = unwrapPromptResponse(srcDirResponse) ?? true;

    return customizations;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptExpressCustomizations(
  options: { yes?: boolean } = {}
): Promise<ExpressCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      pattern: 'mvc',
      eslint: true,
      prettier: false,
      cors: false,
      helmet: false,
      dotenv: true,
    };
  }

  try {
    const customizations: ExpressCustomizations = {
      typescript: true,
      pattern: 'mvc',
      eslint: true,
      prettier: false,
      cors: false,
      helmet: false,
      dotenv: true,
    };

    // TypeScript
    const tsResponse = await select({
      message: 'Use TypeScript?',
      options: [
        { label: 'Yes', value: true },
        { label: 'No (JavaScript)', value: false },
      ],
    });
    customizations.typescript = unwrapPromptResponse(tsResponse) ?? true;

    // Architecture Pattern
    const patternResponse = await select({
      message: 'Select architecture pattern:',
      options: [
        {
          label: 'MVC (Model-View-Controller)',
          hint: 'Separates concerns into models, views, and controllers',
          value: 'mvc',
        },
        {
          label: 'REST API',
          hint: 'RESTful API with routes, controllers, and services',
          value: 'rest',
        },
        {
          label: 'Layered Architecture',
          hint: 'Presentation, Business, and Data layers',
          value: 'layered',
        },
        {
          label: 'Simple',
          hint: 'Minimal structure with routes and middleware',
          value: 'simple',
        },
      ],
    });
    customizations.pattern = unwrapPromptResponse(patternResponse) ?? 'mvc';

    // ESLint
    const eslintResponse = await confirm({
      message: 'Add ESLint?',
      initialValue: true,
    });
    customizations.eslint = unwrapPromptResponse(eslintResponse) ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: 'Add Prettier?',
      initialValue: false,
    });
    customizations.prettier = unwrapPromptResponse(prettierResponse) ?? false;

    // CORS
    const corsResponse = await confirm({
      message: 'Add CORS support?',
      initialValue: false,
    });
    customizations.cors = unwrapPromptResponse(corsResponse) ?? false;

    // Helmet
    const helmetResponse = await confirm({
      message: 'Add Helmet (security headers)?',
      initialValue: false,
    });
    customizations.helmet = unwrapPromptResponse(helmetResponse) ?? false;

    // dotenv
    const dotenvResponse = await confirm({
      message: 'Add dotenv for environment variables?',
      initialValue: true,
    });
    customizations.dotenv = unwrapPromptResponse(dotenvResponse) ?? true;

    return customizations;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptNpmPackageCustomizations(
  options: { yes?: boolean } = {}
): Promise<NpmPackageCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      buildTool: 'tsup',
      eslint: true,
      prettier: false,
      testFramework: 'none',
    };
  }

  try {
    const customizations: NpmPackageCustomizations = {
      typescript: true,
      buildTool: 'tsup',
      eslint: true,
      prettier: false,
      testFramework: 'none',
    };

    // TypeScript
    const tsResponse = await select({
      message: 'Use TypeScript?',
      options: [
        { label: 'Yes', value: true },
        { label: 'No (JavaScript)', value: false },
      ],
    });
    customizations.typescript = unwrapPromptResponse(tsResponse) ?? true;

    // Build tool (only ask if TypeScript is selected)
    if (customizations.typescript) {
      const buildToolResponse = await select({
        message: 'Select build tool:',
        options: [
          {
            label: 'tsup',
            hint: 'Fast, zero-config bundler (Recommended)',
            value: 'tsup',
          },
          {
            label: 'Rollup',
            hint: 'Module bundler with tree-shaking',
            value: 'rollup',
          },
          {
            label: 'esbuild',
            hint: 'Extremely fast JavaScript bundler',
            value: 'esbuild',
          },
          {
            label: 'None (TypeScript compiler only)',
            hint: 'Use tsc directly',
            value: 'none',
          },
        ],
      });
      customizations.buildTool = unwrapPromptResponse(buildToolResponse) ?? 'tsup';
    }

    // ESLint
    const eslintResponse = await confirm({
      message: 'Add ESLint?',
      initialValue: true,
    });
    customizations.eslint = unwrapPromptResponse(eslintResponse) ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: 'Add Prettier?',
      initialValue: false,
    });
    customizations.prettier = unwrapPromptResponse(prettierResponse) ?? false;

    // Test framework
    const testFrameworkResponse = await select({
      message: 'Add test setup?',
      options: [
        { label: 'None', value: 'none' },
        {
          label: 'Vitest',
          hint: 'Fast, Vite-native test runner',
          value: 'vitest',
        },
        {
          label: 'Jest',
          hint: 'Widely adopted, great ecosystem',
          value: 'jest',
        },
      ],
    });
    customizations.testFramework =
      (unwrapPromptResponse(testFrameworkResponse) as NpmPackageCustomizations['testFramework']) ??
      'none';

    return customizations;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}
