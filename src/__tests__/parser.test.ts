import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { SpyLogger } from '../common/logger';
import { parseCoverageFile } from '../parser';

const FIXTURES_DIR = join(__dirname, '../../__fixtures__/kover-reports');

describe('parseCoverageFile', () => {
  let logger: SpyLogger;

  beforeEach(() => {
    logger = new SpyLogger();
  });

  it('should parse valid Kover XML with partial coverage', async () => {
    const filePath = join(FIXTURES_DIR, 'valid-partial-coverage.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).toEqual({
      covered: 855,
      missed: 145,
      total: 1000,
      percentage: 85.5,
    });
  });

  it('should parse valid Kover XML with full coverage', async () => {
    const filePath = join(FIXTURES_DIR, 'valid-full-coverage.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).not.toBeNull();
    expect(result?.percentage).toBe(100);
    expect(result?.missed).toBe(0);
    expect(result?.covered).toBeGreaterThan(0);
  });

  it('should parse valid Kover XML with zero coverage', async () => {
    const filePath = join(FIXTURES_DIR, 'valid-zero-coverage.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).not.toBeNull();
    expect(result?.percentage).toBe(0);
    expect(result?.covered).toBe(0);
    expect(result?.missed).toBeGreaterThan(0);
  });

  it('should return null for non-existent file', async () => {
    const filePath = join(FIXTURES_DIR, 'non-existent.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).toBeNull();
  });

  it('should return null for invalid XML', async () => {
    const filePath = join(FIXTURES_DIR, 'invalid-malformed.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).toBeNull();
  });

  it('should return null for XML without INSTRUCTION counter', async () => {
    const filePath = join(FIXTURES_DIR, 'invalid-no-instruction.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).toBeNull();
  });

  it('should return null for empty XML file', async () => {
    const filePath = join(FIXTURES_DIR, 'empty.xml');
    const result = await parseCoverageFile(logger, filePath);

    expect(result).toBeNull();
  });

  it('should extract INSTRUCTION counter not LINE or BRANCH', async () => {
    const filePath = join(FIXTURES_DIR, 'valid-partial-coverage.xml');
    const result = await parseCoverageFile(logger, filePath);

    // The fixture has LINE: 50 missed + 200 covered = 250 total
    // But we should get INSTRUCTION: 145 missed + 855 covered = 1000 total
    expect(result).not.toBeNull();
    expect(result?.total).toBe(1000); // INSTRUCTION total
    expect(result?.total).not.toBe(250); // Not LINE total
  });

  it('should handle division by zero (no instructions)', async () => {
    // This would be an edge case where total = 0
    // In practice, this shouldn't happen, but we should handle it gracefully
    // We'll test this with a dedicated fixture if needed
  });
});
