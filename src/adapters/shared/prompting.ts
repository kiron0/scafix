import { getSupportedOverrideKeys } from '../../config/stack-capabilities.js';
import type { CreateOptions, StackId, StackOverrideKey } from '../../types/stack.js';
import { STACK_OVERRIDE_KEYS } from '../../types/stack.js';

type OverrideOptions = Partial<Pick<CreateOptions, StackOverrideKey>>;

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

export function assertSupportedOverrides(
  options: OverrideOptions,
  supportedKeys: readonly string[]
): void {
  const supported = new Set(supportedKeys);

  for (const key of STACK_OVERRIDE_KEYS) {
    if (supported.has(key) || options[key] === undefined) {
      continue;
    }

    throw new Error(`Option --${toKebabCase(key)} is not supported for this stack`);
  }
}

export function assertSupportedStackOverrides(stackId: StackId, options: OverrideOptions): void {
  assertSupportedOverrides(options, getSupportedOverrideKeys(stackId));
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}
