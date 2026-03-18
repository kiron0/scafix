import { confirm } from "@clack/prompts";
import { join } from "path";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

export const viteReactAdapter: StackAdapter = {
  id: "vite",
  name: "Vite",
  description: "Scaffold any Vite project via the official create-vite CLI",
  backend: false,

  async create(options: CreateOptions): Promise<void> {
    const {
      projectName,
      directory = projectName,
      packageManager = "npm",
    } = options;

    if (!validateProjectName(projectName)) {
      throw new Error("Invalid project name");
    }

    const dirInfo = validateDirectory(directory);
    if (dirInfo.exists) {
      logger.warn(`The directory "${directory}" already exists.`);
      logger.info(
        `Please choose a different project name or remove the existing directory.`,
      );
      process.exit(1);
    }

    logger.info(`Launching Vite's official CLI for: ${projectName}`);
    logger.info("");

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: { cmd: "npm", args: ["create", "vite@latest", directory] },
      pnpm: { cmd: "pnpm", args: ["create", "vite", directory] },
      yarn: { cmd: "yarn", args: ["create", "vite", directory] },
      bun: { cmd: "bun", args: ["create", "vite", directory] },
    };

    const { cmd, args } = pmCommands[packageManager] ?? pmCommands.npm;

    await exec(cmd, args, { cwd: process.cwd(), stdio: "inherit" });

    logger.info("");
    const addShadcn = await confirm({
      message:
        "Would you like to add shadcn/ui? (only works with React-based templates)",
      initialValue: false,
    });

    if (addShadcn === true) {
      const projectPath = join(process.cwd(), directory);
      logger.info("");
      logger.info("Initialising shadcn/ui...");
      await exec("npx", ["shadcn@latest", "init"], {
        cwd: projectPath,
        stdio: "inherit",
      });
    }

    logger.info("");
    logger.info("Next steps:");
    logger.info(`  cd ${directory}`);
    logger.info(`  ${packageManager === "npm" ? "npm install" : `${packageManager} install`}`);
    logger.info(`  ${packageManager === "npm" ? "npm run dev" : `${packageManager} run dev`}`);
  },
};
