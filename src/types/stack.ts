export interface CreateOptions {
  projectName: string;
  directory?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  yes?: boolean;
  typescript?: boolean;
  eslint?: boolean;
  prettier?: boolean;
  git?: boolean;
  [key: string]: unknown; // Allow stack-specific options
}

export type StackCategory = 'frontend' | 'backend' | 'library' | 'mobile' | 'desktop' | 'fullstack';

export interface StackAdapter {
  id: string;
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
  [key: string]: unknown;
}
