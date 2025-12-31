import { execa } from "execa";
import { logger } from "./logger.js";

export interface ExecOptions {
  cwd?: string;
  stdio?: "inherit" | "pipe" | "ignore";
  env?: NodeJS.ProcessEnv;
}

export async function exec(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<void> {
  const { cwd = process.cwd(), stdio = "inherit", env = process.env } = options;

  logger.debug(`Executing: ${command} ${args.join(" ")}`);

  try {
    await execa(command, args, {
      cwd,
      stdio,
      env: { ...env, ...process.env },
    });
  } catch (error) {
    logger.error(
      `Failed to execute ${command}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
