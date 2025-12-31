import { viteReactAdapter } from "./vite-react.adapter.js";
import { nextAdapter } from "./next.adapter.js";
import { expressAdapter } from "./express.adapter.js";
import { npmPackageAdapter } from "./npm-package.adapter.js";
import type { StackAdapter } from "../types/stack.js";

export const adapters: StackAdapter[] = [
  viteReactAdapter,
  nextAdapter,
  expressAdapter,
  npmPackageAdapter,
];

export function getAdapterById(id: string): StackAdapter | undefined {
  return adapters.find((adapter) => adapter.id === id);
}
