import { cancel, confirm, select, text } from "@clack/prompts";
import chalk from "chalk";
import { APP_CONFIG } from "../config/index.js";
import { StackAdapter } from "../types/stack.js";

export async function selectStack(
  adapters: StackAdapter[],
  options: { yes?: boolean } = {},
): Promise<StackAdapter | null> {
  if (options.yes) {
    // Return first adapter as default when --yes is used
    return adapters[0] || null;
  }

  try {
    const response = await select({
      message: "Select a stack:",
      options: adapters.map((adapter) => ({
        label: `${adapter.name}${adapter.backend ? " (Backend)" : ""}`,
        hint: adapter.description,
        value: adapter,
      })),
    });

    if (typeof response === "symbol") {
      cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
      return null;
    }

    return response || null;
  } catch (error) {
    cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
    return null;
  }
}

export async function promptProjectName(
  options: { yes?: boolean; default?: string } = {},
): Promise<string | null> {
  if (options.yes && options.default) {
    return options.default;
  }

  try {
    const response = await text({
      message: "Project name:",
      initialValue: options.default || "my-project",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Project name cannot be empty";
        }
        return;
      },
    });

    if (typeof response === "symbol") {
      cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
      return null;
    }

    return response || null;
  } catch (error) {
    cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
    return null;
  }
}

export async function promptDirectory(
  projectName: string,
  options: { yes?: boolean } = {},
): Promise<string | null> {
  if (options.yes) {
    return projectName;
  }

  try {
    const response = await text({
      message: "Directory:",
      initialValue: projectName,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Directory cannot be empty";
        }
        return;
      },
    });

    if (typeof response === "symbol") {
      cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
      return null;
    }

    return response || null;
  } catch (error) {
    cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
    return null;
  }
}

export async function promptPackageManager(
  options: { yes?: boolean } = {},
): Promise<"npm" | "pnpm" | "yarn" | "bun" | null> {
  if (options.yes) {
    return "npm";
  }

  try {
    const response = await select({
      message: "Package manager:",
      options: [
        { label: "npm", value: "npm" },
        { label: "pnpm", value: "pnpm" },
        { label: "yarn", value: "yarn" },
        { label: "bun", value: "bun" },
      ],
    });

    if (typeof response === "symbol") {
      cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
      return null;
    }

    return response || null;
  } catch (error) {
    cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
    return null;
  }
}

export async function promptGit(
  options: { yes?: boolean } = {},
): Promise<boolean> {
  if (options.yes) {
    return false;
  }

  try {
    const response = await confirm({
      message: "Initialize Git repository?",
      initialValue: false,
    });

    if (typeof response === "symbol") {
      cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
      return false;
    }

    return response ?? false;
  } catch (error) {
    cancel(chalk.cyan(APP_CONFIG.thankYouMessage));
    return false;
  }
}
