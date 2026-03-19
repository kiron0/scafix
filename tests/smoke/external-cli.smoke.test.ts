import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { astroAdapter } from '../../src/adapters/astro.adapter.js';
import { nextAdapter } from '../../src/adapters/next.adapter.js';
import { nestAdapter } from '../../src/adapters/nest.adapter.js';
import { nuxtAdapter } from '../../src/adapters/nuxt.adapter.js';
import { honoAdapter } from '../../src/adapters/hono.adapter.js';
import { sveltekitAdapter } from '../../src/adapters/sveltekit.adapter.js';
import { viteReactAdapter } from '../../src/adapters/vite.adapter.js';
import type { PackageManager } from '../../src/utils/package-manager.js';
import { useEphemeralPackageManagerCache } from './utils/package-manager-cache.js';
import { runGeneratedCommand } from '../utils/scaffold.js';

const describeIf = process.env.SCAFIX_RUN_NETWORK_SMOKE === '1' ? describe : describe.skip;
useEphemeralPackageManagerCache();

function isCommandAvailable(command: string): boolean {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(lookupCommand, [command], { stdio: 'ignore' }).status === 0;
}

const requestedPackageManagers = new Set(
  (process.env.SCAFIX_SMOKE_PACKAGE_MANAGERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is PackageManager => ['npm', 'pnpm', 'yarn', 'bun'].includes(value))
);

const availablePackageManagers: PackageManager[] = (['npm', 'pnpm', 'yarn', 'bun'] as const).filter(
  (pm) =>
    isCommandAvailable(pm) &&
    (requestedPackageManagers.size === 0 || requestedPackageManagers.has(pm))
);

function getScriptCommand(packageManager: PackageManager, script: string): [string, string[]] {
  if (packageManager === 'bun') {
    return ['bun', ['run', script]];
  }

  return [packageManager, ['run', script]];
}

