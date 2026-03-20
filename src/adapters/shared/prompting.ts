import type { CreateOptions } from '../../types/stack.js';

export function shouldAcceptPromptDefaults(options: Pick<CreateOptions, 'yes'>): boolean {
  return Boolean(options.yes) || !process.stdin.isTTY;
}

export function resolveChoiceOverride<T extends string>(
  value: unknown,
  optionName: string,
  allowedValues: readonly T[]
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new Error(
      `Invalid value for --${optionName}: ${String(value)}. Expected one of: ${allowedValues.join(', ')}`
    );
  }

  return value as T;
}
