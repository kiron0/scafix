import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach } from 'vitest';

const PACKAGE_MANAGER_CACHE_ENV_VARS = [
  'BUN_INSTALL_CACHE_DIR',
  'npm_config_cache',
  'PNPM_STORE_DIR',
  'YARN_CACHE_FOLDER',
] as const;

export function useEphemeralPackageManagerCache(): void {
  let cacheRoot = '';
  let previousEnvValues: Partial<Record<(typeof PACKAGE_MANAGER_CACHE_ENV_VARS)[number], string>> =
    {};

  beforeEach(async () => {
    cacheRoot = await mkdtemp(join(tmpdir(), 'scafix-pm-cache-'));
    previousEnvValues = {};

    for (const envVar of PACKAGE_MANAGER_CACHE_ENV_VARS) {
      const currentValue = process.env[envVar];
      if (currentValue !== undefined) {
        previousEnvValues[envVar] = currentValue;
      }
    }

    process.env.npm_config_cache = join(cacheRoot, 'npm');
    process.env.YARN_CACHE_FOLDER = join(cacheRoot, 'yarn');
    process.env.PNPM_STORE_DIR = join(cacheRoot, 'pnpm');
    process.env.BUN_INSTALL_CACHE_DIR = join(cacheRoot, 'bun');
  });

  afterEach(async () => {
    for (const envVar of PACKAGE_MANAGER_CACHE_ENV_VARS) {
      const previousValue = previousEnvValues[envVar];
      if (previousValue === undefined) {
        delete process.env[envVar];
      } else {
        process.env[envVar] = previousValue;
      }
    }

    if (cacheRoot) {
      await rm(cacheRoot, { force: true, recursive: true });
      cacheRoot = '';
    }
  });
}
