import type { StackId, StackOverrideKey } from '../types/stack.js';

export interface StackCapabilityConfig {
  supportedOverrides: readonly StackOverrideKey[];
}

export const STACK_CAPABILITIES: Record<StackId, StackCapabilityConfig> = {
  vite: {
    supportedOverrides: [
      'template',
      'framework',
      'typescript',
      'tailwind',
      'tailwindVersion',
      'shadcn',
      'shadcnVue',
      'prettier',
    ],
  },
  next: {
    supportedOverrides: [
      'typescript',
      'tailwind',
      'shadcn',
      'eslint',
      'prettier',
      'appRouter',
      'srcDir',
    ],
  },
  astro: {
    supportedOverrides: ['template'],
  },
  sveltekit: {
    supportedOverrides: ['template', 'types', 'typescript'],
  },
  nuxt: {
    supportedOverrides: ['template'],
  },
  angular: {
    supportedOverrides: ['style', 'ssr', 'routing', 'zard'],
  },
  remix: {
    supportedOverrides: [],
  },
  nest: {
    supportedOverrides: ['typescript', 'strict'],
  },
  hono: {
    supportedOverrides: ['template'],
  },
  express: {
    supportedOverrides: ['typescript', 'pattern', 'eslint', 'prettier', 'cors', 'helmet', 'dotenv'],
  },
  fastify: {
    supportedOverrides: ['typescript'],
  },
  elysia: {
    supportedOverrides: [],
  },
  expo: {
    supportedOverrides: ['template'],
  },
  tauri: {
    supportedOverrides: ['template'],
  },
  t3: {
    supportedOverrides: ['tailwind', 'trpc', 'prisma', 'nextAuth', 'appRouter'],
  },
  npm: {
    supportedOverrides: ['typescript', 'buildTool', 'eslint', 'prettier', 'testFramework'],
  },
};

export function getSupportedOverrideKeys(stackId: StackId): readonly StackOverrideKey[] {
  return STACK_CAPABILITIES[stackId].supportedOverrides;
}
