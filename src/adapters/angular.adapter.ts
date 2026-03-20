import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { promptAngularCustomizations } from '../prompts/customizations.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import type { PackageManager } from '../utils/package-manager.js';
import { validateDirectory, validateProjectName } from '../utils/validate.js';
import {
  cleanupFailedScaffold,
  createMissingParentDirectories,
  installProjectDependencies,
  reconcileGeneratedPackageJsonName,
} from './shared/scaffold.js';
import { resolveChoiceOverride, shouldAcceptPromptDefaults } from './shared/prompting.js';

const ZARD_SCHEMA_URL = 'https://zardui.com/schema.json';
const ZARD_REGISTRY_URL = 'https://zardui.com/r';
const ZARD_POSTCSS_CONFIG = `{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
`;
const ZARD_PROVIDER_IMPORT = "import { provideZard } from '@/shared/core/provider/providezard';\n";
const ZARD_PROVIDER_ENTRY = 'provideZard(),';
const ZARD_NEUTRAL_THEME = `@import 'tailwindcss';
@plugin "tailwindcss-animate";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: var(--muted-foreground);
  border-radius: 5px;
}

::-webkit-scrollbar-track {
  border-radius: 5px;
  background: var(--muted);
}
`;

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
}

interface ZardRegistryComponent {
  files: Array<{
    content: string;
    name: string;
  }>;
}

function resolveBooleanOverride(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function resolveAngularStyleOverride(value: unknown): 'css' | 'scss' | 'less' | undefined {
  return resolveChoiceOverride(value, 'style', ['css', 'scss', 'less']);
}

function applyAngularCustomizationOverrides(
  customizations: Awaited<ReturnType<typeof promptAngularCustomizations>>,
  options: CreateOptions
): Awaited<ReturnType<typeof promptAngularCustomizations>> {
  return {
    ...customizations,
    ...(resolveAngularStyleOverride(options.style) === undefined
      ? {}
      : { style: resolveAngularStyleOverride(options.style) }),
    ...(resolveBooleanOverride(options.ssr) === undefined
      ? {}
      : { ssr: resolveBooleanOverride(options.ssr) }),
    ...(resolveBooleanOverride(options.routing) === undefined
      ? {}
      : { routing: resolveBooleanOverride(options.routing) }),
    ...(resolveBooleanOverride(options.zard) === undefined
      ? {}
      : { zard: resolveBooleanOverride(options.zard) }),
  };
}

function getAngularCdkPackageVersion(packageJson: PackageJsonShape): string {
  const angularVersion = packageJson.dependencies?.['@angular/core'];
  if (typeof angularVersion !== 'string') {
    return '@angular/cdk';
  }

  const majorVersion = Number.parseInt(angularVersion.replace(/[^0-9.]/g, '').split('.')[0] ?? '', 10);
  return Number.isNaN(majorVersion) ? '@angular/cdk' : `@angular/cdk@^${majorVersion}`;
}

function getInstallPackagesCommand(
  packageManager: PackageManager,
  packages: string[],
  dev: boolean
): { args: string[]; cmd: string } {
  if (packageManager === 'npm') {
    return {
      cmd: 'npm',
      args: ['install', ...(dev ? ['--save-dev'] : []), ...packages],
    };
  }

  if (packageManager === 'bun') {
    return {
      cmd: 'bun',
      args: ['add', ...(dev ? ['-d'] : []), ...packages],
    };
  }

  return {
    cmd: packageManager,
    args: ['add', ...(dev ? ['-D'] : []), ...packages],
  };
}

function getZardConfig(packageManager: PackageManager): Record<string, unknown> {
  return {
    $schema: ZARD_SCHEMA_URL,
    aliases: {
      components: '@/shared/components',
      core: '@/shared/core',
      services: '@/shared/services',
      utils: '@/shared/utils',
    },
    appConfigFile: 'src/app/app.config.ts',
    baseUrl: 'src/app',
    packageManager,
    style: 'css',
    tailwind: {
      baseColor: 'neutral',
      css: 'src/styles.css',
    },
  };
}

async function installPackages(
  projectPath: string,
  packageManager: PackageManager,
  packages: string[],
  dev: boolean
): Promise<void> {
  if (packages.length === 0) {
    return;
  }

  const { cmd, args } = getInstallPackagesCommand(packageManager, packages, dev);
  await exec(cmd, args, {
    cwd: projectPath,
    stdio: 'inherit',
  });
}

async function installZardDependencies(
  projectPath: string,
  packageManager: PackageManager
): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(join(projectPath, 'package.json'), 'utf8')
  ) as PackageJsonShape;
  const allDependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  await installPackages(
    projectPath,
    packageManager,
    [
      getAngularCdkPackageVersion(packageJson),
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'lucide-angular',
    ],
    false
  );

  if (!allDependencies.tailwindcss) {
    await installPackages(
      projectPath,
      packageManager,
      ['tailwindcss', '@tailwindcss/postcss', 'postcss', 'tailwindcss-animate'],
      true
    );
  }
}

async function fetchZardRegistryComponent(name: 'core' | 'utils'): Promise<ZardRegistryComponent> {
  const response = await fetch(`${ZARD_REGISTRY_URL}/${name}.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch zard/ui ${name} registry data`);
  }

  return (await response.json()) as ZardRegistryComponent;
}

