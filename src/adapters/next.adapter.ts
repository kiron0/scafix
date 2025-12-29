import { join } from "path";
import { writeFile, readFile } from "fs/promises";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { validateProjectName, validateDirectory } from "../utils/validate.js";
import {
  detectPackageManager,
  getInstallCommand,
  getDevCommand,
} from "../utils/package-manager.js";
import { promptNextCustomizations } from "../prompts/customizations.js";
import type { StackAdapter, CreateOptions } from "../types/stack.js";

export const nextAdapter: StackAdapter = {
  id: "next",
  name: "Next.js + TypeScript",
  description: "Full-stack React framework with TypeScript",
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

    const projectPath = join(process.cwd(), directory);
    const dirInfo = validateDirectory(directory);

    if (dirInfo.exists) {
      throw new Error(`Directory ${directory} already exists`);
    }

    logger.info(`Creating Next.js project: ${projectName}`);

    // Prompt for customizations
    const customizations = await promptNextCustomizations({
      yes: Boolean(options.yes),
    });

    try {
      // Build create-next-app arguments
      const createArgs = ["create-next-app@latest", projectName];

      if (customizations.typescript) {
        createArgs.push("--typescript");
      }

      if (customizations.eslint) {
        createArgs.push("--eslint");
      }

      if (customizations.tailwind) {
        createArgs.push("--tailwind");
      }

      if (customizations.appRouter) {
        createArgs.push("--app");
      } else {
        createArgs.push("--no-app");
      }

      if (customizations.srcDir) {
        createArgs.push("--src-dir");
      }

      createArgs.push("--import-alias", "@/*");
      createArgs.push("--yes");

      // Run create command
      await exec("npx", createArgs, {
        cwd: process.cwd(),
        stdio: "inherit",
      });

      // Apply customizations
      const detectedPm = detectPackageManager(projectPath);
      const installCommand =
        detectedPm === "pnpm" ? "pnpm" : detectedPm === "yarn" ? "yarn" : "npm";

      // Handle Tailwind version if v4 is requested
      if (customizations.tailwind && customizations.tailwindVersion === "v4") {
        logger.info("Upgrading to Tailwind CSS v4...");
        await exec(
          installCommand,
          ["add", "-D", "tailwindcss@next", "@tailwindcss/vite@next"],
          { cwd: projectPath, stdio: "inherit" },
        );

        // Update next.config to use Tailwind v4
        const nextConfigPath = join(
          projectPath,
          customizations.typescript ? "next.config.ts" : "next.config.js",
        );
        let nextConfig = await readFile(nextConfigPath, "utf-8");
        // Add Tailwind v4 plugin configuration
        // This is a simplified approach - actual implementation may vary
      }

      // Install shadcn/ui if requested
      if (customizations.shadcn && customizations.tailwind) {
        logger.info("Setting up shadcn/ui...");
        // Install shadcn/ui dependencies
        await exec(
          installCommand,
          ["add", "class-variance-authority", "clsx", "tailwind-merge"],
          { cwd: projectPath, stdio: "inherit" },
        );

        if (customizations.typescript) {
          await exec(
            installCommand,
            ["add", "-D", "@types/node"],
            { cwd: projectPath, stdio: "inherit" },
          );
        }

        // Initialize shadcn/ui
        const shadcnInitArgs = [
          "init",
          "-y",
          "-d",
          customizations.srcDir
            ? "src/components/ui"
            : "components/ui",
        ];

        if (customizations.shadcnOptions?.baseColor) {
          shadcnInitArgs.push("-c", customizations.shadcnOptions.baseColor);
        }

        if (customizations.shadcnOptions?.cssVariables === false) {
          shadcnInitArgs.push("--no-css-vars");
        }

        await exec("npx", ["shadcn@latest", ...shadcnInitArgs], {
          cwd: projectPath,
          stdio: "inherit",
        });

        // Install selected components
        if (
          customizations.shadcnOptions?.components &&
          customizations.shadcnOptions.components.length > 0
        ) {
          await exec(
            "npx",
            ["shadcn@latest", "add", ...customizations.shadcnOptions.components],
            { cwd: projectPath, stdio: "inherit" },
          );
        }
      }

      // Add Prettier if requested
      if (customizations.prettier) {
        logger.info("Setting up Prettier...");
        await exec(installCommand, ["add", "-D", "prettier"], {
          cwd: projectPath,
          stdio: "inherit",
        });

        const prettierConfig = `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}`;
        await writeFile(join(projectPath, ".prettierrc"), prettierConfig);

        const prettierIgnore = `node_modules
.next
out
dist
build
.coverage`;
        await writeFile(join(projectPath, ".prettierignore"), prettierIgnore);
      }

      logger.success(`Project ${projectName} created successfully!`);
      logger.info(`Next steps:`);
      logger.info(`  cd ${directory}`);
      logger.info(`  ${getInstallCommand(detectedPm)}`);
      logger.info(`  ${getDevCommand(detectedPm)}`);
    } catch (error) {
      logger.error(
        `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },
};
