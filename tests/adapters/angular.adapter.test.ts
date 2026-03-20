import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  promptAngularCustomizations: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({ exec: mocks.exec }));
vi.mock('../../src/utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../src/prompts/customizations.js', () => ({
  promptAngularCustomizations: mocks.promptAngularCustomizations,
}));

import { angularAdapter } from '../../src/adapters/angular.adapter.js';

describe.sequential('angularAdapter', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.promptAngularCustomizations.mockResolvedValue({
      style: 'css',
      ssr: false,
      routing: true,
      zard: false,
    });
    fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/core.json')) {
        return {
          json: async () => ({
            files: [
              {
                content:
                  "import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';\n\nexport function provideZard(): EnvironmentProviders {\n  return makeEnvironmentProviders([]);\n}\n",
                name: 'provider/providezard.ts',
              },
              {
                content: "export * from './provider/providezard';\n",
                name: 'index.ts',
              },
            ],
          }),
          ok: true,
        };
      }

      return {
        json: async () => ({
          files: [
            {
              content:
                "import { type ClassValue, clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\n\nexport function mergeClasses(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n",
              name: 'merge-classes.ts',
            },
            {
              content: "export * from './merge-classes';\n",
              name: 'index.ts',
            },
          ],
        }),
        ok: true,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    tempDir = await mkdtemp(join(tmpdir(), 'scafix-angular-adapter-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    mocks.exec.mockImplementation(
      async (_command: string, args: string[], options: { cwd?: string }) => {
        const dirIdx = args.indexOf('new');
        const dir = dirIdx >= 0 ? (args[dirIdx + 1] as string) : undefined;
        if (!dir || options?.cwd !== tempDir) return;
        const projectPath = join(tempDir, dir);
        await mkdir(join(projectPath, 'src', 'app'), { recursive: true });
        await writeFile(
          join(projectPath, 'package.json'),
          `${JSON.stringify({ dependencies: { '@angular/core': '^20.0.0' }, name: dir }, null, 2)}\n`
        );
        await writeFile(join(projectPath, 'src', 'styles.css'), 'body {}\n');
        await writeFile(
          join(projectPath, 'src', 'app', 'app.config.ts'),
          "import { ApplicationConfig } from '@angular/core';\n\nexport const appConfig: ApplicationConfig = {\n  providers: [],\n};\n"
        );
        await writeFile(
          join(projectPath, 'tsconfig.json'),
          `{
  "compilerOptions": {
    /* Angular writes JSONC here. */
  },
}\n`
        );
      }
    );
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    vi.unstubAllGlobals();
    await rm(tempDir, { force: true, recursive: true });
  });

  it('calls @angular/cli new via npx', async () => {
    await angularAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-angular',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        '@angular/cli@latest',
        'new',
        'demo-angular',
        '--interactive=false',
        '--defaults',
        '--ai-config',
        'none',
      ]),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('always disables Angular CLI git initialisation so root commands remain the single git owner', async () => {
    await angularAdapter.create({
      git: true,
      packageManager: 'npm',
      projectName: 'demo-angular-git',
      yes: true,
    });

    expect(mocks.exec).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        '@angular/cli@latest',
        'new',
        'demo-angular-git',
        '--skip-git',
      ]),
      expect.objectContaining({ cwd: tempDir, stdio: 'inherit' })
    );
  });

  it('runs zard/ui setup when requested', async () => {
    mocks.promptAngularCustomizations.mockResolvedValue({
      style: 'css',
      ssr: false,
      routing: true,
      zard: true,
    });

    await angularAdapter.create({
      packageManager: 'npm',
      projectName: 'demo-angular-zard',
      yes: true,
    });

    const projectPath = join(tempDir, 'demo-angular-zard');
    const componentsJson = JSON.parse(await readFile(join(projectPath, 'components.json'), 'utf8')) as {
      aliases: { core: string; utils: string };
      tailwind: { baseColor: string; css: string };
    };
    const appConfig = await readFile(join(projectPath, 'src', 'app', 'app.config.ts'), 'utf8');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(componentsJson.tailwind.baseColor).toBe('neutral');
    expect(componentsJson.tailwind.css).toBe('src/styles.css');
    expect(componentsJson.aliases.core).toBe('@/shared/core');
    expect(componentsJson.aliases.utils).toBe('@/shared/utils');
    expect(appConfig).toContain("import { provideZard } from '@/shared/core/provider/providezard';");
    expect(appConfig).toContain('provideZard()');
    expect(mocks.exec).toHaveBeenCalledWith(
      'npm',
      expect.arrayContaining(['install', 'class-variance-authority', 'clsx', 'tailwind-merge']),
      expect.objectContaining({
        cwd: projectPath,
        stdio: 'inherit',
      })
    );
  });

  it('cleans up on failure', async () => {
    mocks.exec.mockRejectedValue(new Error('angular failed'));

    await expect(
      angularAdapter.create({
        directory: 'apps/demo-angular-fail',
        packageManager: 'npm',
        projectName: 'demo-angular-fail',
      })
    ).rejects.toThrow('angular failed');

    await expect(access(join(tempDir, 'apps'))).rejects.toThrow();
  });
});
