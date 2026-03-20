import chalk from 'chalk';
import { Command } from 'commander';
import { AVAILABLE_STACK_IDS_LABEL } from './adapters/index.js';
import { createCommand } from './commands/create.js';
import { initCommand } from './commands/init.js';
import { rootCommand } from './commands/root.js';
import { APP_CONFIG } from './config/index.js';
import { isCliExitError } from './utils/cli-error.js';
import { logger } from './utils/logger.js';

process.on('SIGINT', () => {
  console.log('\n' + chalk.cyan(APP_CONFIG.thankYouMessage));
  process.exit(130);
});

const program = new Command();

function applyProjectOptions(command: Command, includeYes = false): Command {
  command
    .option('-n, --name <name>', 'Project name')
    .option('-d, --directory <dir>', 'Project directory')
    .option('--package-manager <pm>', 'Package manager (npm, pnpm, yarn, bun)')
    .option('--git', 'Initialize Git repository')
    .option('--no-git', 'Skip Git repository initialization')
    .option('--debug', 'Enable debug output');

  if (includeYes) {
    command.option('-y, --yes', 'Accept defaults without prompts');
  }

  return command;
}

function applyStackOverrideOptions(command: Command): Command {
  return command
    .option('--template <template>', 'Stack template override')
    .option('--framework <framework>', 'Framework override for multi-framework stacks')
    .option('--types <types>', 'Type generation override for stacks that support it')
    .option('--tailwind-version <version>', 'Tailwind version override')
    .option('--style <style>', 'Style override')
    .option('--pattern <pattern>', 'Architecture pattern override')
    .option('--build-tool <buildTool>', 'Build tool override')
    .option('--test-framework <testFramework>', 'Test framework override')
    .option('--typescript', 'Enable TypeScript')
    .option('--no-typescript', 'Disable TypeScript')
    .option('--eslint', 'Enable ESLint')
    .option('--no-eslint', 'Disable ESLint')
    .option('--prettier', 'Enable Prettier')
    .option('--no-prettier', 'Disable Prettier')
    .option('--tailwind', 'Enable Tailwind CSS')
    .option('--no-tailwind', 'Disable Tailwind CSS')
    .option('--shadcn', 'Enable shadcn/ui')
    .option('--no-shadcn', 'Disable shadcn/ui')
    .option('--shadcn-vue', 'Enable shadcn-vue')
    .option('--app-router', 'Enable the app router')
    .option('--no-app-router', 'Disable the app router')
    .option('--src-dir', 'Use a src directory')
    .option('--no-src-dir', 'Do not use a src directory')
    .option('--ssr', 'Enable SSR')
    .option('--no-ssr', 'Disable SSR')
    .option('--routing', 'Enable routing')
    .option('--no-routing', 'Disable routing')
    .option('--zard', 'Enable zard/ui')
    .option('--no-zard', 'Disable zard/ui')
    .option('--cors', 'Enable CORS')
    .option('--no-cors', 'Disable CORS')
    .option('--helmet', 'Enable Helmet')
    .option('--no-helmet', 'Disable Helmet')
    .option('--dotenv', 'Enable dotenv')
    .option('--no-dotenv', 'Disable dotenv')
    .option('--strict', 'Enable strict mode')
    .option('--no-strict', 'Disable strict mode')
    .option('--trpc', 'Enable tRPC')
    .option('--no-trpc', 'Disable tRPC')
    .option('--prisma', 'Enable Prisma')
    .option('--no-prisma', 'Disable Prisma')
    .option('--next-auth', 'Enable NextAuth')
    .option('--no-next-auth', 'Disable NextAuth');
}

function resolveActionOptions<T extends Record<string, unknown>>(value: T): T {
  if ('opts' in value && typeof value.opts === 'function') {
    return value.opts() as T;
  }

  return value;
}

function resolveSubcommandOptions<T extends Record<string, unknown>>(
  value: T,
  command?: Command
): T {
  if (command && typeof command.optsWithGlobals === 'function') {
    return command.optsWithGlobals() as T;
  }

  if (command && typeof command.opts === 'function') {
    return command.opts() as T;
  }

  return resolveActionOptions(value);
}

async function runAction(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (isCliExitError(error)) {
      process.exitCode = error.exitCode;
      return;
    }

    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

program.name(APP_CONFIG.name).description(APP_CONFIG.description).version(APP_CONFIG.version);

applyStackOverrideOptions(applyProjectOptions(program, true));

applyStackOverrideOptions(
  applyProjectOptions(
  program
    .command('create')
    .description('Create a new project with a specific stack')
    .argument('[stack]', `Stack ID (${AVAILABLE_STACK_IDS_LABEL})`),
    true
  )
).action(async (stack, actionOptions, command) => {
  const options = resolveSubcommandOptions(actionOptions, command);
  if (options.debug) {
    process.env.DEBUG = 'true';
  }

  await runAction(async () => {
    if (stack) {
      await createCommand(stack, options);
    } else {
      await initCommand(options);
    }
  });
});

applyStackOverrideOptions(
  applyProjectOptions(
    program.command('init').description('Initialize a new project interactively')
  )
).action(async (actionOptions, command) => {
  const options = resolveSubcommandOptions(actionOptions, command);
  if (options.debug) {
    process.env.DEBUG = 'true';
  }
  await runAction(() => initCommand(options));
});

program.action(async (actionOptions) => {
  const options = resolveActionOptions(actionOptions);
  if (options.debug) {
    process.env.DEBUG = 'true';
  }

  await runAction(() => rootCommand(options));
});

async function main(): Promise<void> {
  await program.parseAsync();
}

main().catch((error) => {
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
