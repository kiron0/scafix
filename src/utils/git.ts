import { rm } from 'fs/promises';
import { join } from 'path';

export async function stripGeneratedGitDirectory(projectPath: string): Promise<void> {
  await rm(join(projectPath, '.git'), {
    force: true,
    recursive: true,
  }).catch(() => undefined);
}
