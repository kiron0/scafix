import { select, confirm, multiselect } from "@clack/prompts";
import { logger } from "../utils/logger.js";

export interface ViteReactCustomizations {
  typescript: boolean;
  tailwind: boolean;
  tailwindVersion?: "v3" | "v4";
  shadcn: boolean;
  shadcnOptions?: {
    style?: "default" | "new-york";
    baseColor?: "slate" | "gray" | "zinc" | "neutral" | "stone";
    cssVariables?: boolean;
    components?: string[];
  };
  eslint: boolean;
  prettier: boolean;
}

export interface NextCustomizations {
  typescript: boolean;
  tailwind: boolean;
  tailwindVersion?: "v3" | "v4";
  shadcn: boolean;
  shadcnOptions?: {
    style?: "default" | "new-york";
    baseColor?: "slate" | "gray" | "zinc" | "neutral" | "stone";
    cssVariables?: boolean;
    components?: string[];
  };
  eslint: boolean;
  prettier: boolean;
  appRouter: boolean;
  srcDir: boolean;
}

export interface ExpressCustomizations {
  typescript: boolean;
  pattern: "mvc" | "rest" | "layered" | "simple";
  eslint: boolean;
  prettier: boolean;
  cors: boolean;
  helmet: boolean;
  dotenv: boolean;
}

export interface NpmPackageCustomizations {
  typescript: boolean;
  buildTool: "tsup" | "rollup" | "esbuild" | "none";
  eslint: boolean;
  prettier: boolean;
  tests: boolean;
}

