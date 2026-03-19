import * as p from '@clack/prompts';
import chalk from 'chalk';
import { APP_CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { CliOptions } from '../types/stack.js';
import { CliExitError } from '../utils/cli-error.js';
import { initCommand } from './init.js';

export async function rootCommand(options: CliOptions = {}): Promise<void> {
  if (options.yes) {
    logger.error(
      'Non-interactive usage requires an explicit stack: use `scafix create <stack> --yes`.'
    );
    throw new CliExitError(1);
  }

  if (!process.stdin.isTTY) {
    logger.error(
      'Interactive root usage requires a TTY. Re-run in a terminal or use `scafix create <stack> --yes`.'
    );
    throw new CliExitError(1);
  }

  if (process.stdin.isTTY) {
    p.intro(chalk.cyan.bold(`${APP_CONFIG.displayName} CLI v${APP_CONFIG.version}`));
    p.note(APP_CONFIG.description, 'About');
  }

  await initCommand(options);
}
