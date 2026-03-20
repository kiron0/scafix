import type { CreateOptions } from '../../types/stack.js';

const STACK_OVERRIDE_KEYS = [
  'template',
  'framework',
  'types',
  'tailwindVersion',
  'style',
  'pattern',
  'buildTool',
  'testFramework',
  'typescript',
  'eslint',
  'prettier',
  'tailwind',
  'shadcn',
  'shadcnVue',
  'appRouter',
  'srcDir',
  'ssr',
  'routing',
  'zard',
  'cors',
  'helmet',
  'dotenv',
  'strict',
  'trpc',
  'prisma',
  'nextAuth',
] as const;

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
  options: CreateOptions,
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

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}
