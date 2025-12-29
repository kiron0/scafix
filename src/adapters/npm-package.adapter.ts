import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { promptNpmPackageCustomizations } from "../prompts/customizations.js";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import {
  detectPackageManager,
  getInstallCommand,
} from "../utils/package-manager.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

export const npmPackageAdapter: StackAdapter = {
  id: "npm-package",
  name: "NPM Package",
  description: "NPM package ready for publishing (JavaScript or TypeScript)",
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

    logger.info(`Creating NPM package: ${projectName}`);

    // Prompt for customizations
    const customizations = await promptNpmPackageCustomizations({
      yes: Boolean(options.yes),
    });

    try {
      // Create project directory
      await mkdir(projectPath, { recursive: true });

      // Create src directory
      await mkdir(join(projectPath, "src"), { recursive: true });

      const ext = customizations.typescript ? "ts" : "js";
      const mainFile = customizations.typescript
        ? "dist/index.js"
        : "src/index.js";

      // Create package.json
      const packageJson: any = {
        name: projectName,
        version: "0.0.1",
        description: "",
        type: "module",
        files: customizations.typescript ? ["dist"] : ["src"],
        scripts: {},
        keywords: [],
        author: "",
        license: "MIT",
        repository: {
          type: "git",
          url: "",
        },
      };

      // Set build script and entry points based on build tool
      if (customizations.typescript) {
        packageJson.types = "dist/index.d.ts";

        switch (customizations.buildTool) {
          case "tsup":
            packageJson.main = "dist/index.js";
            packageJson.module = "dist/index.js";
            packageJson.exports = {
              ".": {
                import: "./dist/index.js",
                require: "./dist/index.cjs",
                types: "./dist/index.d.ts",
              },
            };
            packageJson.scripts.build = "tsup";
            packageJson.scripts.dev = "tsup --watch";
            break;
          case "rollup":
            packageJson.main = "dist/index.cjs";
            packageJson.module = "dist/index.js";
            packageJson.exports = {
              ".": {
                import: "./dist/index.js",
                require: "./dist/index.cjs",
                types: "./dist/index.d.ts",
              },
            };
            packageJson.scripts.build = "rollup -c";
            packageJson.scripts.dev = "rollup -c --watch";
            break;
          case "esbuild":
            packageJson.main = "dist/index.js";
            packageJson.exports = {
              ".": {
                import: "./dist/index.js",
                types: "./dist/index.d.ts",
              },
            };
            packageJson.scripts.build = "node build.js";
            packageJson.scripts.dev = "node build.js --watch";
            break;
          case "none":
            packageJson.main = "dist/index.js";
            packageJson.types = "dist/index.d.ts";
            packageJson.scripts.build = "tsc";
            packageJson.scripts.dev = "tsc --watch";
            break;
        }
        packageJson.scripts.prepublishOnly = "npm run build";
      } else {
        packageJson.main = "src/index.js";
        packageJson.scripts.build = 'echo "No build needed"';
        packageJson.scripts.prepublishOnly = 'echo "Ready to publish"';
      }

      if (customizations.tests) {
        packageJson.scripts.test = "vitest";
        packageJson.scripts["test:watch"] = "vitest --watch";
      }

      await writeFile(
        join(projectPath, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      // Create TypeScript config if needed
      if (customizations.typescript) {
        const tsconfig: any = {
          compilerOptions: {
            target: "ES2022",
            module: "ES2022",
            lib: ["ES2022"],
            moduleResolution: "node",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
          },
          include: ["src/**/*"],
          exclude: ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"],
        };

        // Only add outDir, rootDir, declaration if using tsc (none build tool)
        if (customizations.buildTool === "none") {
          tsconfig.compilerOptions.outDir = "./dist";
          tsconfig.compilerOptions.rootDir = "./src";
          tsconfig.compilerOptions.declaration = true;
          tsconfig.compilerOptions.declarationMap = true;
          tsconfig.compilerOptions.sourceMap = true;
        }

        await writeFile(
          join(projectPath, "tsconfig.json"),
          JSON.stringify(tsconfig, null, 2),
        );

        // Create build tool configs
        if (customizations.buildTool === "tsup") {
          const tsupConfig = `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
`;
          await writeFile(join(projectPath, "tsup.config.ts"), tsupConfig);
        } else if (customizations.buildTool === "rollup") {
          const rollupConfig = `import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
  external: [],
});
`;
          await writeFile(join(projectPath, "rollup.config.js"), rollupConfig);
        } else if (customizations.buildTool === "esbuild") {
          const esbuildConfig = `import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  sourcemap: true,
  minify: false,
};

if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(buildOptions);
  console.log('Build complete!');
}
`;
          await writeFile(join(projectPath, "build.js"), esbuildConfig);
        }
      }

      // Create main source file
      const indexContent = customizations.typescript
        ? `/**
 * Main entry point for ${projectName}
 */

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export default {
  greet,
};
`
        : `/**
 * Main entry point for ${projectName}
 */

export function greet(name) {
  return \`Hello, \${name}!\`;
}

export default {
  greet,
};
`;

      await writeFile(join(projectPath, "src", `index.${ext}`), indexContent);

      // Create README
      const readmeContent = `# ${projectName}

## Description

A Node.js package ready for publishing to npm.

## Installation

\`\`\`bash
npm install ${projectName}
\`\`\`

## Usage

\`\`\`${customizations.typescript ? "typescript" : "javascript"}
import { greet } from '${projectName}';

console.log(greet('World'));
\`\`\`

## Development

\`\`\`bash
# Install dependencies
npm install

${customizations.typescript ? "# Build\nnpm run build\n\n" : ""}${customizations.tests ? "# Run tests\nnpm test\n\n" : ""}# Publish
npm publish
\`\`\`

## License

MIT
`;

      await writeFile(join(projectPath, "README.md"), readmeContent);

      // Create .gitignore
      const gitignore = `node_modules
dist
*.log
.DS_Store
.env
coverage
.nyc_output
`;
      await writeFile(join(projectPath, ".gitignore"), gitignore);

      // Create .npmignore
      const npmignore = `src
*.test.${ext}
*.spec.${ext}
tsconfig.json
.gitignore
.env
coverage
.nyc_output
`;
      await writeFile(join(projectPath, ".npmignore"), npmignore);

      // Install dependencies
      logger.info("Installing dependencies...");
      const installCommand =
        packageManager === "pnpm"
          ? "pnpm"
          : packageManager === "yarn"
            ? "yarn"
            : "npm";
      const installArgs = ["install"];

      const devDependencies: string[] = [];
      const dependencies: string[] = [];

      if (customizations.typescript) {
        devDependencies.push("typescript", "@types/node");

        // Add build tool dependencies
        if (customizations.buildTool === "tsup") {
          devDependencies.push("tsup");
        } else if (customizations.buildTool === "rollup") {
          devDependencies.push("rollup", "@rollup/plugin-typescript");
        } else if (customizations.buildTool === "esbuild") {
          devDependencies.push("esbuild");
        }
      }

      if (customizations.eslint) {
        devDependencies.push("eslint");
        if (customizations.typescript) {
          devDependencies.push(
            "@typescript-eslint/parser",
            "@typescript-eslint/eslint-plugin",
          );
        }
      }

      if (customizations.prettier) {
        devDependencies.push("prettier");
      }

      if (customizations.tests) {
        devDependencies.push("vitest");
        if (customizations.typescript) {
          devDependencies.push("@vitest/ui");
        }
      }

      // Install dev dependencies
      if (devDependencies.length > 0) {
        const devInstallArgs =
          installCommand === "pnpm"
            ? ["add", "-D", ...devDependencies]
            : installCommand === "yarn"
              ? ["add", "-D", ...devDependencies]
              : ["install", "--save-dev", ...devDependencies];
        await exec(installCommand, devInstallArgs, {
          cwd: projectPath,
          stdio: "inherit",
        });
      }

      // Install regular dependencies if any
      if (dependencies.length > 0) {
        const prodInstallArgs =
          installCommand === "pnpm"
            ? ["add", ...dependencies]
            : installCommand === "yarn"
              ? ["add", ...dependencies]
              : ["install", "--save", ...dependencies];
        await exec(installCommand, prodInstallArgs, {
          cwd: projectPath,
          stdio: "inherit",
        });
      }

      // Setup ESLint if requested
      if (customizations.eslint) {
        logger.info("Setting up ESLint...");
        const eslintConfig = customizations.typescript
          ? `module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {},
};`
          : `module.exports = {
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {},
};`;

        await writeFile(join(projectPath, ".eslintrc.js"), eslintConfig);
      }

      // Setup Prettier if requested
      if (customizations.prettier) {
        logger.info("Setting up Prettier...");
        const prettierConfig = `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}`;
        await writeFile(join(projectPath, ".prettierrc"), prettierConfig);

        const prettierIgnore = `node_modules
dist
coverage
.nyc_output`;
        await writeFile(join(projectPath, ".prettierignore"), prettierIgnore);
      }

      // Setup tests if requested
      if (customizations.tests) {
        logger.info("Setting up tests...");
        const testFile = customizations.typescript
          ? "index.test.ts"
          : "index.test.js";
        const testContent = customizations.typescript
          ? `import { describe, it, expect } from 'vitest';
import { greet } from './index.js';

describe('greet', () => {
  it('should return a greeting message', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
`
          : `import { describe, it, expect } from 'vitest';
import { greet } from './index.js';

describe('greet', () => {
  it('should return a greeting message', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
`;

        await mkdir(join(projectPath, "src", "__tests__"), { recursive: true });
        await writeFile(
          join(projectPath, "src", "__tests__", testFile),
          testContent,
        );

        // Create vitest config
        const vitestConfig = customizations.typescript
          ? `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
`
          : `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
`;

        await writeFile(join(projectPath, "vitest.config.ts"), vitestConfig);
      }

      // Detect package manager from created project
      const detectedPm = detectPackageManager(projectPath);

      logger.success(`Package ${projectName} created successfully!`);
      logger.info(`Next steps:`);
      logger.info(`  cd ${directory}`);
      logger.info(`  ${getInstallCommand(detectedPm)}`);
      if (customizations.typescript) {
        logger.info(
          `  ${detectedPm === "pnpm" ? "pnpm" : detectedPm === "yarn" ? "yarn" : "npm"} run build`,
        );
      }
      if (customizations.tests) {
        logger.info(
          `  ${detectedPm === "pnpm" ? "pnpm" : detectedPm === "yarn" ? "yarn" : "npm"} test`,
        );
      }
      logger.info(
        `  ${detectedPm === "pnpm" ? "pnpm" : detectedPm === "yarn" ? "yarn" : "npm"} publish`,
      );
    } catch (error) {
      logger.error(
        `Failed to create package: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },
};
