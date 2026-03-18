import * as p from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { initCommand } from "./commands/init.js";
import { APP_CONFIG } from "./config/index.js";

process.on("SIGINT", () => {
  console.log("\n" + chalk.cyan(APP_CONFIG.thankYouMessage));
  process.exit(0);
});

const program = new Command();

program
  .name(APP_CONFIG.name)
  .description(APP_CONFIG.description)
  .version(APP_CONFIG.version);

program
  .command("create")
  .description("Create a new project with a specific stack")
  .argument("[stack]", "Stack ID (vite-react, next, express, npm-package)")
  .option("-n, --name <name>", "Project name")
  .option("-d, --directory <dir>", "Project directory")
  .option(
    "--package-manager <pm>",
    "Package manager (npm, pnpm, yarn, bun)",
    "npm",
  )
  .option("--git", "Initialize Git repository")
  .option("-y, --yes", "Accept defaults without prompts")
  .option("--debug", "Enable debug output")
  .action(async (stack, options) => {
    if (options.debug) {
      process.env.DEBUG = "true";
    }

    if (stack) {
      await createCommand(stack, options);
    } else {
      await initCommand(options);
    }
  });

program
  .command("init")
  .description("Initialize a new project interactively")
  .option("-y, --yes", "Accept defaults without prompts")
  .option(
    "--package-manager <pm>",
    "Package manager (npm, pnpm, yarn, bun)",
    "npm",
  )
  .option("--git", "Initialize Git repository")
  .option("--debug", "Enable debug output")
  .action(async (options) => {
    if (options.debug) {
      process.env.DEBUG = "true";
    }
    await initCommand(options);
  });

program.action(async (options) => {
  if (options.debug) {
    process.env.DEBUG = "true";
  }

  if (process.stdin.isTTY) {
    p.intro(
      chalk.cyan.bold(`${APP_CONFIG.displayName} CLI v${APP_CONFIG.version}`),
    );
    p.note(APP_CONFIG.description, "About");
  }

  await initCommand(options);
});

program.parse();
