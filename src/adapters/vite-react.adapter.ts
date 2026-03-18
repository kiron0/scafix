import { confirm, select, spinner } from "@clack/prompts";
import { access, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectViteConfigPath(
  projectPath: string,
): Promise<string | null> {
  const ts = join(projectPath, "vite.config.ts");
  const js = join(projectPath, "vite.config.js");
  if (await fileExists(ts)) return ts;
  if (await fileExists(js)) return js;
  return null;
}

async function patchViteConfig(configPath: string): Promise<void> {
  let content = await readFile(configPath, "utf-8");

  if (!content.includes("@tailwindcss/vite")) {
    const importMatch = content.match(/^(import[^\n]*\n)+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        `${importMatch[0]}import tailwindcss from "@tailwindcss/vite";\n`,
      );
    } else {
      content = `import tailwindcss from "@tailwindcss/vite";\n${content}`;
    }
  }

  if (!content.includes("tailwindcss()")) {
    const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\]/);
    if (pluginsMatch) {
      const body = pluginsMatch[1].trim();
      const sep = body.length > 0 && !body.endsWith(",") ? ", " : "";
      content = content.replace(
        pluginsMatch[0],
        `plugins: [${body}${sep}tailwindcss()]`,
      );
    }
  }

  await writeFile(configPath, content);
}

async function setupTailwindV4(
  projectPath: string,
  packageManager: string,
): Promise<void> {
  const s = spinner();
  s.start("Installing Tailwind CSS v4...");
  try {
    const devFlag =
      packageManager === "npm" ? ["--save-dev"] : ["-D"];
    await exec(
      packageManager === "npm" ? "npm" : packageManager,
      [
        packageManager === "npm" ? "install" : "add",
        ...devFlag,
        "tailwindcss",
        "@tailwindcss/vite",
      ],
      { cwd: projectPath, stdio: "pipe" },
    );
    s.stop("Tailwind CSS v4 installed");
  } catch (err) {
    s.stop("Failed to install Tailwind CSS v4");
    throw err;
  }

  const configPath = await detectViteConfigPath(projectPath);
  if (configPath) {
    await patchViteConfig(configPath);
    logger.debug("Patched vite.config to add tailwindcss() plugin");
  }

  const cssPath = join(projectPath, "src", "index.css");
  if (await fileExists(cssPath)) {
    let css = await readFile(cssPath, "utf-8");
    if (!css.includes('@import "tailwindcss"')) {
      css = `@import "tailwindcss";\n\n${css}`;
      await writeFile(cssPath, css);
    }
  }
}

async function setupTailwindV3(
  projectPath: string,
  packageManager: string,
): Promise<void> {
  const s = spinner();
  s.start("Installing Tailwind CSS v3...");
  try {
    const devFlag =
      packageManager === "npm" ? ["--save-dev"] : ["-D"];
    await exec(
      packageManager === "npm" ? "npm" : packageManager,
      [
        packageManager === "npm" ? "install" : "add",
        ...devFlag,
        "tailwindcss",
        "postcss",
        "autoprefixer",
      ],
      { cwd: projectPath, stdio: "pipe" },
    );
    s.stop("Tailwind CSS v3 installed");
  } catch (err) {
    s.stop("Failed to install Tailwind CSS v3");
    throw err;
  }

  await exec("npx", ["tailwindcss", "init", "-p"], {
    cwd: projectPath,
    stdio: "pipe",
  });

  await writeFile(
    join(projectPath, "tailwind.config.js"),
    `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
  );

  const cssPath = join(projectPath, "src", "index.css");
  if (await fileExists(cssPath)) {
    let css = await readFile(cssPath, "utf-8");
    if (!css.includes("@tailwind base")) {
      css = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n${css}`;
      await writeFile(cssPath, css);
    }
  }
}

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

    const projectPath = join(process.cwd(), directory);

    // --- Tailwind ---
    logger.info("");
    const addTailwind = await confirm({
      message: "Add Tailwind CSS?",
      initialValue: false,
    });

    let tailwindAdded = false;

    if (addTailwind === true) {
      const twVersion = await select({
        message: "Tailwind CSS version:",
        options: [
          { label: "v4 (Latest)", value: "v4" },
          { label: "v3 (Stable)", value: "v3" },
        ],
      });

      if (twVersion !== null && typeof twVersion !== "symbol") {
        if (twVersion === "v4") {
          await setupTailwindV4(projectPath, packageManager);
        } else {
          await setupTailwindV3(projectPath, packageManager);
        }
        tailwindAdded = true;
      }
    }

    // --- shadcn/ui (only if Tailwind was added — it requires it) ---
    if (tailwindAdded) {
      logger.info("");
      const addShadcn = await confirm({
        message: "Add shadcn/ui? (React-based projects only)",
        initialValue: false,
      });

      if (addShadcn === true) {
        const shadcnSpinner = spinner();
        shadcnSpinner.start("Initialising shadcn/ui...");
        shadcnSpinner.stop();
        await exec("npx", ["shadcn@latest", "init"], {
          cwd: projectPath,
          stdio: "inherit",
        });
      }
    }

    logger.info("");
    logger.info("Next steps:");
    logger.info(`  cd ${directory}`);
    logger.info(
      `  ${packageManager === "npm" ? "npm install" : `${packageManager} install`}`,
    );
    logger.info(
      `  ${packageManager === "npm" ? "npm run dev" : `${packageManager} run dev`}`,
    );
  },
};