describeIf.sequential('external CLI smoke', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-network-smoke-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each(availablePackageManagers)(
    'scaffolds a real NestJS project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-nest-app-${packageManager}`;
      await nestAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'main.ts'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.build).toBeTruthy();

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'main.js'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps NestJS package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await nestAdapter.create({
        directory: `services/api-${packageManager}`,
        packageManager,
        projectName: `Core API ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'services', `api-${packageManager}`);
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`core-api-${packageManager}`);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'main.js'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real Hono project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-hono-app-${packageManager}`;
      await honoAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'index.ts'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.build).toBeTruthy();

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.js'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps Hono package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await honoAdapter.create({
        directory: `services/edge-api-${packageManager}`,
        packageManager,
        projectName: `Edge API ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'services', `edge-api-${packageManager}`);
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`edge-api-${packageManager}`);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.js'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real SvelteKit project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-sveltekit-app-${packageManager}`;
      await sveltekitAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, 'src', 'routes', '+page.svelte'))
      ).resolves.toBeUndefined();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.check).toBeTruthy();
      expect(packageJson.scripts?.build).toBeTruthy();

      const [checkCommand, checkArgs] = getScriptCommand(packageManager, 'check');
      runGeneratedCommand(projectPath, checkCommand, checkArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps SvelteKit package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await sveltekitAdapter.create({
        directory: `apps/web-${packageManager}`,
        packageManager,
        projectName: `Marketing Site ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'apps', `web-${packageManager}`);
      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`marketing-site-${packageManager}`);

      const [checkCommand, checkArgs] = getScriptCommand(packageManager, 'check');
      runGeneratedCommand(projectPath, checkCommand, checkArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real Nuxt project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-nuxt-app-${packageManager}`;
      await nuxtAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'app', 'app.vue'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.build).toBeTruthy();

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(
        access(join(projectPath, '.output', 'server', 'index.mjs'))
      ).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps Nuxt package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await nuxtAdapter.create({
        directory: `apps/content-site-${packageManager}`,
        packageManager,
        projectName: `Marketing Site ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'apps', `content-site-${packageManager}`);
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`marketing-site-${packageManager}`);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(
        access(join(projectPath, '.output', 'server', 'index.mjs'))
      ).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real Astro project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-astro-app-${packageManager}`;
      await astroAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, 'src', 'pages', 'index.astro'))
      ).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.build).toBeTruthy();

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps Astro package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await astroAdapter.create({
        directory: `apps/content-site-${packageManager}`,
        packageManager,
        projectName: `Marketing Site ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'apps', `content-site-${packageManager}`);
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`marketing-site-${packageManager}`);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real Vite project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-vite-app-${packageManager}`;
      await viteReactAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'main.tsx'))).resolves.toBeUndefined();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.lint).toBeTruthy();
      expect(packageJson.scripts?.build).toBeTruthy();

      const [lintCommand, lintArgs] = getScriptCommand(packageManager, 'lint');
      runGeneratedCommand(projectPath, lintCommand, lintArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps Vite package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await viteReactAdapter.create({
        directory: `apps/marketing-web-${packageManager}`,
        packageManager,
        projectName: `Marketing Site ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'apps', `marketing-web-${packageManager}`);
      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`marketing-site-${packageManager}`);

      const [lintCommand, lintArgs] = getScriptCommand(packageManager, 'lint');
      runGeneratedCommand(projectPath, lintCommand, lintArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real Vite Vue project with shadcn-vue through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-vite-vue-app-${packageManager}`;
      await viteReactAdapter.create({
        directory: projectName,
        framework: 'vue',
        packageManager,
        projectName,
        shadcnVue: true,
        tailwind: true,
        tailwindVersion: 'v4',
        typescript: true,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'components.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'main.ts'))).resolves.toBeUndefined();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.build).toBeTruthy();

      const tsconfigApp = JSON.parse(await readFile(join(projectPath, 'tsconfig.app.json'), 'utf8'));
      expect(tsconfigApp.compilerOptions?.baseUrl).toBe('.');
      expect(tsconfigApp.compilerOptions?.paths?.['@/*']).toEqual(['./src/*']);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs);

      await expect(access(join(projectPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'scaffolds a real Next.js project through the official CLI with %s',
    async (packageManager) => {
      const projectName = `smoke-next-app-${packageManager}`;
      await nextAdapter.create({
        packageManager,
        projectName,
        yes: true,
      });

      const projectPath = join(tempDir, projectName);
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'app', 'page.tsx'))).resolves.toBeUndefined();
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.scripts?.lint).toBeTruthy();
      expect(packageJson.scripts?.build).toBeTruthy();

      const [lintCommand, lintArgs] = getScriptCommand(packageManager, 'lint');
      runGeneratedCommand(projectPath, lintCommand, lintArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs, {
        CI: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      });

      await expect(access(join(projectPath, '.next', 'BUILD_ID'))).resolves.toBeUndefined();
    },
    300000
  );

  it.each(availablePackageManagers)(
    'keeps Next.js package metadata tied to the requested project name in a custom directory with %s',
    async (packageManager) => {
      await nextAdapter.create({
        directory: `apps/marketing-web-${packageManager}`,
        packageManager,
        projectName: `Marketing Site ${packageManager}`,
        yes: true,
      });

      const projectPath = join(tempDir, 'apps', `marketing-web-${packageManager}`);
      await expect(access(join(projectPath, '.git'))).rejects.toThrow();

      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(`marketing-site-${packageManager}`);

      const [lintCommand, lintArgs] = getScriptCommand(packageManager, 'lint');
      runGeneratedCommand(projectPath, lintCommand, lintArgs);

      const [buildCommand, buildArgs] = getScriptCommand(packageManager, 'build');
      runGeneratedCommand(projectPath, buildCommand, buildArgs, {
        CI: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      });

      await expect(access(join(projectPath, '.next', 'BUILD_ID'))).resolves.toBeUndefined();
    },
    300000
  );
});
