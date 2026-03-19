import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readmePath = join(packageRoot, 'README.md');
const packCachePath = join(packageRoot, '.npm-pack-cache');

let packedTarballPath: string | null = null;

function packPackage(): {
  files: string[];
  filename: string;
} {
  const packOutput = execFileSync('npm', ['pack', '--json', '--cache', packCachePath], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const [packSummary] = JSON.parse(packOutput) as Array<{
    filename: string;
    files?: Array<{ path: string }>;
  }>;

  return {
    files: (packSummary?.files ?? []).map((file) => file.path),
    filename: packSummary.filename,
  };
}

function extractPackedFile(relativePath: string): string {
  if (!packedTarballPath) {
    throw new Error('Package tarball has not been created');
  }

  return execFileSync('tar', ['-xOf', packedTarballPath, relativePath], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe.sequential('package surface', () => {
  beforeAll(
    () => {
      execFileSync('npm', ['run', 'build'], {
        cwd: packageRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    },
    30_000
  );

  afterEach(async () => {
    if (packedTarballPath) {
      await rm(packedTarballPath, { force: true });
      packedTarballPath = null;
    }

    await rm(packCachePath, { force: true, recursive: true });
  });

  it('documents the root command flow and shared flags in the README', async () => {
    const readme = await readFile(readmePath, 'utf8');

    expect(readme).toContain(
      'npx scafix --name my-app --directory apps/my-app --package-manager pnpm'
    );
    expect(readme).toContain('npx scafix --name api-starter --directory services/api');
    expect(readme).toContain(
      'npx scafix create next --name dashboard --yes --package-manager pnpm'
    );
    expect(readme).toContain('npx scafix create sveltekit');
    expect(readme).toContain('npx scafix create nuxt --name content-site --package-manager pnpm');
    expect(readme).toContain('npx scafix create nest --name api-core --package-manager pnpm');
    expect(readme).toContain('npx scafix create hono --directory services/edge-api');
  });

  it('packs an executable, documented CLI surface', () => {
    const packSummary = packPackage();
    packedTarballPath = join(packageRoot, packSummary.filename);

    expect(packSummary.files).toContain('dist/index.js');
    expect(packSummary.files).toContain('README.md');
    expect(packSummary.files).toContain('package.json');

    const packedPackageJson = JSON.parse(extractPackedFile('package/package.json')) as {
      bin?: Record<string, string>;
    };
    const packedCliEntry = extractPackedFile('package/dist/index.js');
    const packedReadme = extractPackedFile('package/README.md');

    expect(packedPackageJson.bin?.scafix).toBe('./dist/index.js');
    expect(packedCliEntry.startsWith('#!/usr/bin/env node')).toBe(true);
    expect(packedReadme).toContain(
      'npx scafix --name my-app --directory apps/my-app --package-manager pnpm'
    );
    expect(packedReadme).toContain('npx scafix create sveltekit');
    expect(packedReadme).toContain(
      'npx scafix create nuxt --name content-site --package-manager pnpm'
    );
    expect(packedReadme).toContain('npx scafix create nest --name api-core --package-manager pnpm');
    expect(packedReadme).toContain('npx scafix create hono --directory services/edge-api');
  });
});
