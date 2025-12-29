import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { cwd } from 'process'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

/**
 * Detects the package manager by checking for lock files in the directory
 * Checks in order: pnpm-lock.yaml, yarn.lock, package-lock.json
 */
export function detectPackageManager(directory: string): PackageManager {
  const dir = resolve(directory)

  // Check for pnpm-lock.yaml
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  // Check for yarn.lock
  if (existsSync(join(dir, 'yarn.lock'))) {
    return 'yarn'
  }

  // Check for package-lock.json
  if (existsSync(join(dir, 'package-lock.json'))) {
    return 'npm'
  }

  // Default to npm if no lock file found
  return 'npm'
}

/**
 * Detects package manager from current working directory
 * Useful for detecting which package manager the user prefers
 */
export function detectPackageManagerFromCwd(): PackageManager | null {
  const currentDir = cwd()
  const pm = detectPackageManager(currentDir)

  // If we detected npm but there's no lock file, return null to indicate no preference
  if (pm === 'npm' && !existsSync(join(currentDir, 'package-lock.json'))) {
    return null
  }

  return pm
}

/**
 * Gets the install command for a package manager
 */
export function getInstallCommand(pm: PackageManager): string {
  return pm === 'pnpm' ? 'pnpm install' : pm === 'yarn' ? 'yarn install' : 'npm install'
}

/**
 * Gets the dev command for a package manager
 */
export function getDevCommand(pm: PackageManager): string {
  return pm === 'pnpm' ? 'pnpm dev' : pm === 'yarn' ? 'yarn dev' : 'npm run dev'
}

/**
 * Gets the run command for a package manager
 */
export function getRunCommand(pm: PackageManager, script: string): string {
  return pm === 'pnpm' ? `pnpm ${script}` : pm === 'yarn' ? `yarn ${script}` : `npm run ${script}`
}
