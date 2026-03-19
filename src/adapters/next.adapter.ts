import { spinner } from '@clack/prompts';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { promptNextCustomizations } from '../prompts/customizations.js';
import type { CreateOptions, StackAdapter } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { detectYarnFlavor, getDlxCommand } from '../utils/package-manager.js';
import { validateDirectory, validateProjectName } from '../utils/validate.js';
import {
  cleanupFailedScaffold,
  createMissingParentDirectories,
  reconcileGeneratedPackageJsonName,
} from './shared/scaffold.js';

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
    await writeFile(join(projectPath, '.prettierignore'), '.next\nnode_modules\n');

    s.stop('Prettier configured');
  } catch (error) {
    s.stop('Failed to setup Prettier');
    throw error;
  }
}

export const nextAdapter: StackAdapter = {
  id: 'next',
  name: 'Next.js',
  description: 'Scaffold a Next.js project via the official create-next-app CLI',
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

    const customizations = await promptNextCustomizations({
      yes: options.yes,
    });

    logger.info(`Launching Next.js's official CLI for: ${projectName}`);
    logger.info('');

    const packageManagerFlag =
      packageManager === 'pnpm'
        ? '--use-pnpm'
        : packageManager === 'yarn'
          ? '--use-yarn'
          : packageManager === 'bun'
            ? '--use-bun'
            : '--use-npm';
    const pmCommands: Record<string, { cmd: string; args: string[] }> = {
      npm: {
        cmd: 'npx',
        args: [
          'create-next-app@latest',
          directory,
          customizations.typescript ? '--ts' : '--js',
          customizations.eslint ? '--eslint' : '--no-eslint',
          customizations.appRouter ? '--app' : '--no-app',
          customizations.srcDir ? '--src-dir' : '--no-src-dir',
          customizations.tailwind ? '--tailwind' : '--no-tailwind',
          '--import-alias',
          '@/*',
          packageManagerFlag,
          '--disable-git',
          '--yes',
        ],
      },
      pnpm: {
        cmd: 'pnpm',
        args: [
          'dlx',
          'create-next-app@latest',
          directory,
          customizations.typescript ? '--ts' : '--js',
          customizations.eslint ? '--eslint' : '--no-eslint',
          customizations.appRouter ? '--app' : '--no-app',
          customizations.srcDir ? '--src-dir' : '--no-src-dir',
          customizations.tailwind ? '--tailwind' : '--no-tailwind',
          '--import-alias',
          '@/*',
          packageManagerFlag,
          '--disable-git',
          '--yes',
        ],
      },
      yarn: {
        cmd: 'yarn',
        args: [
          'create',
          'next-app',
          directory,
          customizations.typescript ? '--ts' : '--js',
          customizations.eslint ? '--eslint' : '--no-eslint',
          customizations.appRouter ? '--app' : '--no-app',
          customizations.srcDir ? '--src-dir' : '--no-src-dir',
          customizations.tailwind ? '--tailwind' : '--no-tailwind',
          '--import-alias',
          '@/*',
          packageManagerFlag,
          '--disable-git',
          '--yes',
        ],
      },
      bun: {
        cmd: 'bunx',
        args: [
          'create-next-app@latest',
          directory,
          customizations.typescript ? '--ts' : '--js',
          customizations.eslint ? '--eslint' : '--no-eslint',
          customizations.appRouter ? '--app' : '--no-app',
          customizations.srcDir ? '--src-dir' : '--no-src-dir',
          customizations.tailwind ? '--tailwind' : '--no-tailwind',
          '--import-alias',
          '@/*',
          packageManagerFlag,
          '--disable-git',
          '--yes',
        ],
      },
    };

    const projectPath = join(process.cwd(), directory);
    const { cmd, args } = pmCommands[packageManager] ?? pmCommands.npm;
    let createdParentDirectories: string[] = [];

    try {
      createdParentDirectories = await createMissingParentDirectories(projectPath);
      await exec(cmd, args, { cwd: process.cwd(), stdio: 'inherit' });
      await reconcileGeneratedPackageJsonName(projectPath, projectName, directory);

      if (customizations.prettier) {
        await setupPrettier(projectPath, packageManager);
      }

      if (customizations.shadcn) {
        logger.info('');
        logger.info('Initialising shadcn/ui...');
        const yarnFlavor = packageManager === 'yarn' ? detectYarnFlavor(projectPath) : undefined;
        const dlx = getDlxCommand(
          packageManager,
          'shadcn@latest',
          ['init', '--defaults', '--yes', '--template', 'next', '--cwd', projectPath],
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
      await cleanupFailedScaffold(projectPath, createdParentDirectories);
      throw error;
    }
  },
};
