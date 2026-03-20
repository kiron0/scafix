import { spinner } from '@clack/prompts';
import { access, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { promptViteReactCustomizations } from '../prompts/customizations.js';
import {
  cleanupFailedScaffold,
  createMissingParentDirectories,
} from './shared/scaffold.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { stripGeneratedGitDirectory } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { detectYarnFlavor, getDlxCommand } from '../utils/package-manager.js';
import type { PackageManager } from '../utils/package-manager.js';
import {
  getPreferredPackageJsonName,
  validateDirectory,
  validateProjectName,
} from '../utils/validate.js';
import {
  assertSupportedOverrides,
  resolveChoiceOverride,
  shouldAcceptPromptDefaults,
} from './shared/prompting.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectViteConfigPath(projectPath: string): Promise<string | null> {
  const ts = join(projectPath, 'vite.config.ts');
  const js = join(projectPath, 'vite.config.js');
  if (await fileExists(ts)) return ts;
  if (await fileExists(js)) return js;
  return null;
}

function getLocalBinaryPath(projectPath: string, binaryName: string): string {
  return join(
    projectPath,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${binaryName}.cmd` : binaryName
  );
}

function resolveBooleanOverride(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function resolveViteFrameworkOverride(value: unknown): 'react' | 'vue' | undefined {
  return resolveChoiceOverride(value, 'framework', ['react', 'vue']);
}

function resolveViteTailwindVersionOverride(value: unknown): 'v3' | 'v4' | undefined {
  return resolveChoiceOverride(value, 'tailwind-version', ['v3', 'v4']);
}

type ViteTemplateId = 'react' | 'react-ts' | 'vue' | 'vue-ts';

function resolveViteTemplateOverride(value: unknown): ViteTemplateId | undefined {
  return resolveChoiceOverride(value, 'template', ['react', 'react-ts', 'vue', 'vue-ts']);
}

function getViteTemplateShape(template: ViteTemplateId): {
  framework: 'react' | 'vue';
  typescript: boolean;
} {
  return template === 'react'
    ? { framework: 'react', typescript: false }
    : template === 'react-ts'
      ? { framework: 'react', typescript: true }
      : template === 'vue'
        ? { framework: 'vue', typescript: false }
        : { framework: 'vue', typescript: true };
}

function assertNoConflictingViteOverrides(options: CreateOptions): void {
  const templateOverride = resolveViteTemplateOverride(options.template);
  const frameworkOverride = resolveViteFrameworkOverride(options.framework);
  const typescriptOverride = resolveBooleanOverride(options.typescript);
  const shadcnOverride = resolveBooleanOverride(options.shadcn);
  const shadcnVueOverride = resolveBooleanOverride(options.shadcnVue);

  if (templateOverride !== undefined) {
    const templateShape = getViteTemplateShape(templateOverride);

    if (frameworkOverride !== undefined && frameworkOverride !== templateShape.framework) {
      throw new Error(
        `Conflicting Vite overrides: --template ${templateOverride} cannot be combined with --framework ${frameworkOverride}`
      );
    }

    if (typescriptOverride !== undefined && typescriptOverride !== templateShape.typescript) {
      throw new Error(
        `Conflicting Vite overrides: --template ${templateOverride} cannot be combined with --${
          typescriptOverride ? 'typescript' : 'no-typescript'
        }`
      );
    }

    if (shadcnVueOverride && templateShape.framework !== 'vue') {
      throw new Error(
        `Conflicting Vite overrides: --template ${templateOverride} cannot be combined with --shadcn-vue`
      );
    }
  }

  if (frameworkOverride === 'react' && shadcnVueOverride) {
    throw new Error(
      'Conflicting Vite overrides: --framework react cannot be combined with --shadcn-vue'
    );
  }

  if (shadcnOverride === false && shadcnVueOverride) {
    throw new Error(
      'Conflicting Vite overrides: --no-shadcn cannot be combined with --shadcn-vue'
    );
  }
}

function applyViteCustomizationOverrides(
  customizations: Awaited<ReturnType<typeof promptViteReactCustomizations>>,
  options: CreateOptions
): Awaited<ReturnType<typeof promptViteReactCustomizations>> {
  assertNoConflictingViteOverrides(options);

  let framework = customizations.framework;
  let typescript = customizations.typescript;
  const templateOverride = resolveViteTemplateOverride(options.template);

  if (templateOverride !== undefined) {
    ({ framework, typescript } = getViteTemplateShape(templateOverride));
  }

  framework = resolveViteFrameworkOverride(options.framework) ?? framework;
  typescript = resolveBooleanOverride(options.typescript) ?? typescript;

  let shadcn = resolveBooleanOverride(options.shadcn) ?? customizations.shadcn;
  if (resolveBooleanOverride(options.shadcnVue)) {
    framework = 'vue';
    shadcn = true;
  }

  return {
    ...customizations,
    framework,
    typescript,
    shadcn,
    ...(resolveBooleanOverride(options.tailwind) === undefined
      ? {}
      : { tailwind: resolveBooleanOverride(options.tailwind) }),
    ...(resolveViteTailwindVersionOverride(options.tailwindVersion) === undefined
      ? {}
      : { tailwindVersion: resolveViteTailwindVersionOverride(options.tailwindVersion) }),
    ...(resolveBooleanOverride(options.prettier) === undefined
      ? {}
      : { prettier: resolveBooleanOverride(options.prettier) }),
  };
}

async function detectViteStylesheetPath(projectPath: string): Promise<string | null> {
  const indexCssPath = join(projectPath, 'src', 'index.css');
  const styleCssPath = join(projectPath, 'src', 'style.css');

  if (await fileExists(indexCssPath)) return indexCssPath;
  if (await fileExists(styleCssPath)) return styleCssPath;
  return null;
}

async function patchViteConfig(configPath: string): Promise<void> {
  let content = await readFile(configPath, 'utf-8');

  if (!content.includes('@tailwindcss/vite')) {
    const importMatch = content.match(/^(import[^\n]*\n)+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        `${importMatch[0]}import tailwindcss from "@tailwindcss/vite";\n`
      );
    } else {
      content = `import tailwindcss from "@tailwindcss/vite";\n${content}`;
    }
  }

  if (!content.includes('tailwindcss()')) {
    const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\](,?)/);
    if (pluginsMatch) {
      const body = pluginsMatch[1].trim();
      const sep = body.length > 0 && !body.endsWith(',') ? ', ' : '';
      const trailingComma = pluginsMatch[2] ?? '';
      content = content.replace(
        pluginsMatch[0],
        `plugins: [${body}${sep}tailwindcss()]${trailingComma}`
      );
    }
  }

  await writeFile(configPath, content);
}

async function patchViteConfigAlias(configPath: string): Promise<void> {
  let content = await readFile(configPath, 'utf-8');

  if (!content.includes("from 'node:url'") && !content.includes('from "node:url"')) {
    const importMatch = content.match(/^(import[^\n]*\n)+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        `${importMatch[0]}import { fileURLToPath, URL } from 'node:url';\n`
      );
    } else {
      content = `import { fileURLToPath, URL } from 'node:url';\n${content}`;
    }
  }

  if (
    !content.includes('alias:') &&
    !content.includes("fileURLToPath(new URL('./src', import.meta.url))")
  ) {
    const resolveBlock = `resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },`;

    if (content.includes('plugins:')) {
      content = content.replace(
        /plugins:\s*\[[\s\S]*?\](,?)/,
        (match, trailingComma: string) => `${match.slice(0, trailingComma ? -1 : undefined)},\n  ${resolveBlock}`
      );
    } else if (content.includes('export default defineConfig({')) {
      content = content.replace('export default defineConfig({', `export default defineConfig({\n  ${resolveBlock}`);
    } else if (content.includes('export default {')) {
      content = content.replace('export default {', `export default {\n  ${resolveBlock}`);
    }
  }

  await writeFile(configPath, content);
}

async function patchJsonFile(
  filePath: string,
  options: {
    createIfMissing?: boolean;
  },
  updater: (json: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  if (!(await fileExists(filePath))) {
    if (!options.createIfMissing) {
      return;
    }

    const created = updater({});
    await writeFile(filePath, `${JSON.stringify(created, null, 2)}\n`);
    return;
  }

  const content = await readFile(filePath, 'utf8');
  const parsed = parseJsonLike(content);
  const updated = updater(parsed);
  await writeFile(filePath, `${JSON.stringify(updated, null, 2)}\n`);
}

function stripJsonComments(content: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inString) {
      result += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < content.length && content[i] !== '\n') {
        i += 1;
      }

      if (i < content.length) {
        result += '\n';
      }

      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
        i += 1;
      }
      i += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function stripTrailingCommas(content: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inString) {
      result += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ',') {
      let lookahead = i + 1;
      while (lookahead < content.length && /\s/.test(content[lookahead] ?? '')) {
        lookahead += 1;
      }

      const next = content[lookahead];
      if (next === '}' || next === ']') {
        continue;
      }
    }

    result += char;
  }

  return result;
}

function parseJsonLike(content: string): Record<string, unknown> {
  return JSON.parse(stripTrailingCommas(stripJsonComments(content))) as Record<string, unknown>;
}

async function ensureShadcnVueProjectConfig(
  projectPath: string,
  packageManager: PackageManager,
  typescript: boolean
): Promise<void> {
  const configPath = await detectViteConfigPath(projectPath);
  if (configPath) {
    await patchViteConfigAlias(configPath);
  }

  if (typescript) {
    await patchJsonFile(join(projectPath, 'tsconfig.json'), {}, (json) => ({
      ...json,
      compilerOptions: {
        ...((json.compilerOptions as Record<string, unknown> | undefined) ?? {}),
        baseUrl: '.',
        paths: {
          ...((((json.compilerOptions as Record<string, unknown> | undefined)?.paths as
            | Record<string, unknown>
            | undefined) ?? {})),
          '@/*': ['./src/*'],
        },
      },
    }));

    await patchJsonFile(join(projectPath, 'tsconfig.app.json'), {}, (json) => ({
      ...json,
      compilerOptions: {
        ...((json.compilerOptions as Record<string, unknown> | undefined) ?? {}),
        baseUrl: '.',
        paths: {
          ...((((json.compilerOptions as Record<string, unknown> | undefined)?.paths as
            | Record<string, unknown>
            | undefined) ?? {})),
          '@/*': ['./src/*'],
        },
      },
    }));

    const devFlag = packageManager === 'npm' ? ['--save-dev'] : ['-D'];
    await exec(
      packageManager === 'npm' ? 'npm' : packageManager,
      [packageManager === 'npm' ? 'install' : 'add', ...devFlag, '@types/node'],
      { cwd: projectPath, stdio: 'pipe' }
    );
  } else {
    await patchJsonFile(join(projectPath, 'jsconfig.json'), { createIfMissing: true }, (json) => ({
      ...json,
      compilerOptions: {
        ...((json.compilerOptions as Record<string, unknown> | undefined) ?? {}),
        baseUrl: '.',
        paths: {
          ...((((json.compilerOptions as Record<string, unknown> | undefined)?.paths as
            | Record<string, unknown>
            | undefined) ?? {})),
          '@/*': ['./src/*'],
        },
      },
    }));
  }
}

async function setupShadcnVue(
  projectPath: string,
  packageManager: PackageManager,
  typescript: boolean
): Promise<void> {
  const shadcnVueSpinner = spinner();
  shadcnVueSpinner.start('Initialising shadcn-vue...');
  shadcnVueSpinner.stop();

  await ensureShadcnVueProjectConfig(projectPath, packageManager, typescript);

  const yarnFlavor = packageManager === 'yarn' ? detectYarnFlavor(projectPath) : undefined;
  const dlx = getDlxCommand(packageManager, 'shadcn-vue@latest', ['init', '--yes', '--cwd', projectPath], {
    directory: projectPath,
    yarnFlavor,
  });
  dlx.args.splice(dlx.args.indexOf('init') + 1, 0, '--defaults', '--base-color', 'neutral');

  await exec(dlx.cmd, dlx.args, {
    cwd: projectPath,
    stdio: 'inherit',
  });
}

async function reconcileGeneratedPackageJsonName(
  projectPath: string,
  projectName: string,
  directory: string
): Promise<void> {
  const packageJsonPath = join(projectPath, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    name?: unknown;
    [key: string]: unknown;
  };
  const preferredName = getPreferredPackageJsonName(projectName, directory);

  if (packageJson.name !== preferredName) {
    packageJson.name = preferredName;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  await stripGeneratedGitDirectory(projectPath);
}

async function setupTailwindV4(projectPath: string, packageManager: string): Promise<void> {
  const s = spinner();
  s.start('Installing Tailwind CSS v4...');
  try {
    const devFlag = packageManager === 'npm' ? ['--save-dev'] : ['-D'];
    await exec(
      packageManager === 'npm' ? 'npm' : packageManager,
      [
        packageManager === 'npm' ? 'install' : 'add',
        ...devFlag,
        'tailwindcss',
        '@tailwindcss/vite',
      ],
      { cwd: projectPath, stdio: 'pipe' }
    );
    s.stop('Tailwind CSS v4 installed');
  } catch (err) {
    s.stop('Failed to install Tailwind CSS v4');
    throw err;
  }

  const configPath = await detectViteConfigPath(projectPath);
  if (configPath) {
    await patchViteConfig(configPath);
    logger.debug('Patched vite.config to add tailwindcss() plugin');
  }

  const cssPath = await detectViteStylesheetPath(projectPath);
  if (cssPath && (await fileExists(cssPath))) {
    let css = await readFile(cssPath, 'utf-8');
    if (!css.includes('@import "tailwindcss"')) {
      css = `@import "tailwindcss";\n\n${css}`;
      await writeFile(cssPath, css);
    }
  }
}

async function setupTailwindV3(projectPath: string, packageManager: string): Promise<void> {
  const s = spinner();
  s.start('Installing Tailwind CSS v3...');
  try {
    const devFlag = packageManager === 'npm' ? ['--save-dev'] : ['-D'];
    await exec(
      packageManager === 'npm' ? 'npm' : packageManager,
      [
        packageManager === 'npm' ? 'install' : 'add',
        ...devFlag,
        'tailwindcss@^3',
        'postcss',
        'autoprefixer',
      ],
      { cwd: projectPath, stdio: 'pipe' }
    );
    s.stop('Tailwind CSS v3 installed');
  } catch (err) {
    s.stop('Failed to install Tailwind CSS v3');
    throw err;
  }

  await exec(getLocalBinaryPath(projectPath, 'tailwindcss'), ['init', '-p'], {
    cwd: projectPath,
    stdio: 'pipe',
  });

  await writeFile(
    join(projectPath, 'tailwind.config.js'),
    `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`
  );

  const cssPath = await detectViteStylesheetPath(projectPath);
  if (cssPath && (await fileExists(cssPath))) {
    let css = await readFile(cssPath, 'utf-8');
    if (!css.includes('@tailwind base')) {
      css = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n${css}`;
      await writeFile(cssPath, css);
    }
  }
}

async function setupPrettier(projectPath: string, packageManager: string): Promise<void> {
  const s = spinner();
  s.start('Setting up Prettier...');
  try {
    const installCommand = packageManager === 'npm' ? 'npm' : packageManager;
    const installArgs =
      packageManager === 'npm' ? ['install', '--save-dev', 'prettier'] : ['add', '-D', 'prettier'];

    await exec(installCommand, installArgs, {
      cwd: projectPath,
      stdio: 'pipe',
    });

    await writeFile(
      join(projectPath, '.prettierrc'),
      `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
`
    );
    await writeFile(join(projectPath, '.prettierignore'), 'dist\nnode_modules\n');

    s.stop('Prettier configured');
  } catch (error) {
    s.stop('Failed to setup Prettier');
    throw error;
  }
}

async function installProjectDependencies(
  projectPath: string,
  packageManager: string
): Promise<void> {
  const s = spinner();
  s.start('Installing dependencies...');
  try {
    await exec(packageManager === 'npm' ? 'npm' : packageManager, ['install'], {
      cwd: projectPath,
      stdio: 'inherit',
    });
    s.stop('Dependencies installed');
  } catch (error) {
    s.stop('Failed to install dependencies');
    throw error;
  }
}

export const viteReactAdapter: StackAdapter = {
  id: 'vite',
  name: 'Vite',
  description: 'Scaffold any Vite project via the official create-vite CLI',
  category: 'frontend',

  async create(options: CreateOptions): Promise<void> {
    const { projectName, directory = projectName, packageManager = 'npm' } = options;

    if (!validateProjectName(projectName)) {
      throw new Error('Invalid project name');
    }

    const dirInfo = validateDirectory(directory);
    if (!dirInfo.valid) {
      throw new Error(dirInfo.reason ?? `Invalid directory: ${directory}`);
    }
    if (dirInfo.exists) {
      logger.warn(`The directory "${directory}" already exists.`);
      logger.info(`Please choose a different project name or remove the existing directory.`);
      throw new CliExitError(1);
    }

    assertSupportedOverrides(options, [
      'template',
      'framework',
      'typescript',
      'tailwind',
      'tailwindVersion',
      'shadcn',
      'shadcnVue',
      'prettier',
    ]);

    const promptedCustomizations = await promptViteReactCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = applyViteCustomizationOverrides(promptedCustomizations, options);

    logger.info(`Launching Vite's official CLI for: ${projectName}`);
    logger.info('');

    const template = customizations.typescript
      ? `${customizations.framework}-ts`
      : customizations.framework;

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npm',
        args: ['create', 'vite@latest', directory, '--', '--template', template, '--no-interactive'],
      },
      pnpm: {
        cmd: 'pnpm',
        args: ['create', 'vite', directory, '--template', template, '--no-interactive'],
      },
      yarn: {
        cmd: 'yarn',
        args: ['create', 'vite', directory, '--template', template, '--no-interactive'],
      },
      bun: {
        cmd: 'bun',
        args: ['create', 'vite', directory, '--template', template, '--no-interactive'],
      },
    };

    const projectPath = join(process.cwd(), directory);
    const { cmd, args } = pmCommands[packageManager] ?? pmCommands.npm;
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(cmd, args, { cwd: process.cwd(), stdio: 'inherit' });
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);
      await installProjectDependencies(projectPath, packageManager);

      let tailwindAdded = false;
      if (customizations.tailwind) {
        if (customizations.tailwindVersion === 'v3') {
          await setupTailwindV3(projectPath, packageManager);
        } else {
          await setupTailwindV4(projectPath, packageManager);
        }
        tailwindAdded = true;
      }

      if (customizations.prettier) {
        await setupPrettier(projectPath, packageManager);
      }

      if (tailwindAdded && customizations.shadcn) {
        if (customizations.framework === 'vue') {
          await setupShadcnVue(projectPath, packageManager, customizations.typescript);
        } else {
          const shadcnSpinner = spinner();
          shadcnSpinner.start('Initialising shadcn/ui...');
          shadcnSpinner.stop();
          const yarnFlavor = packageManager === 'yarn' ? detectYarnFlavor(projectPath) : undefined;
          const dlx = getDlxCommand(
            packageManager,
            'shadcn@latest',
            ['init', '--defaults', '--yes', '--template', 'vite', '--cwd', projectPath],
            {
              directory: projectPath,
              yarnFlavor,
            }
          );
          await exec(dlx.cmd, dlx.args, {
            cwd: projectPath,
            stdio: 'inherit',
          });
        }
      }

      logger.info('');
      logger.info('Next steps:');
      logger.info(`  cd ${directory}`);
      logger.info(`  ${packageManager === 'npm' ? 'npm run dev' : `${packageManager} run dev`}`);
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
