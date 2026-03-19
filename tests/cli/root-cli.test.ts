import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../src/config/index.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntry = join(packageRoot, 'dist', 'index.js');
const cliEntryUrl = pathToFileURL(cliEntry).href;

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe.sequential('built CLI root wiring', () => {
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

  it('advertises root-level project options in help output', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('-n, --name <name>');
    expect(result.stdout).toContain('-d, --directory <dir>');
    expect(result.stdout).toContain('--package-manager <pm>');
    expect(result.stdout).toContain('--no-git');
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

  it('exits with code 130 when interrupted with SIGINT', async () => {
    const readyToken = '__SCAFIX_READY__';
    const child = spawn(
      process.execPath,
      [
        '-e',
        `setInterval(() => {}, 1000); import(${JSON.stringify(cliEntryUrl)}).then(() => { console.log(${JSON.stringify(readyToken)}); }).catch((error) => { console.error(error); process.exit(1); });`,
      ],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    child.stdout.on('data', (chunk) => stdoutChunks.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderrChunks.push(String(chunk)));

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('CLI did not become ready before SIGINT')),
        2000
      );
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes(readyToken)) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.on('exit', () => {
        clearTimeout(timeout);
        reject(new Error('CLI exited before becoming ready'));
      });
    });
    child.kill('SIGINT');

    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.on('exit', (code, signal) => resolve({ code, signal }));
      }
    );

    expect(result.signal).toBeNull();
    expect(result.code).toBe(130);
    expect(stdoutChunks.join('')).toContain(readyToken);
    expect(stdoutChunks.join('')).toContain(APP_CONFIG.thankYouMessage);
    expect(stderrChunks.join('')).not.toContain('Error:');
  });
});
