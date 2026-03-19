import { describe, expect, it } from 'vitest';
import {
  promptNextCustomizations,
  promptNpmPackageCustomizations,
  promptViteReactCustomizations,
} from '../../src/prompts/customizations.js';

describe('promptViteReactCustomizations', () => {
  it('returns only supported defaults in --yes mode', async () => {
    const result = await promptViteReactCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.tailwind).toBe(false);
    expect(result.shadcn).toBe(false);
    expect(result.prettier).toBe(false);
    expect('eslint' in result).toBe(false);
    expect('shadcnOptions' in result).toBe(false);
  });
});

describe('promptNextCustomizations', () => {
  it('returns only supported defaults in --yes mode', async () => {
    const result = await promptNextCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.tailwind).toBe(true);
    expect(result.shadcn).toBe(false);
    expect(result.eslint).toBe(true);
    expect(result.prettier).toBe(false);
    expect(result.appRouter).toBe(true);
    expect(result.srcDir).toBe(true);
    expect('tailwindVersion' in result).toBe(false);
    expect('shadcnOptions' in result).toBe(false);
  });
});

describe('promptNpmPackageCustomizations', () => {
  it('returns deterministic defaults in --yes mode', async () => {
    const result = await promptNpmPackageCustomizations({ yes: true });
    expect(result.typescript).toBe(true);
    expect(result.buildTool).toBe('tsup');
    expect(result.eslint).toBe(true);
    expect(result.prettier).toBe(false);
    expect(result.testFramework).toBe('none');
  });
});
