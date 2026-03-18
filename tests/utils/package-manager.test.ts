import { describe, expect, it } from "vitest";
import {
  getDevCommand,
  getInstallCommand,
} from "../../src/utils/package-manager.js";
import type { PackageManager } from "../../src/utils/package-manager.js";

const packageManagers: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

describe("getInstallCommand", () => {
  const expected: Record<PackageManager, string> = {
    npm: "npm install",
    pnpm: "pnpm install",
    yarn: "yarn install",
    bun: "bun install",
  };

  it.each(packageManagers)("returns correct install command for %s", (pm) => {
    expect(getInstallCommand(pm)).toBe(expected[pm]);
  });
});

describe("getDevCommand", () => {
  const expected: Record<PackageManager, string> = {
    npm: "npm run dev",
    pnpm: "pnpm dev",
    yarn: "yarn dev",
    bun: "bun dev",
  };

  it.each(packageManagers)("returns correct dev command for %s", (pm) => {
    expect(getDevCommand(pm)).toBe(expected[pm]);
  });
});
