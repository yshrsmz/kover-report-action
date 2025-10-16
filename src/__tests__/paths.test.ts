import { describe, expect, it } from 'vitest';
import { normalizeModuleName, resolveModulePath } from '../common/paths';

describe('resolveModulePath', () => {
  it('should transform :core:common to core/common', () => {
    const result = resolveModulePath(':core:common', '{module}/build/reports/kover/report.xml');
    expect(result).toBe('core/common/build/reports/kover/report.xml');
  });

  it('should handle single-level module :app', () => {
    const result = resolveModulePath(':app', '{module}/kover.xml');
    expect(result).toBe('app/kover.xml');
  });

  it('should handle three-level module', () => {
    const result = resolveModulePath(':feature:auth:ui', '{module}/report.xml');
    expect(result).toBe('feature/auth/ui/report.xml');
  });

  it('should handle template without placeholder', () => {
    const result = resolveModulePath(':app', 'build/reports/kover/report.xml');
    expect(result).toBe('build/reports/kover/report.xml');
  });

  it('should handle multiple placeholders in template', () => {
    const result = resolveModulePath(':core:common', '{module}/src/{module}/report.xml');
    expect(result).toBe('core/common/src/core/common/report.xml');
  });
});

describe('normalizeModuleName', () => {
  it('should add leading colon if missing', () => {
    expect(normalizeModuleName('core:common')).toBe(':core:common');
  });

  it('should preserve leading colon if present', () => {
    expect(normalizeModuleName(':core:common')).toBe(':core:common');
  });

  it('should handle single-level module without colon', () => {
    expect(normalizeModuleName('app')).toBe(':app');
  });

  it('should remove trailing colon', () => {
    expect(normalizeModuleName(':app:')).toBe(':app');
  });

  it('should throw error for empty segments', () => {
    expect(() => normalizeModuleName('::core:common')).toThrow('contains empty segments');
  });

  it('should throw error for empty string', () => {
    expect(() => normalizeModuleName('')).toThrow('Module name cannot be empty');
  });

  it('should handle modules with spaces', () => {
    expect(normalizeModuleName(':module with spaces')).toBe(':module with spaces');
  });

  it('should handle modules with special characters', () => {
    expect(normalizeModuleName(':module@123')).toBe(':module@123');
  });
});
