import prompts from "prompts";
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
    const tsResponse = await prompts({
      type: "select",
      name: "typescript",
      message: "Use TypeScript?",
      choices: [
        { title: "Yes", value: true },
        { title: "No (JavaScript)", value: false },
      ],
      initial: 0,
    });
    customizations.typescript = tsResponse.typescript ?? true;

    // Tailwind CSS
    const tailwindResponse = await prompts({
      type: "confirm",
      name: "tailwind",
      message: "Add Tailwind CSS?",
      initial: false,
    });
    customizations.tailwind = tailwindResponse.tailwind ?? false;

    if (customizations.tailwind) {
      const tailwindVersionResponse = await prompts({
        type: "select",
        name: "version",
        message: "Tailwind CSS version:",
        choices: [
          { title: "v4 (Latest)", value: "v4" },
          { title: "v3 (Stable)", value: "v3" },
        ],
        initial: 0,
      });
      customizations.tailwindVersion = tailwindVersionResponse.version ?? "v4";
    }

    // Shadcn UI
    if (customizations.tailwind) {
      const shadcnResponse = await prompts({
        type: "confirm",
        name: "shadcn",
        message: "Add shadcn/ui?",
        initial: false,
      });
      customizations.shadcn = shadcnResponse.shadcn ?? false;

      if (customizations.shadcn) {
        const shadcnOptions: ViteReactCustomizations["shadcnOptions"] = {};

        // Style
        const styleResponse = await prompts({
          type: "select",
          name: "style",
          message: "shadcn/ui style:",
          choices: [
            { title: "Default", value: "default" },
            { title: "New York", value: "new-york" },
          ],
          initial: 0,
        });
        shadcnOptions.style = styleResponse.style ?? "default";

        // Base color
        const colorResponse = await prompts({
          type: "select",
          name: "baseColor",
          message: "Base color:",
          choices: [
            { title: "Slate", value: "slate" },
            { title: "Gray", value: "gray" },
            { title: "Zinc", value: "zinc" },
            { title: "Neutral", value: "neutral" },
            { title: "Stone", value: "stone" },
          ],
          initial: 0,
        });
        shadcnOptions.baseColor = colorResponse.baseColor ?? "slate";

        // CSS Variables
        const cssVarsResponse = await prompts({
          type: "confirm",
          name: "cssVariables",
          message: "Use CSS variables for theming?",
          initial: true,
        });
        shadcnOptions.cssVariables = cssVarsResponse.cssVariables ?? true;

        // Components (multi-select)
        const componentsResponse = await prompts({
          type: "multiselect",
          name: "components",
          message: "Select shadcn/ui components to install:",
          choices: [
            { title: "Button", value: "button" },
            { title: "Card", value: "card" },
            { title: "Input", value: "input" },
            { title: "Label", value: "label" },
            { title: "Dialog", value: "dialog" },
            { title: "Dropdown Menu", value: "dropdown-menu" },
            { title: "Select", value: "select" },
            { title: "Tabs", value: "tabs" },
            { title: "Toast", value: "toast" },
            { title: "Avatar", value: "avatar" },
          ],
          hint: "- Space to select. Return to submit",
        });
        shadcnOptions.components = componentsResponse.components ?? [];

        customizations.shadcnOptions = shadcnOptions;
      }
    }

    // ESLint
    const eslintResponse = await prompts({
      type: "confirm",
      name: "eslint",
      message: "Add ESLint?",
      initial: true,
    });
    customizations.eslint = eslintResponse.eslint ?? true;

    // Prettier
    const prettierResponse = await prompts({
      type: "confirm",
      name: "prettier",
      message: "Add Prettier?",
      initial: false,
    });
    customizations.prettier = prettierResponse.prettier ?? false;

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
    const tsResponse = await prompts({
      type: "select",
      name: "typescript",
      message: "Use TypeScript?",
      choices: [
        { title: "Yes", value: true },
        { title: "No (JavaScript)", value: false },
      ],
      initial: 0,
    });
    customizations.typescript = tsResponse.typescript ?? true;

    // Tailwind CSS
    const tailwindResponse = await prompts({
      type: "confirm",
      name: "tailwind",
      message: "Add Tailwind CSS?",
      initial: true,
    });
    customizations.tailwind = tailwindResponse.tailwind ?? true;

    if (customizations.tailwind) {
      const tailwindVersionResponse = await prompts({
        type: "select",
        name: "version",
        message: "Tailwind CSS version:",
        choices: [
          { title: "v4 (Latest)", value: "v4" },
          { title: "v3 (Stable)", value: "v3" },
        ],
        initial: 0,
      });
      customizations.tailwindVersion = tailwindVersionResponse.version ?? "v4";
    }

    // Shadcn UI
    if (customizations.tailwind) {
      const shadcnResponse = await prompts({
        type: "confirm",
        name: "shadcn",
        message: "Add shadcn/ui?",
        initial: false,
      });
      customizations.shadcn = shadcnResponse.shadcn ?? false;

      if (customizations.shadcn) {
        const shadcnOptions: NextCustomizations["shadcnOptions"] = {};

        const styleResponse = await prompts({
          type: "select",
          name: "style",
          message: "shadcn/ui style:",
          choices: [
            { title: "Default", value: "default" },
            { title: "New York", value: "new-york" },
          ],
          initial: 0,
        });
        shadcnOptions.style = styleResponse.style ?? "default";

        const colorResponse = await prompts({
          type: "select",
          name: "baseColor",
          message: "Base color:",
          choices: [
            { title: "Slate", value: "slate" },
            { title: "Gray", value: "gray" },
            { title: "Zinc", value: "zinc" },
            { title: "Neutral", value: "neutral" },
            { title: "Stone", value: "stone" },
          ],
          initial: 0,
        });
        shadcnOptions.baseColor = colorResponse.baseColor ?? "slate";

        const cssVarsResponse = await prompts({
          type: "confirm",
          name: "cssVariables",
          message: "Use CSS variables for theming?",
          initial: true,
        });
        shadcnOptions.cssVariables = cssVarsResponse.cssVariables ?? true;

        const componentsResponse = await prompts({
          type: "multiselect",
          name: "components",
          message: "Select shadcn/ui components to install:",
          choices: [
            { title: "Button", value: "button" },
            { title: "Card", value: "card" },
            { title: "Input", value: "input" },
            { title: "Label", value: "label" },
            { title: "Dialog", value: "dialog" },
            { title: "Dropdown Menu", value: "dropdown-menu" },
            { title: "Select", value: "select" },
            { title: "Tabs", value: "tabs" },
            { title: "Toast", value: "toast" },
            { title: "Avatar", value: "avatar" },
          ],
          hint: "- Space to select. Return to submit",
        });
        shadcnOptions.components = componentsResponse.components ?? [];

        customizations.shadcnOptions = shadcnOptions;
      }
    }

    // ESLint
    const eslintResponse = await prompts({
      type: "confirm",
      name: "eslint",
      message: "Add ESLint?",
      initial: true,
    });
    customizations.eslint = eslintResponse.eslint ?? true;

    // Prettier
    const prettierResponse = await prompts({
      type: "confirm",
      name: "prettier",
      message: "Add Prettier?",
      initial: false,
    });
    customizations.prettier = prettierResponse.prettier ?? false;

    // App Router
    const appRouterResponse = await prompts({
      type: "confirm",
      name: "appRouter",
      message: "Use App Router?",
      initial: true,
    });
    customizations.appRouter = appRouterResponse.appRouter ?? true;

    // src directory
    const srcDirResponse = await prompts({
      type: "confirm",
      name: "srcDir",
      message: "Use src/ directory?",
      initial: true,
    });
    customizations.srcDir = srcDirResponse.srcDir ?? true;

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
    const tsResponse = await prompts({
      type: "select",
      name: "typescript",
      message: "Use TypeScript?",
      choices: [
        { title: "Yes", value: true },
        { title: "No (JavaScript)", value: false },
      ],
      initial: 0,
    });
    customizations.typescript = tsResponse.typescript ?? true;

    // Architecture Pattern
    const patternResponse = await prompts({
      type: "select",
      name: "pattern",
      message: "Select architecture pattern:",
      choices: [
        {
          title: "MVC (Model-View-Controller)",
          description: "Separates concerns into models, views, and controllers",
          value: "mvc",
        },
        {
          title: "REST API",
          description: "RESTful API with routes, controllers, and services",
          value: "rest",
        },
        {
          title: "Layered Architecture",
          description: "Presentation, Business, and Data layers",
          value: "layered",
        },
        {
          title: "Simple",
          description: "Minimal structure with routes and middleware",
          value: "simple",
        },
      ],
      initial: 0,
    });
    customizations.pattern = patternResponse.pattern ?? "mvc";

    // ESLint
    const eslintResponse = await prompts({
      type: "confirm",
      name: "eslint",
      message: "Add ESLint?",
      initial: true,
    });
    customizations.eslint = eslintResponse.eslint ?? true;

    // Prettier
    const prettierResponse = await prompts({
      type: "confirm",
      name: "prettier",
      message: "Add Prettier?",
      initial: false,
    });
    customizations.prettier = prettierResponse.prettier ?? false;

    // CORS
    const corsResponse = await prompts({
      type: "confirm",
      name: "cors",
      message: "Add CORS support?",
      initial: false,
    });
    customizations.cors = corsResponse.cors ?? false;

    // Helmet
    const helmetResponse = await prompts({
      type: "confirm",
      name: "helmet",
      message: "Add Helmet (security headers)?",
      initial: false,
    });
    customizations.helmet = helmetResponse.helmet ?? false;

    // dotenv
    const dotenvResponse = await prompts({
      type: "confirm",
      name: "dotenv",
      message: "Add dotenv for environment variables?",
      initial: true,
    });
    customizations.dotenv = dotenvResponse.dotenv ?? true;

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
    const tsResponse = await prompts({
      type: "select",
      name: "typescript",
      message: "Use TypeScript?",
      choices: [
        { title: "Yes", value: true },
        { title: "No (JavaScript)", value: false },
      ],
      initial: 0,
    });
    customizations.typescript = tsResponse.typescript ?? true;

    // Build tool (only ask if TypeScript is selected)
    if (customizations.typescript) {
      const buildToolResponse = await prompts({
        type: "select",
        name: "buildTool",
        message: "Select build tool:",
        choices: [
          {
            title: "tsup",
            description: "Fast, zero-config bundler (Recommended)",
            value: "tsup",
          },
          {
            title: "Rollup",
            description: "Module bundler with tree-shaking",
            value: "rollup",
          },
          {
            title: "esbuild",
            description: "Extremely fast JavaScript bundler",
            value: "esbuild",
          },
          {
            title: "None (TypeScript compiler only)",
            description: "Use tsc directly",
            value: "none",
          },
        ],
        initial: 0,
      });
      customizations.buildTool = buildToolResponse.buildTool ?? "tsup";
    }

    // ESLint
    const eslintResponse = await prompts({
      type: "confirm",
      name: "eslint",
      message: "Add ESLint?",
      initial: true,
    });
    customizations.eslint = eslintResponse.eslint ?? true;

    // Prettier
    const prettierResponse = await prompts({
      type: "confirm",
      name: "prettier",
      message: "Add Prettier?",
      initial: false,
    });
    customizations.prettier = prettierResponse.prettier ?? false;

    // Tests
    const testsResponse = await prompts({
      type: "confirm",
      name: "tests",
      message: "Add test setup (Vitest)?",
      initial: false,
    });
    customizations.tests = testsResponse.tests ?? false;

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
