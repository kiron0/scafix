import { access, mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { stripGeneratedGitDirectory } from '../../src/utils/git.js';

describe('stripGeneratedGitDirectory', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((directory) => rm(directory, { force: true, recursive: true })));
    tempDirs.length = 0;
  });

  it('removes a generated .git directory without touching the project', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'scafix-git-utils-'));
    tempDirs.push(tempDir);
    const projectPath = join(tempDir, 'demo-app');

    await mkdir(join(projectPath, '.git'), { recursive: true });
    await writeFile(join(projectPath, 'package.json'), '{}\n');

    await stripGeneratedGitDirectory(projectPath);

    await expect(access(join(projectPath, '.git'))).rejects.toThrow();
    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
  });

  it('succeeds when no generated .git directory exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'scafix-git-utils-'));
    tempDirs.push(tempDir);
    const projectPath = join(tempDir, 'demo-app');

    await mkdir(projectPath, { recursive: true });

    await expect(stripGeneratedGitDirectory(projectPath)).resolves.toBeUndefined();
  });
});
