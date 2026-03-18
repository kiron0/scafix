import { confirm } from "@clack/prompts";
import { join } from "path";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

export const nextAdapter: StackAdapter = {
  id: "next",
  name: "Next.js",
  description:
    "Scaffold a Next.js project via the official create-next-app CLI",
  backend: true,

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

    logger.info(`Launching Next.js's official CLI for: ${projectName}`);
    logger.info("");

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: { cmd: "npx", args: ["create-next-app@latest", directory] },
      pnpm: { cmd: "pnpm", args: ["dlx", "create-next-app@latest", directory] },
      yarn: { cmd: "yarn", args: ["dlx", "create-next-app@latest", directory] },
      bun: { cmd: "bunx", args: ["create-next-app@latest", directory] },
    };

    const { cmd, args } = pmCommands[packageManager] ?? pmCommands.npm;

    await exec(cmd, args, { cwd: process.cwd(), stdio: "inherit" });

    // Optionally initialise shadcn/ui after the project is created
    logger.info("");
    const addShadcn = await confirm({
      message: "Would you like to add shadcn/ui?",
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
    logger.info(
      `  ${packageManager === "npm" ? "npm run dev" : `${packageManager} run dev`}`,
    );
  },
};
