import { describe, expect, it } from 'vitest';
import { looksLikeToken, validateMinCoverage, validateModulePathTemplate } from '../validation';

describe('validateMinCoverage', () => {
  it('should accept valid integer coverage values', () => {
    expect(validateMinCoverage('0')).toBe(0);
    expect(validateMinCoverage('50')).toBe(50);
    expect(validateMinCoverage('100')).toBe(100);
  });

  it('should accept valid decimal coverage values', () => {
    expect(validateMinCoverage('85.5')).toBe(85.5);
    expect(validateMinCoverage('60.0')).toBe(60.0);
    expect(validateMinCoverage('99.9')).toBe(99.9);
  });

  it('should accept boundary values', () => {
    expect(validateMinCoverage('0')).toBe(0);
    expect(validateMinCoverage('100')).toBe(100);
  });

  it('should throw error for non-numeric input', () => {
    expect(() => validateMinCoverage('abc')).toThrow(
      'Invalid min-coverage value: "abc". Must be a number between 0 and 100.'
    );
  });

  it('should throw error for empty string', () => {
    expect(() => validateMinCoverage('')).toThrow(
      'Invalid min-coverage value: "". Must be a number between 0 and 100.'
    );
  });

  it('should throw error for negative values', () => {
    expect(() => validateMinCoverage('-5')).toThrow(
      'Invalid min-coverage value: -5. Must be between 0 and 100 (inclusive).'
    );
  });

  it('should throw error for values > 100', () => {
    expect(() => validateMinCoverage('105')).toThrow(
      'Invalid min-coverage value: 105. Must be between 0 and 100 (inclusive).'
    );
  });

  it('should throw error for NaN input', () => {
    expect(() => validateMinCoverage('NaN')).toThrow(
      'Invalid min-coverage value: "NaN". Must be a number between 0 and 100.'
    );
  });

  it('should handle scientific notation', () => {
    expect(validateMinCoverage('5e1')).toBe(50);
  });

  it('should handle leading/trailing whitespace in numbers', () => {
    expect(validateMinCoverage(' 75 ')).toBe(75);
  });
});

describe('validateModulePathTemplate', () => {
  it('should accept template with {module} placeholder', () => {
    expect(() =>
      validateModulePathTemplate('{module}/build/reports/kover/report.xml')
    ).not.toThrow();
  });

  it('should accept template with {module} in the middle', () => {
    expect(() =>
      validateModulePathTemplate('build/{module}/reports/kover/report.xml')
    ).not.toThrow();
  });

  it('should accept template with {module} at the start', () => {
    expect(() => validateModulePathTemplate('{module}/kover.xml')).not.toThrow();
  });

  it('should accept template with multiple occurrences of {module}', () => {
    expect(() => validateModulePathTemplate('{module}/build/{module}/report.xml')).not.toThrow();
  });

  it('should throw error when {module} placeholder is missing', () => {
    expect(() => validateModulePathTemplate('build/reports/kover/report.xml')).toThrow(
      'module-path-template must contain "{module}" placeholder'
    );
  });

  it('should throw error for empty template', () => {
    expect(() => validateModulePathTemplate('')).toThrow(
      'module-path-template must contain "{module}" placeholder'
    );
  });

  it('should throw error for template with wrong placeholder format', () => {
    expect(() => validateModulePathTemplate('{MODULE}/report.xml')).toThrow(
      'module-path-template must contain "{module}" placeholder'
    );
  });

  it('should throw error for template with $module instead of {module}', () => {
    expect(() => validateModulePathTemplate('$module/report.xml')).toThrow(
      'module-path-template must contain "{module}" placeholder'
    );
  });
});

describe('looksLikeToken', () => {
  it('should recognize GitHub personal access tokens (PAT)', () => {
    expect(looksLikeToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123')).toBe(true);
  });

  it('should recognize GitHub server tokens', () => {
    expect(looksLikeToken('ghs_1234567890abcdefghijklmnopqrstuvwxyz123')).toBe(true);
  });

  it('should recognize GitHub OAuth tokens', () => {
    expect(looksLikeToken('gho_1234567890abcdefghijklmnopqrstuvwxyz123')).toBe(true);
  });

  it('should recognize GitHub user-to-server tokens', () => {
    expect(looksLikeToken('ghu_1234567890abcdefghijklmnopqrstuvwxyz123')).toBe(true);
  });

  it('should recognize GitHub fine-grained PAT', () => {
    expect(looksLikeToken('github_pat_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true);
  });

  it('should recognize classic GitHub tokens (40 hex chars)', () => {
    expect(looksLikeToken('a'.repeat(40))).toBe(true);
    expect(looksLikeToken('0123456789abcdef0123456789abcdef01234567')).toBe(true);
  });

  it('should not recognize regular strings', () => {
    expect(looksLikeToken('my-regular-string')).toBe(false);
    expect(looksLikeToken('some-random-value')).toBe(false);
  });

  it('should not recognize empty string', () => {
    expect(looksLikeToken('')).toBe(false);
  });

  it('should not recognize non-token patterns', () => {
    expect(looksLikeToken('token123')).toBe(false);
    expect(looksLikeToken('1234567890')).toBe(false);
  });

  it('should be case insensitive for hex tokens', () => {
    expect(looksLikeToken('ABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
    expect(looksLikeToken('aBcDeF1234567890aBcDeF1234567890aBcDeF12')).toBe(true);
  });

  it('should not recognize too short hex strings', () => {
    expect(looksLikeToken('a'.repeat(39))).toBe(false);
  });

  it('should not recognize too long hex strings', () => {
    expect(looksLikeToken('a'.repeat(41))).toBe(false);
  });
});
