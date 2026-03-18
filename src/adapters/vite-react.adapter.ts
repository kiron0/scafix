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

async function writeShadcnStyles(
  projectPath: string,
  style: "default" | "new-york" = "default",
): Promise<void> {
  const cssPath = join(projectPath, "src", "index.css");

  // Theme tokens mirror the shadcn/ui defaults and bump the radius slightly
  // when the New York style is selected.
  const radius = style === "new-york" ? "0.75rem" : "0.5rem";
  const cssContent = `@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 16% 96%;
    --muted-foreground: 215 16% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20% 65.1%;
    --radius: ${radius};
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20.2% 65.1%;
    --radius: ${radius};
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    font-variant-ligatures: common-ligatures;
  }
}
`;

  await writeFile(cssPath, cssContent);
}

async function updateViteAppExample(
  projectPath: string,
  typescript: boolean,
  useShadcnExample: boolean,
): Promise<void> {
  if (!useShadcnExample) {
    return;
  }

  const appPath = join(projectPath, "src", `App.${typescript ? "tsx" : "jsx"}`);
  const current = await readFile(appPath, "utf-8");

  // Only replace the default template to avoid clobbering user edits.
  if (!current.includes("Vite + React")) {
    return;
  }

  const appContent = `import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <Card className="w-full max-w-xl shadow-sm">
        <CardHeader>
          <CardTitle>Scafix starter</CardTitle>
          <CardDescription>
            Vite + React + Tailwind CSS v4 with shadcn/ui (New York)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tailwind, CSS variables, and component aliases are preconfigured.
          </p>
          <div className="flex gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Secondary</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
`;

  await writeFile(appPath, appContent);
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
      const separator =
        pluginsBody.length > 0 && !pluginsBody.endsWith(",")
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
        `defineConfig({\n  resolve: {\n    alias: {\n      "@": path.resolve(process.cwd(), "./src"),\n    },\n  },`,
      );
    }
  }

  await writeFile(viteConfigPath, viteConfig);
}

