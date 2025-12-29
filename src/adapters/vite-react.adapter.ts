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
import { promptViteReactCustomizations } from "../prompts/customizations.js";
import type { StackAdapter, CreateOptions } from "../types/stack.js";

export const viteReactAdapter: StackAdapter = {
  id: "vite-react",
  name: "Vite + React + TypeScript",
  description: "Modern React application with Vite and TypeScript",
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

    const projectPath = join(process.cwd(), directory);
    const dirInfo = validateDirectory(directory);

    if (dirInfo.exists) {
      throw new Error(`Directory ${directory} already exists`);
    }

    logger.info(`Creating Vite + React project: ${projectName}`);

    // Prompt for customizations
    const customizations = await promptViteReactCustomizations({
      yes: Boolean(options.yes),
    });

    try {
      // Determine template based on TypeScript choice
      const template = customizations.typescript ? "react-ts" : "react";

      // Use npm create vite@latest to scaffold the project
      const createCommand =
        packageManager === "pnpm"
          ? "pnpm"
          : packageManager === "yarn"
            ? "yarn"
            : "npm";
      const createArgs =
        packageManager === "pnpm"
          ? ["create", "vite@latest", directory, "--template", template]
          : packageManager === "yarn"
            ? ["create", "vite@latest", directory, "--template", template]
            : ["create", "vite@latest", directory, "--", "--template", template];

      // Run create command in current directory
      await exec(createCommand, createArgs, {
        cwd: process.cwd(),
        stdio: "inherit",
      });

      // Apply customizations
      const detectedPm = detectPackageManager(projectPath);
      const installCommand =
        detectedPm === "pnpm" ? "pnpm" : detectedPm === "yarn" ? "yarn" : "npm";

      // Install Tailwind CSS if requested
      if (customizations.tailwind) {
        logger.info("Installing Tailwind CSS...");
        if (customizations.tailwindVersion === "v4") {
          // Tailwind v4
          await exec(
            installCommand,
            ["add", "-D", "tailwindcss@next", "@tailwindcss/vite@next"],
            { cwd: projectPath, stdio: "inherit" },
          );
        } else {
          // Tailwind v3
          await exec(
            installCommand,
            ["add", "-D", "tailwindcss", "postcss", "autoprefixer"],
            { cwd: projectPath, stdio: "inherit" },
          );
        }
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
          customizations.shadcnOptions?.style === "new-york"
            ? "src/lib/utils.ts"
            : "src/lib/utils.ts",
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

      // Configure Tailwind if added
      if (customizations.tailwind) {
        if (customizations.tailwindVersion === "v4") {
          // Tailwind v4 configuration
          const viteConfigPath = join(projectPath, "vite.config.ts");
          let viteConfig = await readFile(viteConfigPath, "utf-8");
          viteConfig = viteConfig.replace(
            /import\s+.*from\s+['"]vite['"]/,
            `import { defineConfig } from 'vite'\nimport tailwindcss from '@tailwindcss/vite'`,
          );
          viteConfig = viteConfig.replace(
            /export\s+default\s+defineConfig\(/,
            `export default defineConfig({\n  plugins: [tailwindcss()],`,
          );
          await writeFile(viteConfigPath, viteConfig);

          // Add Tailwind directives to CSS
          const cssPath = join(
            projectPath,
            customizations.typescript ? "src" : "src",
            "index.css",
          );
          let cssContent = await readFile(cssPath, "utf-8");
          cssContent = `@import "tailwindcss";\n\n${cssContent}`;
          await writeFile(cssPath, cssContent);
        } else {
          // Tailwind v3 - initialize config
          await exec("npx", ["tailwindcss", "init", "-p"], {
            cwd: projectPath,
            stdio: "inherit",
          });

          // Update tailwind.config
          const tailwindConfigPath = join(projectPath, "tailwind.config.js");
          const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
          await writeFile(tailwindConfigPath, tailwindConfig);

          // Add Tailwind directives to CSS
          const cssPath = join(projectPath, "src", "index.css");
          let cssContent = await readFile(cssPath, "utf-8");
          cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

${cssContent}`;
          await writeFile(cssPath, cssContent);
        }
      }

      // Add Prettier if requested
      if (customizations.prettier) {
        logger.info("Setting up Prettier...");
        await exec(
          installCommand,
          ["add", "-D", "prettier"],
          { cwd: projectPath, stdio: "inherit" },
        );

        const prettierConfig = `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}`;
        await writeFile(
          join(projectPath, ".prettierrc"),
          prettierConfig,
        );

        const prettierIgnore = `node_modules
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
