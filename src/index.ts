import * as p from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import * as process from "process";
import { fileURLToPath } from "url";
import { createCommand } from "./commands/create.js";
import { initCommand } from "./commands/init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

function getPackageVersion(): string {
  return packageJson.version;
}

const program = new Command();

program
  .name("scafix")
  .description(
    "A universal scaffolding CLI that initializes modern application stacks",
  )
  .version(packageJson.version);

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
      // If no stack provided, fall back to interactive mode
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
    const version = getPackageVersion();
    p.intro(chalk.cyan.bold(`Scafix CLI v${version}`));
    p.note(
      "A universal scaffolding CLI that initializes modern application stacks through a single, consistent interface.",
      "About",
    );
  }

  await initCommand(options);
});

program.parse();
