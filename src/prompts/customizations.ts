import { cancel, confirm, select } from '@clack/prompts';
import chalk from 'chalk';
import { APP_CONFIG } from '../config/index.js';
import { CliExitError } from '../utils/cli-error.js';
import { logger } from '../utils/logger.js';

export interface ViteReactCustomizations {
  framework: 'react' | 'vue';
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

export interface AstroCustomizations {
  template: 'minimal' | 'blog' | 'docs';
}

export interface SvelteKitCustomizations {
  template: 'minimal' | 'demo' | 'library';
  types: 'ts' | 'jsdoc';
}

export interface NuxtCustomizations {
  template: 'minimal' | 'content' | 'ui';
}

export interface NestCustomizations {
  language: 'ts' | 'js';
  strict: boolean;
}

export interface HonoCustomizations {
  template: 'nodejs' | 'bun' | 'cloudflare-workers' | 'vercel';
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

export interface ExpoCustomizations {
  template: 'default' | 'blank' | 'tabs' | 'bare-minimum';
}

export interface RemixCustomizations {
  template: 'remix';
}

export interface FastifyCustomizations {
  language: 'ts' | 'js';
}

export interface TauriCustomizations {
  template:
    | 'vanilla'
    | 'vanilla-ts'
    | 'react'
    | 'react-ts'
    | 'vue'
    | 'vue-ts'
    | 'svelte'
    | 'svelte-ts';
}

export interface T3Customizations {
  packages: string[];
  appRouter: boolean;
}

export interface AngularCustomizations {
  style: 'css' | 'scss' | 'less';
  ssr: boolean;
  routing: boolean;
  zard: boolean;
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
      framework: 'react',
      typescript: true,
      tailwind: false,
      shadcn: false,
      prettier: false,
    };
  }

