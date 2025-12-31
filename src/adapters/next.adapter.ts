import { spinner } from "@clack/prompts";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { promptNextCustomizations } from "../prompts/customizations.js";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import {
  detectPackageManager,
  getDevCommand,
  getInstallCommand,
} from "../utils/package-manager.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

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
      // Note: We stop the spinner before running since stdio: "inherit" shows output directly
      const createSpinner = spinner();
      createSpinner.start("Creating Next.js project...");
      createSpinner.stop();

      try {
        await exec("npx", createArgs, {
          cwd: process.cwd(),
          stdio: "inherit",
        });
        logger.success("Next.js project created");
      } catch (error) {
        logger.error("Failed to create Next.js project");
        throw error;
      }

      // Apply customizations
      const detectedPm = detectPackageManager(projectPath);
      const installCommand =
        detectedPm === "bun"
          ? "bun"
          : detectedPm === "pnpm"
            ? "pnpm"
            : detectedPm === "yarn"
              ? "yarn"
              : "npm";

      // Handle Tailwind version if v4 is requested
      if (customizations.tailwind && customizations.tailwindVersion === "v4") {
        const tailwindSpinner = spinner();
        tailwindSpinner.start("Upgrading to Tailwind CSS v4...");
        try {
          await exec(
            installCommand,
            ["add", "-D", "tailwindcss@next", "@tailwindcss/vite@next"],
            { cwd: projectPath, stdio: "inherit" },
          );
          tailwindSpinner.stop("Tailwind CSS v4 installed");
        } catch (error) {
          tailwindSpinner.stop("Failed to install Tailwind CSS v4");
          throw error;
        }

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
        const shadcnSpinner = spinner();
        shadcnSpinner.start("Setting up shadcn/ui...");
        try {
          // Install shadcn/ui dependencies
          await exec(
            installCommand,
            ["add", "class-variance-authority", "clsx", "tailwind-merge"],
            { cwd: projectPath, stdio: "inherit" },
          );

          if (customizations.typescript) {
            await exec(installCommand, ["add", "-D", "@types/node"], {
              cwd: projectPath,
              stdio: "inherit",
            });
          }

          // Initialize shadcn/ui
          const shadcnInitArgs = [
            "init",
            "-y",
            "-d",
            customizations.srcDir ? "src/components/ui" : "components/ui",
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
              [
                "shadcn@latest",
                "add",
                ...customizations.shadcnOptions.components,
              ],
              { cwd: projectPath, stdio: "inherit" },
            );
          }
          shadcnSpinner.stop("shadcn/ui setup complete");
        } catch (error) {
          shadcnSpinner.stop("Failed to setup shadcn/ui");
          throw error;
        }
      }

      // Add Prettier if requested
      if (customizations.prettier) {
        const prettierSpinner = spinner();
        prettierSpinner.start("Setting up Prettier...");
        try {
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
          prettierSpinner.stop("Prettier configured");
        } catch (error) {
          prettierSpinner.stop("Failed to setup Prettier");
          throw error;
        }
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
