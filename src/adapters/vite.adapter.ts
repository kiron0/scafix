import { spinner } from '@clack/prompts';
import { access, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { promptViteReactCustomizations } from '../prompts/customizations.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { detectYarnFlavor, getDlxCommand } from '../utils/package-manager.js';
import {
  getPreferredPackageJsonName,
  validateDirectory,
  validateProjectName,
} from '../utils/validate.js';

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
    const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\]/);
    if (pluginsMatch) {
      const body = pluginsMatch[1].trim();
      const sep = body.length > 0 && !body.endsWith(',') ? ', ' : '';
      content = content.replace(pluginsMatch[0], `plugins: [${body}${sep}tailwindcss()]`);
    }
  }

  await writeFile(configPath, content);
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

  const cssPath = join(projectPath, 'src', 'index.css');
  if (await fileExists(cssPath)) {
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
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`
  );

  const cssPath = join(projectPath, 'src', 'index.css');
  if (await fileExists(cssPath)) {
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

    const customizations = await promptViteReactCustomizations({
      yes: options.yes,
    });

    logger.info(`Launching Vite's official CLI for: ${projectName}`);
    logger.info('');

    const template = customizations.typescript ? 'react-ts' : 'react';

    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npm',
        args: ['create', 'vite@latest', directory, '--', '--template', template],
      },
      pnpm: {
        cmd: 'pnpm',
        args: ['create', 'vite', directory, '--template', template],
      },
      yarn: {
        cmd: 'yarn',
        args: ['create', 'vite', directory, '--template', template],
      },
      bun: {
        cmd: 'bun',
        args: ['create', 'vite', directory, '--template', template],
      },
    };

    const projectPath = join(process.cwd(), directory);
    const { cmd, args } = pmCommands[packageManager] ?? pmCommands.npm;

    try {
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

      logger.info('');
      logger.info('Next steps:');
      logger.info(`  cd ${directory}`);
      logger.info(`  ${packageManager === 'npm' ? 'npm run dev' : `${packageManager} run dev`}`);
    } catch (error) {
      await rm(projectPath, { force: true, recursive: true });
      throw error;
    }
  },
};