async function setupPrettier(
  projectPath: string,
  installCommand: string,
): Promise<void> {
  const prettierArgs =
    installCommand === "npm"
      ? ["install", "--save-dev", "prettier"]
      : installCommand === "bun"
        ? ["add", "-d", "prettier"]
        : ["add", "-D", "prettier"];

  await exec(installCommand, prettierArgs, {
    cwd: projectPath,
    stdio: "inherit",
  });

  const prettierConfig = `{
  "singleQuote": false,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
`;
  const prettierIgnore = `node_modules
dist
build
.coverage
`;

  await writeFile(join(projectPath, ".prettierrc"), prettierConfig);
  await writeFile(join(projectPath, ".prettierignore"), prettierIgnore);
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
      logger.warn(`The directory "${directory}" already exists.`);
      logger.info(
        `Please choose a different project name or remove the existing directory.`,
      );
      process.exit(1);
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
          ? [
              "create",
              "vite@latest",
              directory,
              "--template",
              template,
              "--yes",
            ]
          : packageManager === "pnpm"
            ? [
                "create",
                "vite@latest",
                directory,
                "--template",
                template,
                "--yes",
              ]
            : packageManager === "yarn"
              ? [
                  "create",
                  "vite@latest",
                  directory,
                  "--template",
                  template,
                  "--yes",
                ]
              : [
                  "create",
                  "vite@latest",
                  directory,
                  "--template",
                  template,
                  "--yes",
                ];

      // Run create command in current directory
      logger.info("Creating Vite project...");
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

      const installBaseSpinner = spinner();
      installBaseSpinner.start("Installing dependencies...");
      try {
        const installArgs =
          installCommand === "npm"
            ? ["install"]
            : installCommand === "bun"
              ? ["install"]
              : ["install"];
        await exec(installCommand, installArgs, {
          cwd: projectPath,
          stdio: "inherit",
        });
        installBaseSpinner.stop("Dependencies installed");
      } catch (error) {
        installBaseSpinner.stop("Failed to install dependencies");
        throw error;
      }

      // Install Tailwind CSS if requested
      if (customizations.tailwind) {
        const tailwindSpinner = spinner();
        tailwindSpinner.start("Installing Tailwind CSS...");
        try {
          if (customizations.tailwindVersion === "v4") {
            // Tailwind v4 - following official docs: https://tailwindcss.com/docs/installation/using-vite
            const tailwindArgs =
              installCommand === "npm"
                ? ["install", "--save-dev", "tailwindcss", "@tailwindcss/vite"]
                : installCommand === "bun"
                  ? ["add", "-d", "tailwindcss", "@tailwindcss/vite"]
                  : ["add", "-D", "tailwindcss", "@tailwindcss/vite"];
            await exec(installCommand, tailwindArgs, {
              cwd: projectPath,
              stdio: "inherit",
            });
          } else {
            // Tailwind v3
            const tailwindArgs =
              installCommand === "npm"
                ? [
                    "install",
                    "--save-dev",
                    "tailwindcss",
                    "postcss",
                    "autoprefixer",
                  ]
                : installCommand === "bun"
                  ? ["add", "-d", "tailwindcss", "postcss", "autoprefixer"]
                  : ["add", "-D", "tailwindcss", "postcss", "autoprefixer"];
            await exec(installCommand, tailwindArgs, {
              cwd: projectPath,
              stdio: "inherit",
            });
          }
          tailwindSpinner.stop("Tailwind CSS installed");
        } catch (error) {
          tailwindSpinner.stop("Failed to install Tailwind CSS");
          throw error;
        }
      }

      // Configure Tailwind if added
      if (customizations.tailwind) {
        const tailwindConfigSpinner = spinner();
        tailwindConfigSpinner.start("Configuring Tailwind CSS...");
        try {
          if (customizations.tailwindVersion === "v4") {
            // Tailwind v4 configuration
            await updateViteConfig(projectPath, customizations.typescript, {
              addTailwindPlugin: true,
            });

            // Add Tailwind directives to CSS
            const cssPath = join(projectPath, "src", "index.css");
            let cssContent = await readFile(cssPath, "utf-8");
            // Only add if not already present
            if (
              !cssContent.includes('@import "tailwindcss"') &&
              !cssContent.includes("@import 'tailwindcss'")
            ) {
              cssContent = `@import "tailwindcss";\n\n${cssContent}`;
              await writeFile(cssPath, cssContent);
            }
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
            // Only add if not already present
            if (!cssContent.includes("@tailwind base")) {
              cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

${cssContent}`;
              await writeFile(cssPath, cssContent);
            }
          }
          tailwindConfigSpinner.stop("Tailwind CSS configured");
        } catch (error) {
          tailwindConfigSpinner.stop("Failed to configure Tailwind CSS");
          throw error;
        }
      }

      // Install shadcn/ui if requested
      if (customizations.shadcn && customizations.tailwind) {
        const shadcnSpinner = spinner();
        shadcnSpinner.start("Setting up shadcn/ui...");
        try {
          // Ensure @types/node is installed for TypeScript projects
          if (customizations.typescript) {
            const typesNodeArgs =
              installCommand === "npm"
                ? ["install", "--save-dev", "@types/node"]
                : installCommand === "bun"
                  ? ["add", "-d", "@types/node"]
                  : ["add", "-D", "@types/node"];
            await exec(installCommand, typesNodeArgs, {
              cwd: projectPath,
              stdio: "inherit",
            });
          }

          // Ensure path alias is configured before shadcn init
          await ensureViteTsconfigAlias(projectPath, customizations.typescript);
          await updateViteConfig(projectPath, customizations.typescript, {
            addAlias: true,
          });

          // Build shadcn init command with user-selected options
          const shadcnInitArgs = [
            "shadcn@latest",
            "init",
            "-y",
            "--template",
            "vite",
          ];

          if (customizations.shadcnOptions?.baseColor) {
            shadcnInitArgs.push(
              "--base-color",
              customizations.shadcnOptions.baseColor,
            );
          }

          if (customizations.shadcnOptions?.style) {
            shadcnInitArgs.push("--style", customizations.shadcnOptions.style);
          }

          if (customizations.shadcnOptions?.cssVariables === false) {
            shadcnInitArgs.push("--no-css-variables");
          } else {
            shadcnInitArgs.push("--css-variables");
          }

          // Initialize shadcn/ui with user options via CLI
          await exec("npx", shadcnInitArgs, {
            cwd: projectPath,
            stdio: "inherit",
          });

          // Update components.json for style (since CLI doesn't have --style flag)
          if (customizations.shadcnOptions?.style) {
            const componentsJsonPath = join(projectPath, "components.json");
            if (await fileExists(componentsJsonPath)) {
              const componentsJson = JSON.parse(
                await readFile(componentsJsonPath, "utf-8"),
              );
              componentsJson.style = customizations.shadcnOptions.style;
              await writeFile(
                componentsJsonPath,
                JSON.stringify(componentsJson, null, 2),
              );
            }
          }

          // Install selected components using official CLI
          if (
            customizations.shadcnOptions?.components &&
            customizations.shadcnOptions.components.length > 0
          ) {
            const shadcnAddArgs = [
              "shadcn@latest",
              "add",
              "-y",
              ...customizations.shadcnOptions.components,
            ];
            await exec("npx", shadcnAddArgs, {
              cwd: projectPath,
              stdio: "inherit",
            });
          }

          if (customizations.tailwindVersion === "v4") {
            await writeShadcnStyles(
              projectPath,
              customizations.shadcnOptions?.style ?? "default",
            );
          }

          const components = customizations.shadcnOptions?.components ?? [];
          const hasButton = components.includes("button");
          const hasCard = components.includes("card");
          await updateViteAppExample(
            projectPath,
            customizations.typescript,
            hasButton && hasCard,
          );

          shadcnSpinner.stop("shadcn/ui setup complete");
        } catch (error) {
          shadcnSpinner.stop("Failed to setup shadcn/ui");
          throw error;
        }
      }

      // Add Prettier if requested
      if (customizations.prettier) {
        const prettierSpinner = spinner();
        prettierSpinner.start("Installing Prettier...");
        try {
          await setupPrettier(projectPath, installCommand);
          prettierSpinner.stop("Prettier installed");
        } catch (error) {
          prettierSpinner.stop("Failed to install Prettier");
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
