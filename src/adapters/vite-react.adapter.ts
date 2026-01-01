import { spinner } from "@clack/prompts";
import { access, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { promptViteReactCustomizations } from "../prompts/customizations.js";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import {
  detectPackageManager,
  getDevCommand,
  getInstallCommand,
} from "../utils/package-manager.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureViteTsconfigAlias(
  projectPath: string,
  typescript: boolean,
): Promise<void> {
  const configPath = typescript
    ? (await fileExists(join(projectPath, "tsconfig.app.json")))
      ? join(projectPath, "tsconfig.app.json")
      : join(projectPath, "tsconfig.json")
    : join(projectPath, "jsconfig.json");

  let config: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    const raw = await readFile(configPath, "utf-8");
    config = JSON.parse(raw);
  }

  const compilerOptions =
    (config.compilerOptions as Record<string, unknown> | undefined) ?? {};
  if (!compilerOptions.baseUrl) {
    compilerOptions.baseUrl = ".";
  }
  const paths =
    (compilerOptions.paths as Record<string, string[] | undefined>) ?? {};
  if (!paths["@/*"]) {
    paths["@/*"] = ["./src/*"];
  }
  compilerOptions.paths = paths;
  config.compilerOptions = compilerOptions;

  await writeFile(configPath, JSON.stringify(config, null, 2));
}

async function updateViteConfig(
  projectPath: string,
  typescript: boolean,
  options: { addTailwindPlugin?: boolean; addAlias?: boolean },
): Promise<void> {
  const viteConfigPath = join(
    projectPath,
    typescript ? "vite.config.ts" : "vite.config.js",
  );
  let viteConfig = await readFile(viteConfigPath, "utf-8");

  if (options.addTailwindPlugin && !viteConfig.includes("@tailwindcss/vite")) {
    const importsMatch = viteConfig.match(/^(import[^\n]*\n)+/m);
    if (importsMatch) {
      viteConfig = viteConfig.replace(
        importsMatch[0],
        `${importsMatch[0]}import tailwindcss from "@tailwindcss/vite";\n`,
      );
    } else {
      viteConfig = `import tailwindcss from "@tailwindcss/vite";\n${viteConfig}`;
    }
  }

  if (
    options.addAlias &&
    !viteConfig.includes('from "path"') &&
    !viteConfig.includes("from 'path'")
  ) {
    const importsMatch = viteConfig.match(/^(import[^\n]*\n)+/m);
    if (importsMatch) {
      viteConfig = viteConfig.replace(
        importsMatch[0],
        `${importsMatch[0]}import path from "path";\n`,
      );
    } else {
      viteConfig = `import path from "path";\n${viteConfig}`;
    }
  }

  if (options.addTailwindPlugin && !viteConfig.includes("tailwindcss()")) {
    const pluginsMatch = viteConfig.match(/plugins:\s*\[([\s\S]*?)\]/);
    if (pluginsMatch) {
      const pluginsBody = pluginsMatch[1].trim();
      const separator = pluginsBody.length > 0 && !pluginsBody.endsWith(",")
        ? ", "
        : pluginsBody.length > 0
          ? " "
          : "";
      const updatedPluginsBody = `${pluginsBody}${separator}tailwindcss()`;
      viteConfig = viteConfig.replace(
        pluginsMatch[0],
        `plugins: [${updatedPluginsBody}]`,
      );
    }
  }

  if (options.addAlias && !viteConfig.includes("alias")) {
    if (viteConfig.includes("defineConfig({")) {
      viteConfig = viteConfig.replace(
        "defineConfig({",
        `defineConfig({\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },`,
      );
    }
  }

  await writeFile(viteConfigPath, viteConfig);
}

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
        packageManager === "bun"
          ? "bun"
          : packageManager === "pnpm"
            ? "pnpm"
            : packageManager === "yarn"
              ? "yarn"
              : "npm";
      const createArgs =
        packageManager === "bun"
          ? ["create", "vite@latest", directory, "--template", template]
          : packageManager === "pnpm"
            ? ["create", "vite@latest", directory, "--template", template]
            : packageManager === "yarn"
              ? ["create", "vite@latest", directory, "--template", template]
              : ["create", "vite@latest", directory, "--template", template];

      // Run create command in current directory
      // Note: We stop the spinner before running since stdio: "inherit" shows output directly
      const createSpinner = spinner();
      createSpinner.start("Creating Vite project...");
      createSpinner.stop();

      try {
        await exec(createCommand, createArgs, {
          cwd: process.cwd(),
          stdio: "inherit",
        });
        logger.success("Vite project created");
      } catch (error) {
        logger.error("Failed to create Vite project");
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

      // Install Tailwind CSS if requested
      if (customizations.tailwind) {
        const tailwindSpinner = spinner();
        tailwindSpinner.start("Installing Tailwind CSS...");
        try {
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
          tailwindSpinner.stop("Tailwind CSS installed");
        } catch (error) {
          tailwindSpinner.stop("Failed to install Tailwind CSS");
          throw error;
        }
      }

      // Configure Tailwind if added
      if (customizations.tailwind) {
        if (customizations.tailwindVersion === "v4") {
          // Tailwind v4 configuration
          await updateViteConfig(projectPath, customizations.typescript, {
            addTailwindPlugin: true,
          });

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
          const tailwindConfigSpinner = spinner();
          tailwindConfigSpinner.start("Configuring Tailwind CSS...");
          try {
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
            tailwindConfigSpinner.stop("Tailwind CSS configured");
          } catch (error) {
            tailwindConfigSpinner.stop("Failed to configure Tailwind CSS");
            throw error;
          }
        }
      }

      // Install shadcn/ui if requested
      if (customizations.shadcn && customizations.tailwind) {
        const shadcnSpinner = spinner();
        shadcnSpinner.start("Setting up shadcn/ui...");
        try {
          if (customizations.typescript) {
            await exec(installCommand, ["add", "-D", "@types/node"], {
              cwd: projectPath,
              stdio: "inherit",
            });
          }

          await ensureViteTsconfigAlias(
            projectPath,
            customizations.typescript,
          );
          await updateViteConfig(projectPath, customizations.typescript, {
            addAlias: true,
          });

          // Initialize shadcn/ui
          await exec("npx", ["shadcn@latest", "init"], {
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
