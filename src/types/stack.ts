export const STACK_IDS = [
  'vite',
  'next',
  'astro',
  'sveltekit',
  'nuxt',
  'angular',
  'remix',
  'nest',
  'hono',
  'express',
  'fastify',
  'elysia',
  'expo',
  'tauri',
  't3',
  'npm',
] as const;

export type StackId = (typeof STACK_IDS)[number];

export const STACK_OVERRIDE_KEYS = [
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

export type StackOverrideKey = (typeof STACK_OVERRIDE_KEYS)[number];

export interface CreateOptions {
  projectName: string;
  directory?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  yes?: boolean;
  template?: string;
  framework?: string;
  types?: string;
  tailwindVersion?: 'v3' | 'v4';
  style?: string;
  pattern?: string;
  buildTool?: string;
  testFramework?: string;
  typescript?: boolean;
  eslint?: boolean;
  prettier?: boolean;
  tailwind?: boolean;
  shadcn?: boolean;
  shadcnVue?: boolean;
  appRouter?: boolean;
  srcDir?: boolean;
  ssr?: boolean;
  routing?: boolean;
  zard?: boolean;
  cors?: boolean;
  helmet?: boolean;
  dotenv?: boolean;
  strict?: boolean;
  trpc?: boolean;
  prisma?: boolean;
  nextAuth?: boolean;
  git?: boolean;
}

export type StackCategory = 'frontend' | 'backend' | 'library' | 'mobile' | 'desktop' | 'fullstack';

export interface StackAdapter {
  id: StackId;
  name: string;
  description: string;
  category: StackCategory;

  create(options: CreateOptions): Promise<void>;
}

export interface CliOptions {
  yes?: boolean;
  debug?: boolean;
  help?: boolean;
  version?: boolean;
  git?: boolean;
  name?: string;
  projectName?: string;
  directory?: string;
  packageManager?: string;
  template?: string;
  framework?: string;
  types?: string;
  tailwindVersion?: 'v3' | 'v4';
  style?: string;
  pattern?: string;
  buildTool?: string;
  testFramework?: string;
  typescript?: boolean;
  eslint?: boolean;
  prettier?: boolean;
  tailwind?: boolean;
  shadcn?: boolean;
  shadcnVue?: boolean;
  appRouter?: boolean;
  srcDir?: boolean;
  ssr?: boolean;
  routing?: boolean;
  zard?: boolean;
  cors?: boolean;
  helmet?: boolean;
  dotenv?: boolean;
  strict?: boolean;
  trpc?: boolean;
  prisma?: boolean;
  nextAuth?: boolean;
  [key: string]: unknown;
}
