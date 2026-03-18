import { describe, expect, it } from "vitest";
import {
  validateDirectory,
  validateProjectName,
} from "../../src/utils/validate.js";

describe("validateProjectName", () => {
  it("returns true for a valid name", () => {
    expect(validateProjectName("my-project")).toBe(true);
  });

  it("returns true for names with numbers and hyphens", () => {
    expect(validateProjectName("my-app-123")).toBe(true);
  });

  it("returns false for an empty string", () => {
    expect(validateProjectName("")).toBe(false);
  });

  it("returns false for a whitespace-only string", () => {
    expect(validateProjectName("   ")).toBe(false);
  });

  it("returns false for names containing invalid characters", () => {
    expect(validateProjectName("my/project")).toBe(false);
    expect(validateProjectName("my:project")).toBe(false);
    expect(validateProjectName("my*project")).toBe(false);
    expect(validateProjectName("my?project")).toBe(false);
  });

  it("returns false for Windows reserved names (case-insensitive)", () => {
    expect(validateProjectName("CON")).toBe(false);
    expect(validateProjectName("con")).toBe(false);
    expect(validateProjectName("NUL")).toBe(false);
    expect(validateProjectName("COM1")).toBe(false);
    expect(validateProjectName("LPT9")).toBe(false);
  });
});

describe("validateDirectory", () => {
  it("returns an object with valid, exists, and path fields", () => {
    const result = validateDirectory("non-existent-dir-xyz");
    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("exists");
    expect(result).toHaveProperty("path");
  });

  it("valid is always true", () => {
    const result = validateDirectory("any-dir");
    expect(result.valid).toBe(true);
  });

  it("exists is false for a directory that does not exist", () => {
    const result = validateDirectory("__this_dir_does_not_exist__");
    expect(result.exists).toBe(false);
  });

  it("path is an absolute path containing the directory name", () => {
    const result = validateDirectory("my-project");
    expect(result.path).toContain("my-project");
    expect(result.path.startsWith("/")).toBe(true);
  });
});
