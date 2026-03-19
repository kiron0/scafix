import { describe, expect, it } from 'vitest';
import {
  getDefaultDirectoryName,
  validateDirectory,
  validateNpmPackageName,
  validateProjectName,
} from '../../src/utils/validate.js';

describe('validateProjectName', () => {
  it('returns true for a valid name', () => {
    expect(validateProjectName('my-project')).toBe(true);
  });

  it('returns true for names with numbers and hyphens', () => {
    expect(validateProjectName('my-app-123')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(validateProjectName('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(validateProjectName('   ')).toBe(false);
  });

  it('returns false for names containing invalid characters', () => {
    expect(validateProjectName('my/project')).toBe(false);
    expect(validateProjectName('my:project')).toBe(false);
    expect(validateProjectName('my*project')).toBe(false);
    expect(validateProjectName('my?project')).toBe(false);
  });

  it('returns false for Windows reserved names (case-insensitive)', () => {
    expect(validateProjectName('CON')).toBe(false);
    expect(validateProjectName('con')).toBe(false);
    expect(validateProjectName('NUL')).toBe(false);
    expect(validateProjectName('COM1')).toBe(false);
    expect(validateProjectName('LPT9')).toBe(false);
  });

  it('returns false for Windows reserved names with extensions', () => {
    expect(validateProjectName('CON.txt')).toBe(false);
    expect(validateProjectName('nul.json')).toBe(false);
    expect(validateProjectName('Lpt1.config')).toBe(false);
  });

  it('returns false for names ending in a dot or space', () => {
    expect(validateProjectName('my-project.')).toBe(false);
    expect(validateProjectName('my-project ')).toBe(false);
  });
});

describe('validateDirectory', () => {
  it('returns an object with valid, exists, and path fields', () => {
    const result = validateDirectory('non-existent-dir-xyz');
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('exists');
    expect(result).toHaveProperty('path');
  });

  it('returns valid true for a safe relative directory', () => {
    const result = validateDirectory('any-dir');
    expect(result.valid).toBe(true);
  });

  it('exists is false for a directory that does not exist', () => {
    const result = validateDirectory('__this_dir_does_not_exist__');
    expect(result.exists).toBe(false);
  });

  it('path is an absolute path containing the directory name', () => {
    const result = validateDirectory('my-project');
    expect(result.path).toContain('my-project');
    expect(result.path.startsWith('/')).toBe(true);
  });

  it('returns invalid for reserved Windows path segments', () => {
    expect(validateDirectory('CON').valid).toBe(false);
    expect(validateDirectory('nested/PRN.txt').valid).toBe(false);
  });

  it('returns invalid for path segments ending in a dot or space', () => {
    expect(validateDirectory('bad-dir.').valid).toBe(false);
    expect(validateDirectory('nested/bad-dir ').valid).toBe(false);
  });
});

describe('validateNpmPackageName', () => {
  it('accepts lowercase npm-safe names', () => {
    expect(validateNpmPackageName('my-package')).toBe(true);
    expect(validateNpmPackageName('my_package.1')).toBe(true);
  });

  it('accepts scoped package names', () => {
    expect(validateNpmPackageName('@scope/my-package')).toBe(true);
  });

  it('rejects uppercase package names', () => {
    expect(validateNpmPackageName('MyPackage')).toBe(false);
  });

  it('rejects package names with spaces', () => {
    expect(validateNpmPackageName('my package')).toBe(false);
    expect(validateNpmPackageName(' my-package ')).toBe(false);
  });

  it('rejects package names that start with dots or underscores', () => {
    expect(validateNpmPackageName('.my-package')).toBe(false);
    expect(validateNpmPackageName('_my-package')).toBe(false);
  });

  it('rejects npm-reserved package names', () => {
    expect(validateNpmPackageName('node_modules')).toBe(false);
    expect(validateNpmPackageName('favicon.ico')).toBe(false);
  });

  it("rejects package names that exceed npm's maximum length", () => {
    expect(validateNpmPackageName('a'.repeat(215))).toBe(false);
  });
});

describe('getDefaultDirectoryName', () => {
  it('returns the package segment for scoped package names', () => {
    expect(getDefaultDirectoryName('@scope/my-package')).toBe('my-package');
  });

  it('returns the original name for unscoped names', () => {
    expect(getDefaultDirectoryName('my-package')).toBe('my-package');
  });
});
