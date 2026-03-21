import { describe, expect, it } from 'vitest';
import { adapters, getAdapterById } from '../../src/adapters/index.js';
import { STACK_CAPABILITIES } from '../../src/config/stack-capabilities.js';
import { STACK_OVERRIDE_KEYS } from '../../src/types/stack.js';

describe('adapters registry', () => {
  it('contains exactly 16 adapters', () => {
    expect(adapters).toHaveLength(16);
  });

  it('includes all expected stack IDs', () => {
    const ids = adapters.map((a) => a.id);
    expect(ids).toContain('vite');
    expect(ids).toContain('next');
    expect(ids).toContain('astro');
    expect(ids).toContain('sveltekit');
    expect(ids).toContain('nuxt');
    expect(ids).toContain('angular');
    expect(ids).toContain('remix');
    expect(ids).toContain('nest');
    expect(ids).toContain('hono');
    expect(ids).toContain('express');
    expect(ids).toContain('fastify');
    expect(ids).toContain('elysia');
    expect(ids).toContain('expo');
    expect(ids).toContain('tauri');
    expect(ids).toContain('t3');
    expect(ids).toContain('npm');
  });

  it('every adapter has required fields', () => {
    for (const adapter of adapters) {
      expect(typeof adapter.id).toBe('string');
      expect(adapter.id.length).toBeGreaterThan(0);
      expect(typeof adapter.name).toBe('string');
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.description).toBe('string');
      expect(adapter.description.length).toBeGreaterThan(0);
      expect(typeof adapter.create).toBe('function');
    }
  });

  it('defines centralized capability metadata for every adapter', () => {
    for (const adapter of adapters) {
      expect(STACK_CAPABILITIES[adapter.id]).toBeDefined();
    }
  });

  it('only uses declared override keys in the capability manifest', () => {
    const allowedKeys = new Set(STACK_OVERRIDE_KEYS);

    for (const capability of Object.values(STACK_CAPABILITIES)) {
      for (const key of capability.supportedOverrides) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });
});

describe('getAdapterById', () => {
  it('returns the correct adapter for a known id', () => {
    const adapter = getAdapterById('vite');
    expect(adapter).toBeDefined();
    expect(adapter?.id).toBe('vite');
    expect(adapter?.name).toBe('Vite');
    expect(adapter?.category).toBe('frontend');
  });

  it('returns the next adapter', () => {
    const adapter = getAdapterById('next');
    expect(adapter?.id).toBe('next');
    expect(adapter?.name).toBe('Next.js');
    expect(adapter?.category).toBe('frontend');
  });

  it('returns the express adapter', () => {
    const adapter = getAdapterById('express');
    expect(adapter?.id).toBe('express');
  });

  it('returns the astro adapter', () => {
    const adapter = getAdapterById('astro');
    expect(adapter?.id).toBe('astro');
    expect(adapter?.name).toBe('Astro');
    expect(adapter?.category).toBe('frontend');
  });

  it('returns the sveltekit adapter', () => {
    const adapter = getAdapterById('sveltekit');
    expect(adapter?.id).toBe('sveltekit');
    expect(adapter?.name).toBe('SvelteKit');
    expect(adapter?.category).toBe('frontend');
  });

  it('returns the nuxt adapter', () => {
    const adapter = getAdapterById('nuxt');
    expect(adapter?.id).toBe('nuxt');
    expect(adapter?.name).toBe('Nuxt');
    expect(adapter?.category).toBe('frontend');
  });

  it('returns the nest adapter', () => {
    const adapter = getAdapterById('nest');
    expect(adapter?.id).toBe('nest');
    expect(adapter?.name).toBe('NestJS');
    expect(adapter?.category).toBe('backend');
  });

  it('returns the hono adapter', () => {
    const adapter = getAdapterById('hono');
    expect(adapter?.id).toBe('hono');
    expect(adapter?.name).toBe('Hono');
    expect(adapter?.category).toBe('backend');
  });

  it('returns the npm adapter', () => {
    const adapter = getAdapterById('npm');
    expect(adapter?.id).toBe('npm');
    expect(adapter?.category).toBe('library');
  });

  it('returns the expo adapter', () => {
    const adapter = getAdapterById('expo');
    expect(adapter?.id).toBe('expo');
    expect(adapter?.name).toBe('Expo');
    expect(adapter?.category).toBe('mobile');
  });

  it('returns the remix adapter', () => {
    const adapter = getAdapterById('remix');
    expect(adapter?.id).toBe('remix');
    expect(adapter?.name).toBe('Remix');
    expect(adapter?.category).toBe('fullstack');
  });

  it('returns the fastify adapter', () => {
    const adapter = getAdapterById('fastify');
    expect(adapter?.id).toBe('fastify');
    expect(adapter?.name).toBe('Fastify');
    expect(adapter?.category).toBe('backend');
  });

  it('returns the tauri adapter', () => {
    const adapter = getAdapterById('tauri');
    expect(adapter?.id).toBe('tauri');
    expect(adapter?.name).toBe('Tauri');
    expect(adapter?.category).toBe('desktop');
  });

  it('returns the t3 adapter', () => {
    const adapter = getAdapterById('t3');
    expect(adapter?.id).toBe('t3');
    expect(adapter?.name).toBe('T3 Stack');
    expect(adapter?.category).toBe('fullstack');
  });

  it('returns the elysia adapter', () => {
    const adapter = getAdapterById('elysia');
    expect(adapter?.id).toBe('elysia');
    expect(adapter?.name).toBe('Elysia');
    expect(adapter?.category).toBe('backend');
  });

  it('returns the angular adapter', () => {
    const adapter = getAdapterById('angular');
    expect(adapter?.id).toBe('angular');
    expect(adapter?.name).toBe('Angular');
    expect(adapter?.category).toBe('frontend');
  });

  it('returns undefined for an unknown id', () => {
    expect(getAdapterById('unknown-stack')).toBeUndefined();
  });

  it('is case-sensitive', () => {
    expect(getAdapterById('Vite')).toBeUndefined();
    expect(getAdapterById('NEXT')).toBeUndefined();
  });
});
