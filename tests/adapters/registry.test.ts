import { describe, expect, it } from "vitest";
import { adapters, getAdapterById } from "../../src/adapters/index.js";

describe("adapters registry", () => {
  it("contains exactly 4 adapters", () => {
    expect(adapters).toHaveLength(4);
  });

  it("includes all expected stack IDs", () => {
    const ids = adapters.map((a) => a.id);
    expect(ids).toContain("vite");
    expect(ids).toContain("next");
    expect(ids).toContain("express");
    expect(ids).toContain("npm");
  });

  it("every adapter has required fields", () => {
    for (const adapter of adapters) {
      expect(typeof adapter.id).toBe("string");
      expect(adapter.id.length).toBeGreaterThan(0);
      expect(typeof adapter.name).toBe("string");
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.description).toBe("string");
      expect(adapter.description.length).toBeGreaterThan(0);
      expect(typeof adapter.create).toBe("function");
    }
  });
});

describe("getAdapterById", () => {
  it("returns the correct adapter for a known id", () => {
    const adapter = getAdapterById("vite");
    expect(adapter).toBeDefined();
    expect(adapter?.id).toBe("vite");
    expect(adapter?.name).toBe("Vite");
    expect(adapter?.backend).toBe(false);
  });

  it("returns the next adapter", () => {
    const adapter = getAdapterById("next");
    expect(adapter?.id).toBe("next");
    expect(adapter?.name).toBe("Next.js");
    expect(adapter?.backend).toBe(false);
  });

  it("returns the express adapter", () => {
    const adapter = getAdapterById("express");
    expect(adapter?.id).toBe("express");
  });

  it("returns the npm adapter", () => {
    const adapter = getAdapterById("npm");
    expect(adapter?.id).toBe("npm");
  });

  it("returns undefined for an unknown id", () => {
    expect(getAdapterById("unknown-stack")).toBeUndefined();
  });

  it("is case-sensitive", () => {
    expect(getAdapterById("Vite")).toBeUndefined();
    expect(getAdapterById("NEXT")).toBeUndefined();
  });
});