export async function promptViteReactCustomizations(
  options: { yes?: boolean } = {},
): Promise<ViteReactCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      tailwind: false,
      shadcn: false,
      eslint: true,
      prettier: false,
    };
  }

  try {
    const customizations: ViteReactCustomizations = {
      typescript: true,
      tailwind: false,
      shadcn: false,
      eslint: true,
      prettier: false,
    };

    // TypeScript or JavaScript
    const tsResponse = await select({
      message: "Use TypeScript?",
      options: [
        { label: "Yes", value: true },
        { label: "No (JavaScript)", value: false },
      ],
    });
    if (typeof tsResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.typescript = tsResponse ?? true;

    // Tailwind CSS
    const tailwindResponse = await confirm({
      message: "Add Tailwind CSS?",
      initialValue: false,
    });
    if (typeof tailwindResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.tailwind = tailwindResponse ?? false;

    if (customizations.tailwind) {
      const tailwindVersionResponse = await select({
        message: "Tailwind CSS version:",
        options: [
          { label: "v4 (Latest)", value: "v4" },
          { label: "v3 (Stable)", value: "v3" },
        ],
      });
      if (typeof tailwindVersionResponse === "symbol") {
        throw new Error("Prompt cancelled");
      }
      customizations.tailwindVersion = tailwindVersionResponse ?? "v4";
    }

    // Shadcn UI
    if (customizations.tailwind) {
      const shadcnResponse = await confirm({
        message: "Add shadcn/ui?",
        initialValue: false,
      });
      if (typeof shadcnResponse === "symbol") {
        throw new Error("Prompt cancelled");
      }
      customizations.shadcn = shadcnResponse ?? false;

      if (customizations.shadcn) {
        const shadcnOptions: ViteReactCustomizations["shadcnOptions"] = {};

        // Style
        const styleResponse = await select({
          message: "shadcn/ui style:",
          options: [
            { label: "Default", value: "default" },
            { label: "New York", value: "new-york" },
          ],
        });
        if (typeof styleResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.style = styleResponse ?? "default";

        // Base color
        const colorResponse = await select({
          message: "Base color:",
          options: [
            { label: "Slate", value: "slate" },
            { label: "Gray", value: "gray" },
            { label: "Zinc", value: "zinc" },
            { label: "Neutral", value: "neutral" },
            { label: "Stone", value: "stone" },
          ],
        });
        if (typeof colorResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.baseColor = colorResponse ?? "slate";

        // CSS Variables
        const cssVarsResponse = await confirm({
          message: "Use CSS variables for theming?",
          initialValue: true,
        });
        if (typeof cssVarsResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.cssVariables = cssVarsResponse ?? true;

        // Components (multi-select)
        const componentsResponse = await multiselect({
          message: "Select shadcn/ui components to install:",
          options: [
            { label: "Button", value: "button" },
            { label: "Card", value: "card" },
            { label: "Input", value: "input" },
            { label: "Label", value: "label" },
            { label: "Dialog", value: "dialog" },
            { label: "Dropdown Menu", value: "dropdown-menu" },
            { label: "Select", value: "select" },
            { label: "Tabs", value: "tabs" },
            { label: "Toast", value: "toast" },
            { label: "Avatar", value: "avatar" },
          ],
        });
        if (typeof componentsResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.components = componentsResponse ?? [];

        customizations.shadcnOptions = shadcnOptions;
      }
    }

    // ESLint
    const eslintResponse = await confirm({
      message: "Add ESLint?",
      initialValue: true,
    });
    if (typeof eslintResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.eslint = eslintResponse ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: "Add Prettier?",
      initialValue: false,
    });
    if (typeof prettierResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.prettier = prettierResponse ?? false;

    return customizations;
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`);
    return {
      typescript: true,
      tailwind: false,
      shadcn: false,
      eslint: true,
      prettier: false,
    };
  }
}

export async function promptNextCustomizations(
  options: { yes?: boolean } = {},
): Promise<NextCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      tailwind: true,
      tailwindVersion: "v4",
      shadcn: false,
      eslint: true,
      prettier: false,
      appRouter: true,
      srcDir: true,
    };
  }

  try {
    const customizations: NextCustomizations = {
      typescript: true,
      tailwind: true,
      tailwindVersion: "v4",
      shadcn: false,
      eslint: true,
      prettier: false,
      appRouter: true,
      srcDir: true,
    };

    // TypeScript
    const tsResponse = await select({
      message: "Use TypeScript?",
      options: [
        { label: "Yes", value: true },
        { label: "No (JavaScript)", value: false },
      ],
    });
    if (typeof tsResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.typescript = tsResponse ?? true;

    // Tailwind CSS
    const tailwindResponse = await confirm({
      message: "Add Tailwind CSS?",
      initialValue: true,
    });
    if (typeof tailwindResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.tailwind = tailwindResponse ?? true;

    if (customizations.tailwind) {
      const tailwindVersionResponse = await select({
        message: "Tailwind CSS version:",
        options: [
          { label: "v4 (Latest)", value: "v4" },
          { label: "v3 (Stable)", value: "v3" },
        ],
      });
      if (typeof tailwindVersionResponse === "symbol") {
        throw new Error("Prompt cancelled");
      }
      customizations.tailwindVersion = tailwindVersionResponse ?? "v4";
    }

    // Shadcn UI
    if (customizations.tailwind) {
      const shadcnResponse = await confirm({
        message: "Add shadcn/ui?",
        initialValue: false,
      });
      if (typeof shadcnResponse === "symbol") {
        throw new Error("Prompt cancelled");
      }
      customizations.shadcn = shadcnResponse ?? false;

      if (customizations.shadcn) {
        const shadcnOptions: NextCustomizations["shadcnOptions"] = {};

        const styleResponse = await select({
          message: "shadcn/ui style:",
          options: [
            { label: "Default", value: "default" },
            { label: "New York", value: "new-york" },
          ],
        });
        if (typeof styleResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.style = styleResponse ?? "default";

        const colorResponse = await select({
          message: "Base color:",
          options: [
            { label: "Slate", value: "slate" },
            { label: "Gray", value: "gray" },
            { label: "Zinc", value: "zinc" },
            { label: "Neutral", value: "neutral" },
            { label: "Stone", value: "stone" },
          ],
        });
        if (typeof colorResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.baseColor = colorResponse ?? "slate";

        const cssVarsResponse = await confirm({
          message: "Use CSS variables for theming?",
          initialValue: true,
        });
        if (typeof cssVarsResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.cssVariables = cssVarsResponse ?? true;

        const componentsResponse = await multiselect({
          message: "Select shadcn/ui components to install:",
          options: [
            { label: "Button", value: "button" },
            { label: "Card", value: "card" },
            { label: "Input", value: "input" },
            { label: "Label", value: "label" },
            { label: "Dialog", value: "dialog" },
            { label: "Dropdown Menu", value: "dropdown-menu" },
            { label: "Select", value: "select" },
            { label: "Tabs", value: "tabs" },
            { label: "Toast", value: "toast" },
            { label: "Avatar", value: "avatar" },
          ],
        });
        if (typeof componentsResponse === "symbol") {
          throw new Error("Prompt cancelled");
        }
        shadcnOptions.components = componentsResponse ?? [];

        customizations.shadcnOptions = shadcnOptions;
      }
    }

    // ESLint
    const eslintResponse = await confirm({
      message: "Add ESLint?",
      initialValue: true,
    });
    if (typeof eslintResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.eslint = eslintResponse ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: "Add Prettier?",
      initialValue: false,
    });
    if (typeof prettierResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.prettier = prettierResponse ?? false;

    // App Router
    const appRouterResponse = await confirm({
      message: "Use App Router?",
      initialValue: true,
    });
    if (typeof appRouterResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.appRouter = appRouterResponse ?? true;

    // src directory
    const srcDirResponse = await confirm({
      message: "Use src/ directory?",
      initialValue: true,
    });
    if (typeof srcDirResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.srcDir = srcDirResponse ?? true;

    return customizations;
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`);
    return {
      typescript: true,
      tailwind: true,
      tailwindVersion: "v4",
      shadcn: false,
      eslint: true,
      prettier: false,
      appRouter: true,
      srcDir: true,
    };
  }
}

export async function promptExpressCustomizations(
  options: { yes?: boolean } = {},
): Promise<ExpressCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      pattern: "mvc",
      eslint: true,
      prettier: false,
      cors: false,
      helmet: false,
      dotenv: true,
    };
  }

  try {
    const customizations: ExpressCustomizations = {
      typescript: true,
      pattern: "mvc",
      eslint: true,
      prettier: false,
      cors: false,
      helmet: false,
      dotenv: true,
    };

    // TypeScript
    const tsResponse = await select({
      message: "Use TypeScript?",
      options: [
        { label: "Yes", value: true },
        { label: "No (JavaScript)", value: false },
      ],
    });
    if (typeof tsResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.typescript = tsResponse ?? true;

    // Architecture Pattern
    const patternResponse = await select({
      message: "Select architecture pattern:",
      options: [
        {
          label: "MVC (Model-View-Controller)",
          hint: "Separates concerns into models, views, and controllers",
          value: "mvc",
        },
        {
          label: "REST API",
          hint: "RESTful API with routes, controllers, and services",
          value: "rest",
        },
        {
          label: "Layered Architecture",
          hint: "Presentation, Business, and Data layers",
          value: "layered",
        },
        {
          label: "Simple",
          hint: "Minimal structure with routes and middleware",
          value: "simple",
        },
      ],
    });
    if (typeof patternResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.pattern = patternResponse ?? "mvc";

    // ESLint
    const eslintResponse = await confirm({
      message: "Add ESLint?",
      initialValue: true,
    });
    if (typeof eslintResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.eslint = eslintResponse ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: "Add Prettier?",
      initialValue: false,
    });
    if (typeof prettierResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.prettier = prettierResponse ?? false;

    // CORS
    const corsResponse = await confirm({
      message: "Add CORS support?",
      initialValue: false,
    });
    if (typeof corsResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.cors = corsResponse ?? false;

    // Helmet
    const helmetResponse = await confirm({
      message: "Add Helmet (security headers)?",
      initialValue: false,
    });
    if (typeof helmetResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.helmet = helmetResponse ?? false;

    // dotenv
    const dotenvResponse = await confirm({
      message: "Add dotenv for environment variables?",
      initialValue: true,
    });
    if (typeof dotenvResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.dotenv = dotenvResponse ?? true;

    return customizations;
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`);
    return {
      typescript: true,
      pattern: "mvc",
      eslint: true,
      prettier: false,
      cors: false,
      helmet: false,
      dotenv: true,
    };
  }
}

export async function promptNpmPackageCustomizations(
  options: { yes?: boolean } = {},
): Promise<NpmPackageCustomizations> {
  if (options.yes) {
    return {
      typescript: true,
      buildTool: "tsup",
      eslint: true,
      prettier: false,
      tests: false,
    };
  }

  try {
    const customizations: NpmPackageCustomizations = {
      typescript: true,
      buildTool: "tsup",
      eslint: true,
      prettier: false,
      tests: false,
    };

    // TypeScript
    const tsResponse = await select({
      message: "Use TypeScript?",
      options: [
        { label: "Yes", value: true },
        { label: "No (JavaScript)", value: false },
      ],
    });
    if (typeof tsResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.typescript = tsResponse ?? true;

    // Build tool (only ask if TypeScript is selected)
    if (customizations.typescript) {
      const buildToolResponse = await select({
        message: "Select build tool:",
        options: [
          {
            label: "tsup",
            hint: "Fast, zero-config bundler (Recommended)",
            value: "tsup",
          },
          {
            label: "Rollup",
            hint: "Module bundler with tree-shaking",
            value: "rollup",
          },
          {
            label: "esbuild",
            hint: "Extremely fast JavaScript bundler",
            value: "esbuild",
          },
          {
            label: "None (TypeScript compiler only)",
            hint: "Use tsc directly",
            value: "none",
          },
        ],
      });
      if (typeof buildToolResponse === "symbol") {
        throw new Error("Prompt cancelled");
      }
      customizations.buildTool = buildToolResponse ?? "tsup";
    }

    // ESLint
    const eslintResponse = await confirm({
      message: "Add ESLint?",
      initialValue: true,
    });
    if (typeof eslintResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.eslint = eslintResponse ?? true;

    // Prettier
    const prettierResponse = await confirm({
      message: "Add Prettier?",
      initialValue: false,
    });
    if (typeof prettierResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.prettier = prettierResponse ?? false;

    // Tests
    const testsResponse = await confirm({
      message: "Add test setup (Vitest)?",
      initialValue: false,
    });
    if (typeof testsResponse === "symbol") {
      throw new Error("Prompt cancelled");
    }
    customizations.tests = testsResponse ?? false;

    return customizations;
  } catch (error) {
    logger.debug(`Prompt cancelled: ${error}`);
    return {
      typescript: true,
      buildTool: "tsup",
      eslint: true,
      prettier: false,
      tests: false,
    };
  }
}
