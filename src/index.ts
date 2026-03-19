import chalk from "chalk";
import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { initCommand } from "./commands/init.js";
import { rootCommand } from "./commands/root.js";
import { APP_CONFIG } from "./config/index.js";
import { isCliExitError } from "./utils/cli-error.js";
import { logger } from "./utils/logger.js";

process.on("SIGINT", () => {
  console.log("\n" + chalk.cyan(APP_CONFIG.thankYouMessage));
  process.exit(0);
});

const program = new Command();

async function runAction(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (isCliExitError(error)) {
      process.exitCode = error.exitCode;
      return;
    }

    logger.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

program
  .name(APP_CONFIG.name)
  .description(APP_CONFIG.description)
  .version(APP_CONFIG.version);

program
  .command("create")
  .description("Create a new project with a specific stack")
  .argument("[stack]", "Stack ID (vite, next, express, npm)")
  .option("-n, --name <name>", "Project name")
  .option("-d, --directory <dir>", "Project directory")
  .option("--package-manager <pm>", "Package manager (npm, pnpm, yarn, bun)")
  .option("--git", "Initialize Git repository")
  .option("-y, --yes", "Accept defaults without prompts")
  .option("--debug", "Enable debug output")
  .action(async (stack, options) => {
    if (options.debug) {
      process.env.DEBUG = "true";
    }

    await runAction(async () => {
      if (stack) {
        await createCommand(stack, options);
      } else {
        await initCommand(options);
      }
    });
  });

program
  .command("init")
  .description("Initialize a new project interactively")
  .option("-n, --name <name>", "Project name")
  .option("-d, --directory <dir>", "Project directory")
  .option("--package-manager <pm>", "Package manager (npm, pnpm, yarn, bun)")
  .option("--git", "Initialize Git repository")
  .option("--debug", "Enable debug output")
  .action(async (options) => {
    if (options.debug) {
      process.env.DEBUG = "true";
    }
    await runAction(() => initCommand(options));
  });

program.action(async (options) => {
  if (options.debug) {
    process.env.DEBUG = "true";
  }

  await runAction(() => rootCommand(options));
});

async function main(): Promise<void> {
  await program.parseAsync();
}

main().catch((error) => {
  logger.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
