import { existsSync } from 'fs';
import { mkdir, readFile, rm, rmdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { stripGeneratedGitDirectory } from '../../utils/git.js';
import type { PackageManager } from '../../utils/package-manager.js';
import { exec } from '../../utils/exec.js';
import { getPreferredPackageJsonName } from '../../utils/validate.js';

export async function reconcileGeneratedPackageJsonName(
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

export async function createMissingParentDirectories(projectPath: string): Promise<string[]> {
  const cwd = process.cwd();
  const projectParentPath = dirname(projectPath);

  if (projectParentPath === cwd) {
    return [];
  }

  const relativeParentPath = projectParentPath.slice(cwd.length).replace(/^[/\\]+/, '');
  if (!relativeParentPath) {
    return [];
  }

  const createdDirectories: string[] = [];
  let currentPath = cwd;

  for (const segment of relativeParentPath.split(/[\\/]+/).filter((value) => value.length > 0)) {
    currentPath = join(currentPath, segment);
    if (!existsSync(currentPath)) {
      await mkdir(currentPath);
      createdDirectories.push(currentPath);
    }
  }

  return createdDirectories;
}

export async function cleanupFailedScaffold(
  projectPath: string,
  createdParentDirectories: string[]
): Promise<void> {
  await rm(projectPath, { force: true, recursive: true }).catch(() => undefined);

  for (const createdDirectory of createdParentDirectories.reverse()) {
    await rmdir(createdDirectory).catch(() => undefined);
  }
}

export async function installProjectDependencies(
  projectPath: string,
  packageManager: PackageManager
): Promise<void> {
  await exec(packageManager === 'npm' ? 'npm' : packageManager, ['install'], {
    cwd: projectPath,
    stdio: 'inherit',
  });
}
