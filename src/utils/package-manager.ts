import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

export const SUPPORTED_PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

export type PackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];
export type YarnFlavor = 'classic' | 'berry';
const WINDOWS_SHELL = process.env.ComSpec ?? 'cmd.exe';

interface PackageManagerCommandOptions {
  directory?: string;
  yarnFlavor?: YarnFlavor;
}

export function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === 'string' && SUPPORTED_PACKAGE_MANAGERS.includes(value as PackageManager);
}

export function resolvePackageManagerOption(value: unknown): PackageManager | null {
  return isPackageManager(value) ? value : null;
}

function parsePackageManagerField(value: unknown): PackageManager | null {
  if (typeof value !== 'string') {
    return null;
  }

  const atIndex = value.indexOf('@');
  const managerName = atIndex === -1 ? value : value.slice(0, atIndex);
  return resolvePackageManagerOption(managerName);
}

function detectPackageManagerInDirectory(directory: string): PackageManager | null {
  // Check for bun.lock
  if (existsSync(join(directory, 'bun.lock')) || existsSync(join(directory, 'bun.lockb'))) {
    return 'bun';
  }

  // Check for pnpm-lock.yaml
  if (existsSync(join(directory, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  // Check for yarn.lock
  if (existsSync(join(directory, 'yarn.lock'))) {
    return 'yarn';
  }

  // Check for package-lock.json
  if (existsSync(join(directory, 'package-lock.json'))) {
    return 'npm';
  }

  const packageJsonPath = join(directory, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        packageManager?: unknown;
      };
      return parsePackageManagerField(packageJson.packageManager);
    } catch {
      // Ignore unreadable package.json files and keep walking up.
    }
  }

  return null;
}

function findNearestPackageManager(directory: string): PackageManager | null {
  let currentDir = resolve(directory);
  let reachedFilesystemRoot = false;

  while (!reachedFilesystemRoot) {
    const packageManager = detectPackageManagerInDirectory(currentDir);
    if (packageManager) {
      return packageManager;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      reachedFilesystemRoot = true;
    } else {
      currentDir = parentDir;
    }
  }

  return null;
}

/**
 * Detects the package manager by checking for lock files in the directory tree
 * Checks in order: bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json
 * Prefers the nearest ancestor containing a supported lockfile.
 */
export function detectPackageManager(directory: string): PackageManager {
  return findNearestPackageManager(directory) ?? 'npm';
}

/**
 * Detects package manager from current working directory
 * Useful for detecting which package manager the user prefers
 */
export function detectPackageManagerFromCwd(): PackageManager | null {
  return findNearestPackageManager(process.cwd());
}

/**
 * Gets the install command for a package manager
 */
export function getInstallCommand(pm: PackageManager): string {
  return pm === 'bun'
    ? 'bun install'
    : pm === 'pnpm'
      ? 'pnpm install'
      : pm === 'yarn'
        ? 'yarn install'
        : 'npm install';
}

export function getAddCommand(pm: PackageManager, pkg: string): string {
  return pm === 'bun'
    ? `bun add ${pkg}`
    : pm === 'pnpm'
      ? `pnpm add ${pkg}`
      : pm === 'yarn'
        ? `yarn add ${pkg}`
        : `npm install ${pkg}`;
}

/**
 * Gets the dev command for a package manager
 */
export function getDevCommand(pm: PackageManager): string {
  return pm === 'bun'
    ? 'bun dev'
    : pm === 'pnpm'
      ? 'pnpm dev'
      : pm === 'yarn'
        ? 'yarn dev'
        : 'npm run dev';
}

export function getRunCommand(pm: PackageManager, script: string): string {
  return pm === 'npm'
    ? `npm run ${script}`
    : pm === 'bun'
      ? `bun run ${script}`
      : `${pm} ${script}`;
}

function parseYarnMajorVersion(version: string): number | null {
  const major = Number.parseInt(version.trim().split('.')[0] ?? '', 10);
  return Number.isNaN(major) ? null : major;
}

export function getPackageManagerBinaryInvocation(command: string, args: string[]): {
  command: string;
  args: string[];
  options: {
    encoding: 'utf8';
    stdio: ['ignore', 'pipe', 'ignore'];
  };
} {
  if (process.platform === 'win32') {
    return {
      command: WINDOWS_SHELL,
      args: ['/d', '/s', '/c', command, ...args],
      options: {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    };
  }

  return {
    command,
    args,
    options: {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  };
}

function execPackageManagerBinary(command: string, args: string[]): string {
  const invocation = getPackageManagerBinaryInvocation(command, args);
  return execFileSync(invocation.command, invocation.args, invocation.options);
}

function detectYarnFlavorFromExecutable(): YarnFlavor {
  try {
    const version = execPackageManagerBinary('yarn', ['--version']);
    const major = parseYarnMajorVersion(version);
    return major !== null && major >= 2 ? 'berry' : 'classic';
  } catch {
    return 'classic';
  }
}

export function detectYarnFlavor(directory: string = process.cwd()): YarnFlavor {
  let currentDir = resolve(directory);
  let reachedFilesystemRoot = false;

  while (!reachedFilesystemRoot) {
    if (
      existsSync(join(currentDir, '.yarnrc.yml')) ||
      existsSync(join(currentDir, '.pnp.cjs')) ||
      existsSync(join(currentDir, '.pnp.loader.mjs')) ||
      existsSync(join(currentDir, '.yarn', 'releases'))
    ) {
      return 'berry';
    }

    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
          packageManager?: unknown;
        };
        if (typeof packageJson.packageManager === 'string') {
          const managerName = parsePackageManagerField(packageJson.packageManager);
          const version = packageJson.packageManager.slice(
            packageJson.packageManager.indexOf('@') + 1
          );
          if (managerName === 'yarn') {
            const major = version ? parseYarnMajorVersion(version) : null;
            return major !== null && major >= 2 ? 'berry' : 'classic';
          }
        }
      } catch {
        // Ignore unreadable package.json files and keep walking up.
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      reachedFilesystemRoot = true;
    } else {
      currentDir = parentDir;
    }
  }

  return detectYarnFlavorFromExecutable();
}

function resolveYarnFlavor(options: PackageManagerCommandOptions = {}): YarnFlavor {
  return options.yarnFlavor ?? detectYarnFlavor(options.directory);
}

export function getPublishCommand(
  pm: PackageManager,
  options: PackageManagerCommandOptions = {}
): string {
  if (pm === 'yarn') {
    return resolveYarnFlavor(options) === 'berry' ? 'yarn npm publish' : 'yarn publish';
  }

  return `${pm} publish`;
}

export function getDlxCommand(
  pm: PackageManager,
  pkg: string,
  args: string[] = [],
  options: PackageManagerCommandOptions = {}
): { cmd: string; args: string[] } {
  if (pm === 'pnpm') {
    return {
      cmd: 'pnpm',
      args: ['dlx', pkg, ...args],
    };
  }

  if (pm === 'yarn') {
    if (resolveYarnFlavor(options) === 'berry') {
      return {
        cmd: 'yarn',
        args: ['dlx', pkg, ...args],
      };
    }

    return {
      cmd: 'npx',
      args: ['--yes', pkg, ...args],
    };
  }

  if (pm === 'bun') {
    return {
      cmd: 'bunx',
      args: [pkg, ...args],
    };
  }

  return {
    cmd: 'npx',
    args: ['--yes', pkg, ...args],
  };
}