  try {
    const customizations: ViteReactCustomizations = {
      framework: 'react',
      typescript: true,
      tailwind: false,
      shadcn: false,
      prettier: false,
    };

    const frameworkResponse = await select({
      message: 'Select Vite framework:',
      options: [
        { label: 'React', value: 'react' },
        { label: 'Vue', value: 'vue' },
      ],
    });
    customizations.framework =
      (unwrapPromptResponse(frameworkResponse) as ViteReactCustomizations['framework']) ?? 'react';

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
        message:
          customizations.framework === 'vue' ? 'Add shadcn-vue?' : 'Add shadcn/ui?',
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

export async function promptAstroCustomizations(
  options: { yes?: boolean } = {}
): Promise<AstroCustomizations> {
  if (options.yes) {
    return {
      template: 'minimal',
    };
  }

  try {
    const templateResponse = await select({
      message: 'Select Astro template:',
      options: [
        { label: 'Minimal', hint: 'Smallest Astro starter', value: 'minimal' },
        { label: 'Blog', hint: 'Content-focused starter', value: 'blog' },
        { label: 'Docs', hint: 'Documentation-focused starter', value: 'docs' },
      ],
    });

    return {
      template:
        (unwrapPromptResponse(templateResponse) as AstroCustomizations['template']) ?? 'minimal',
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptSvelteKitCustomizations(
  options: { yes?: boolean } = {}
): Promise<SvelteKitCustomizations> {
  if (options.yes) {
    return {
      template: 'minimal',
      types: 'ts',
    };
  }

  try {
    const templateResponse = await select({
      message: 'Select SvelteKit template:',
      options: [
        { label: 'Minimal', hint: 'Smallest app starter', value: 'minimal' },
        { label: 'Demo', hint: 'Feature-rich demo app', value: 'demo' },
        { label: 'Library', hint: 'Reusable package starter', value: 'library' },
      ],
    });

    const typesResponse = await select({
      message: 'Type checking mode:',
      options: [
        { label: 'TypeScript', value: 'ts' },
        { label: 'JSDoc / CheckJS', value: 'jsdoc' },
      ],
    });

    return {
      template:
        (unwrapPromptResponse(templateResponse) as SvelteKitCustomizations['template']) ??
        'minimal',
      types: (unwrapPromptResponse(typesResponse) as SvelteKitCustomizations['types']) ?? 'ts',
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptNuxtCustomizations(
  options: { yes?: boolean } = {}
): Promise<NuxtCustomizations> {
  if (options.yes) {
    return {
      template: 'minimal',
    };
  }

  try {
    const templateResponse = await select({
      message: 'Select Nuxt template:',
      options: [
        { label: 'Minimal', hint: 'Lean Nuxt 4 starter', value: 'minimal' },
        { label: 'Content', hint: 'Content-driven website starter', value: 'content' },
        { label: 'UI', hint: 'Nuxt UI starter', value: 'ui' },
      ],
    });

    return {
      template:
        (unwrapPromptResponse(templateResponse) as NuxtCustomizations['template']) ?? 'minimal',
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptNestCustomizations(
  options: { yes?: boolean } = {}
): Promise<NestCustomizations> {
  if (options.yes) {
    return {
      language: 'ts',
      strict: true,
    };
  }

  try {
    const languageResponse = await select({
      message: 'Use TypeScript or JavaScript?',
      options: [
        { label: 'TypeScript', value: 'ts' },
        { label: 'JavaScript', value: 'js' },
      ],
    });

    const strictResponse = await confirm({
      message: 'Enable strict TypeScript mode?',
      initialValue: true,
    });

    return {
      language: (unwrapPromptResponse(languageResponse) as NestCustomizations['language']) ?? 'ts',
      strict: unwrapPromptResponse(strictResponse) ?? true,
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptHonoCustomizations(
  options: { yes?: boolean } = {}
): Promise<HonoCustomizations> {
  if (options.yes) {
    return {
      template: 'nodejs',
    };
  }

  try {
    const templateResponse = await select({
      message: 'Select Hono runtime template:',
      options: [
        { label: 'Node.js', value: 'nodejs' },
        { label: 'Bun', value: 'bun' },
        { label: 'Cloudflare Workers', value: 'cloudflare-workers' },
        { label: 'Vercel', value: 'vercel' },
      ],
    });

    return {
      template:
        (unwrapPromptResponse(templateResponse) as HonoCustomizations['template']) ?? 'nodejs',
    };
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

export async function promptExpoCustomizations(
  options: { yes?: boolean } = {}
): Promise<ExpoCustomizations> {
  if (options.yes) {
    return { template: 'default' };
  }

  try {
    const templateResponse = await select({
      message: 'Select Expo template:',
      options: [
        { label: 'Default', hint: 'Recommended Expo starter', value: 'default' },
        { label: 'Blank', hint: 'Minimal blank project', value: 'blank' },
        { label: 'Tabs', hint: 'Tab navigation starter', value: 'tabs' },
        { label: 'Bare minimum', hint: 'Bare React Native project', value: 'bare-minimum' },
      ],
    });

    return {
      template:
        (unwrapPromptResponse(templateResponse) as ExpoCustomizations['template']) ?? 'default',
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptRemixCustomizations(
  options: { yes?: boolean } = {}
): Promise<RemixCustomizations> {
  void options;
  return { template: 'remix' };
}

export async function promptFastifyCustomizations(
  options: { yes?: boolean } = {}
): Promise<FastifyCustomizations> {
  if (options.yes) {
    return { language: 'ts' };
  }

  try {
    const languageResponse = await select({
      message: 'Use TypeScript or JavaScript?',
      options: [
        { label: 'TypeScript', value: 'ts' },
        { label: 'JavaScript', value: 'js' },
      ],
    });

    return {
      language:
        (unwrapPromptResponse(languageResponse) as FastifyCustomizations['language']) ?? 'ts',
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptTauriCustomizations(
  options: { yes?: boolean } = {}
): Promise<TauriCustomizations> {
  if (options.yes) {
    return { template: 'react-ts' };
  }

  try {
    const templateResponse = await select({
      message: 'Select Tauri frontend template:',
      options: [
        { label: 'React + TypeScript', value: 'react-ts' },
        { label: 'React', value: 'react' },
        { label: 'Vue + TypeScript', value: 'vue-ts' },
        { label: 'Vue', value: 'vue' },
        { label: 'Svelte + TypeScript', value: 'svelte-ts' },
        { label: 'Svelte', value: 'svelte' },
        { label: 'Vanilla + TypeScript', value: 'vanilla-ts' },
        { label: 'Vanilla', value: 'vanilla' },
      ],
    });

    return {
      template:
        (unwrapPromptResponse(templateResponse) as TauriCustomizations['template']) ?? 'react-ts',
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptT3Customizations(
  options: { yes?: boolean } = {}
): Promise<T3Customizations> {
  if (options.yes) {
    return {
      packages: ['tailwind', 'trpc', 'prisma'],
      appRouter: true,
    };
  }

  try {
    const appRouterResponse = await confirm({
      message: 'Use App Router?',
      initialValue: true,
    });

    const trpcResponse = await confirm({
      message: 'Add tRPC?',
      initialValue: true,
    });

    const prismaResponse = await confirm({
      message: 'Add Prisma?',
      initialValue: true,
    });

    const tailwindResponse = await confirm({
      message: 'Add Tailwind CSS?',
      initialValue: true,
    });

    const nextAuthResponse = await confirm({
      message: 'Add NextAuth.js?',
      initialValue: false,
    });

    const packages: string[] = [];
    if (unwrapPromptResponse(tailwindResponse)) packages.push('tailwind');
    if (unwrapPromptResponse(trpcResponse)) packages.push('trpc');
    if (unwrapPromptResponse(prismaResponse)) packages.push('prisma');
    if (unwrapPromptResponse(nextAuthResponse)) packages.push('nextAuth');

    return {
      packages,
      appRouter: unwrapPromptResponse(appRouterResponse) ?? true,
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}

export async function promptAngularCustomizations(
  options: { yes?: boolean } = {}
): Promise<AngularCustomizations> {
  if (options.yes) {
    return {
      style: 'css',
      ssr: false,
      routing: true,
      zard: false,
    };
  }

  try {
    const styleResponse = await select({
      message: 'Stylesheet format:',
      options: [
        { label: 'CSS', value: 'css' },
        { label: 'SCSS', value: 'scss' },
        { label: 'Less', value: 'less' },
      ],
    });

    const ssrResponse = await confirm({
      message: 'Enable server-side rendering (SSR)?',
      initialValue: false,
    });

    const routingResponse = await confirm({
      message: 'Add routing?',
      initialValue: true,
    });

    const zardResponse = await confirm({
      message: 'Add zard/ui?',
      initialValue: false,
    });

    return {
      style: (unwrapPromptResponse(styleResponse) as AngularCustomizations['style']) ?? 'css',
      ssr: unwrapPromptResponse(ssrResponse) ?? false,
      routing: unwrapPromptResponse(routingResponse) ?? true,
      zard: unwrapPromptResponse(zardResponse) ?? false,
    };
  } catch (error) {
    if (isPromptCancelledError(error)) {
      abortCustomizationPrompt(error);
    }

    throw error;
  }
}
