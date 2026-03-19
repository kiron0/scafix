import { viteReactAdapter } from './vite.adapter.js';
import { nextAdapter } from './next.adapter.js';
import { astroAdapter } from './astro.adapter.js';
import { sveltekitAdapter } from './sveltekit.adapter.js';
import { nuxtAdapter } from './nuxt.adapter.js';
import { angularAdapter } from './angular.adapter.js';
import { remixAdapter } from './remix.adapter.js';
import { nestAdapter } from './nest.adapter.js';
import { honoAdapter } from './hono.adapter.js';
import { expressAdapter } from './express.adapter.js';
import { fastifyAdapter } from './fastify.adapter.js';
import { elysiaAdapter } from './elysia.adapter.js';
import { expoAdapter } from './expo.adapter.js';
import { tauriAdapter } from './tauri.adapter.js';
import { t3Adapter } from './t3.adapter.js';
import { npmPackageAdapter } from './npm.adapter.js';
import type { StackAdapter } from '../types/stack.js';

export const adapters: StackAdapter[] = [
  viteReactAdapter,
  nextAdapter,
  astroAdapter,
  sveltekitAdapter,
  nuxtAdapter,
  angularAdapter,
  remixAdapter,
  nestAdapter,
  honoAdapter,
  expressAdapter,
  fastifyAdapter,
  elysiaAdapter,
  expoAdapter,
  tauriAdapter,
  t3Adapter,
  npmPackageAdapter,
];

export const AVAILABLE_STACK_IDS = adapters.map((adapter) => adapter.id);
export const AVAILABLE_STACK_IDS_LABEL = AVAILABLE_STACK_IDS.join(', ');

export function getAdapterById(id: string): StackAdapter | undefined {
  return adapters.find((adapter) => adapter.id === id);
}
