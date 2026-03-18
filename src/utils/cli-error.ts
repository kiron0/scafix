export class CliExitError extends Error {
  exitCode: number;

  constructor(exitCode: number, message = "") {
    super(message);
    this.name = "CliExitError";
    this.exitCode = exitCode;
  }
}

export function isCliExitError(error: unknown): error is CliExitError {
  return error instanceof CliExitError;
}
