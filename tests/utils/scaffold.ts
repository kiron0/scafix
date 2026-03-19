import { execFileSync } from 'child_process';
import { existsSync, symlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslintCliPath = join(packageRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
const sharedNodeModulesPath = join(packageRoot, 'node_modules');

function ensureNodeModulesLink(projectPath: string): void {
  const projectNodeModulesPath = join(projectPath, 'node_modules');
  if (!existsSync(projectNodeModulesPath)) {
    symlinkSync(sharedNodeModulesPath, projectNodeModulesPath, 'dir');
  }
}

export function runGeneratedLint(projectPath: string, pattern: string): void {
  ensureNodeModulesLink(projectPath);

  try {
    execFileSync(
      process.execPath,
      [eslintCliPath, pattern, '--resolve-plugins-relative-to', packageRoot],
      {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
  } catch (error) {
    const lintError = error as Error & {
      code?: number | string;
      status?: number | null;
      signal?: string | null;
      stderr?: string | Buffer;
      stdout?: string | Buffer;
      output?: Array<string | Buffer | null>;
    };
    throw new Error(
      JSON.stringify(
        {
          code: lintError.code,
          status: lintError.status,
          signal: lintError.signal,
          stderr: lintError.stderr?.toString(),
          stdout: lintError.stdout?.toString(),
          output: lintError.output?.map((value) => (value == null ? null : value.toString())),
        },
        null,
        2
      )
    );
  }
}

export function getPackedFileNames(projectPath: string, cachePath: string): string[] {
  const packOutput = execFileSync('npm', ['pack', '--dry-run', '--json', '--cache', cachePath], {
    cwd: projectPath,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const [packSummary] = JSON.parse(packOutput) as Array<{
    files?: Array<{ path: string }>;
  }>;

  return (packSummary?.files ?? []).map((file) => file.path);
}