async function writeRegistryFiles(
  targetDirectory: string,
  files: ZardRegistryComponent['files']
): Promise<void> {
  for (const file of files) {
    const filePath = join(targetDirectory, file.name);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf8');
  }
}

async function updateAngularAppConfig(projectPath: string): Promise<void> {
  const appConfigPath = join(projectPath, 'src', 'app', 'app.config.ts');
  let content = await readFile(appConfigPath, 'utf8');

  if (!content.includes(ZARD_PROVIDER_IMPORT.trim())) {
    const importRegex = /^import .* from '.*';\n?/gm;
    let lastImportMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      lastImportMatch = match;
    }

    if (lastImportMatch) {
      const insertionIndex = lastImportMatch.index + lastImportMatch[0].length;
      content =
        content.slice(0, insertionIndex) + ZARD_PROVIDER_IMPORT + content.slice(insertionIndex);
    } else {
      content = ZARD_PROVIDER_IMPORT + content;
    }
  }

  const providersRegex = /providers:\s*\[([^\]]*?)\]/s;
  if (!providersRegex.test(content)) {
    throw new Error('Could not find the "providers" array in src/app/app.config.ts');
  }

  content = content.replace(providersRegex, (match, providersContent: string) => {
    if (providersContent.includes(ZARD_PROVIDER_ENTRY.replace(/,$/, ''))) {
      return match;
    }

    const trimmedContent = providersContent.trim();
    if (trimmedContent === '') {
      return `providers: [\n    ${ZARD_PROVIDER_ENTRY.replace(/,$/, '')}\n  ]`;
    }

    const contentWithTrailingComma = trimmedContent.endsWith(',')
      ? providersContent
      : `${providersContent.trimEnd()},`;
    return `providers: [${contentWithTrailingComma}\n    ${ZARD_PROVIDER_ENTRY}]`;
  });

  await writeFile(appConfigPath, content, 'utf8');
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

async function updateAngularTsConfig(projectPath: string): Promise<void> {
  const tsconfigPath = join(projectPath, 'tsconfig.json');
  const tsconfig = parseJsonLike(await readFile(tsconfigPath, 'utf8')) as {
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };

  tsconfig.compilerOptions = {
    ...(tsconfig.compilerOptions ?? {}),
    baseUrl: './',
    paths: {
      ...(tsconfig.compilerOptions?.paths ?? {}),
      '@/*': ['src/app/*'],
    },
  };

  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
}

async function setupZardUi(projectPath: string, packageManager: PackageManager): Promise<void> {
  logger.info('Initialising zard/ui...');
  const [coreComponent, utilsComponent] = await Promise.all([
    fetchZardRegistryComponent('core'),
    fetchZardRegistryComponent('utils'),
  ]);

  await writeFile(
    join(projectPath, 'components.json'),
    `${JSON.stringify(getZardConfig(packageManager), null, 2)}\n`,
    'utf8'
  );
  await installZardDependencies(projectPath, packageManager);
  await updateAngularAppConfig(projectPath);
  await writeFile(join(projectPath, '.postcssrc.json'), ZARD_POSTCSS_CONFIG, 'utf8');
  await writeFile(join(projectPath, 'src', 'styles.css'), `${ZARD_NEUTRAL_THEME.trim()}\n`, 'utf8');
  await updateAngularTsConfig(projectPath);
  await writeRegistryFiles(join(projectPath, 'src', 'app', 'shared', 'core'), coreComponent.files);
  await writeRegistryFiles(join(projectPath, 'src', 'app', 'shared', 'utils'), utilsComponent.files);
}

export const angularAdapter: StackAdapter = {
  id: 'angular',
  name: 'Angular',
  description: 'Scaffold an Angular project via the official @angular/cli',
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

    logger.info(`Launching Angular CLI for: ${projectName}`);
    logger.info('');

    const promptedCustomizations = await promptAngularCustomizations({
      yes: shouldAcceptPromptDefaults(options),
    });
    const customizations = applyAngularCustomizationOverrides(promptedCustomizations, options);
    if (customizations.zard && customizations.style !== 'css') {
      logger.warn('zard/ui currently requires the CSS stylesheet option in Angular.');
      throw new CliExitError(1);
    }
    const styleFlag = ['--style', customizations.style];
    const ssrFlag = customizations.ssr ? ['--ssr'] : ['--no-ssr'];
    const scaffoldPm = packageManager === 'bun' ? 'npm' : packageManager;
    const projectPath = join(process.cwd(), directory);
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(
        'npx',
        [
          '--yes',
          '@angular/cli@latest',
          'new',
          directory,
          '--interactive=false',
          '--defaults',
          '--ai-config',
          'none',
          '--skip-git',
          '--skip-install',
          '--package-manager',
          scaffoldPm,
          ...styleFlag,
          ...ssrFlag,
          ...(customizations.routing ? ['--routing'] : ['--no-routing']),
        ],
        { cwd: process.cwd(), stdio: 'inherit' }
      );
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);
      await installProjectDependencies(projectPath, packageManager);
      if (customizations.zard) {
        await setupZardUi(projectPath, packageManager);
      }
    } catch (error) {
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
