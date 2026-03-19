import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntry = join(packageRoot, 'dist', 'index.js');

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe.sequential('built CLI root wiring', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  });

  it('advertises root-level project options in help output', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('-n, --name <name>');
    expect(result.stdout).toContain('-d, --directory <dir>');
    expect(result.stdout).toContain('--package-manager <pm>');
    expect(result.stdout).toContain('-y, --yes');
    expect(result.stdout).toContain('--debug');
  });

  it('routes root --yes through the CLI error flow instead of commander', () => {
    const result = runCli(['--yes']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Non-interactive usage requires an explicit stack: use `scafix create <stack> --yes`.'
    );
    expect(result.stderr).not.toContain("unknown option '--yes'");
  });
});
