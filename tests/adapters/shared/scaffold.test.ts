import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { reconcileGeneratedPackageJsonName } from '../../../src/adapters/shared/scaffold.js';

describe('shared scaffold helpers', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((directory) => rm(directory, { force: true, recursive: true })));
    tempDirs.length = 0;
  });

  it('reconciles package metadata and removes scaffold-created git state', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'scafix-shared-scaffold-'));
    tempDirs.push(tempDir);
    const projectPath = join(tempDir, 'apps', 'web');

    await mkdir(join(projectPath, '.git'), { recursive: true });
    await writeFile(
      join(projectPath, 'package.json'),
      `${JSON.stringify({ name: 'web' }, null, 2)}\n`
    );

    await reconcileGeneratedPackageJsonName(projectPath, 'Marketing Site', 'apps/web');

    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8')) as {
      name: string;
    };

    expect(packageJson.name).toBe('marketing-site');
    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
  });
});
