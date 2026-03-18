import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../../src/config/index.js";

describe("APP_CONFIG", () => {
  it("has a non-empty name", () => {
    expect(APP_CONFIG.name).toBeTruthy();
    expect(typeof APP_CONFIG.name).toBe("string");
  });

  it("has a capitalised displayName derived from name", () => {
    const expected =
      APP_CONFIG.name.charAt(0).toUpperCase() + APP_CONFIG.name.slice(1);
    expect(APP_CONFIG.displayName).toBe(expected);
  });

  it("has a version matching semver format", () => {
    expect(APP_CONFIG.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("has a non-empty description", () => {
    expect(APP_CONFIG.description.length).toBeGreaterThan(0);
  });

  it("thankYouMessage includes the displayName", () => {
    expect(APP_CONFIG.thankYouMessage).toContain(APP_CONFIG.displayName);
  });
});
