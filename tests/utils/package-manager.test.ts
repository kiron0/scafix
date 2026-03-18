import { describe, expect, it } from "vitest";
import {
  getAddCommand,
  getDevCommand,
  getInstallCommand,
  getPublishCommand,
  getRunCommand,
  isPackageManager,
  resolvePackageManagerOption,
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

describe("getAddCommand", () => {
  const expected: Record<PackageManager, string> = {
    npm: "npm install scafix",
    pnpm: "pnpm add scafix",
    yarn: "yarn add scafix",
    bun: "bun add scafix",
  };

  it.each(packageManagers)("returns correct add command for %s", (pm) => {
    expect(getAddCommand(pm, "scafix")).toBe(expected[pm]);
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

describe("getRunCommand", () => {
  const expected: Record<PackageManager, string> = {
    npm: "npm run build",
    pnpm: "pnpm build",
    yarn: "yarn build",
    bun: "bun run build",
  };

  it.each(packageManagers)("returns correct run command for %s", (pm) => {
    expect(getRunCommand(pm, "build")).toBe(expected[pm]);
  });
});

describe("getPublishCommand", () => {
  it.each(packageManagers)("returns correct publish command for %s", (pm) => {
    expect(getPublishCommand(pm)).toBe(`${pm} publish`);
  });
});

describe("package manager validation", () => {
  it.each(packageManagers)("recognizes %s as a supported package manager", (pm) => {
    expect(isPackageManager(pm)).toBe(true);
    expect(resolvePackageManagerOption(pm)).toBe(pm);
  });

  it("rejects unsupported package managers", () => {
    expect(isPackageManager("pip")).toBe(false);
    expect(resolvePackageManagerOption("pip")).toBeNull();
    expect(resolvePackageManagerOption(undefined)).toBeNull();
  });
});
