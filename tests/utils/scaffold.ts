import { execFileSync } from 'child_process';
import { existsSync, symlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslintCliPath = join(packageRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
const sharedNodeModulesPath = join(packageRoot, 'node_modules');
const windowsShell = process.env.ComSpec ?? 'cmd.exe';

function execNpmSync(args: string[], options: Parameters<typeof execFileSync>[2]): string {
  if (process.platform === 'win32') {
    return execFileSync(windowsShell, ['/d', '/s', '/c', 'npm', ...args], options);
  }

  return execFileSync('npm', args, options);
}

function ensureNodeModulesLink(projectPath: string): void {
  const projectNodeModulesPath = join(projectPath, 'node_modules');
  if (!existsSync(projectNodeModulesPath)) {
    symlinkSync(
      sharedNodeModulesPath,
      projectNodeModulesPath,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
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
  const packOutput = execNpmSync(['pack', '--dry-run', '--json', '--cache', cachePath], {
    cwd: projectPath,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const [packSummary] = JSON.parse(packOutput) as Array<{
    files?: Array<{ path: string }>;
  }>;

  return (packSummary?.files ?? []).map((file) => file.path);
}

export function runGeneratedCommand(
  projectPath: string,
  command: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {}
): string {
  try {
    return execFileSync(command, args, {
      cwd: projectPath,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: 'pipe',
    });
  } catch (error) {
    const commandError = error as Error & {
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
          args,
          code: commandError.code,
          command,
          signal: commandError.signal,
          status: commandError.status,
          stderr: commandError.stderr?.toString(),
          stdout: commandError.stdout?.toString(),
        },
        null,
        2
      )
    );
  }
}
