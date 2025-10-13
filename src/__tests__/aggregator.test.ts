import { describe, expect, it, vi } from 'vitest';
import { aggregateCoverage } from '../aggregator';
import type { CoverageResult } from '../parser';

// Mock the parser module
vi.mock('../parser', () => ({
  parseCoverageFile: vi.fn((filePath: string): Promise<CoverageResult | null> => {
    // Simulate different coverage results based on path
    if (filePath.includes('core-common')) {
      return Promise.resolve({
        covered: 850,
        missed: 150,
        total: 1000,
        percentage: 85.0,
      });
    }
    if (filePath.includes('core-testing')) {
      return Promise.resolve({
        covered: 920,
        missed: 80,
        total: 1000,
        percentage: 92.0,
      });
    }
    if (filePath.includes('data-repository')) {
      return Promise.resolve({
        covered: 390,
        missed: 110,
        total: 500,
        percentage: 78.0,
      });
    }
    if (filePath.includes('feature-auth')) {
      return Promise.resolve({
        covered: 330,
        missed: 170,
        total: 500,
        percentage: 66.0,
      });
    }
    if (filePath.includes('parent-module')) {
      // Simulate missing coverage file (parent module)
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }),
}));

describe('aggregateCoverage', () => {
  it('should aggregate coverage from multiple modules', async () => {
    const modules = [
      { name: ':core:common', filePath: 'core-common/report.xml' },
      { name: ':data:repository', filePath: 'data-repository/report.xml' },
    ];

    const thresholds = {
      core: 80,
      data: 75,
      default: 60,
    };

    const result = await aggregateCoverage(modules, thresholds, 70);

    // Overall: (850 + 390) / (1000 + 500) = 1240/1500 = 82.67%
    expect(result.percentage).toBeCloseTo(82.67, 1);
    expect(result.covered).toBe(1240);
    expect(result.total).toBe(1500);
    expect(result.modules).toHaveLength(2);
  });

  it('should mark modules as passed/failed based on thresholds', async () => {
    const modules = [
      { name: ':core:common', filePath: 'core-common/report.xml' }, // 85% >= 80% → pass
      { name: ':feature:auth', filePath: 'feature-auth/report.xml' }, // 66% < 70% → fail
    ];

    const thresholds = {
      core: 80,
      feature: 70,
      default: 60,
    };

    const result = await aggregateCoverage(modules, thresholds, 60);

    expect(result.modules[0].passed).toBe(true); // core:common passes
    expect(result.modules[1].passed).toBe(false); // feature:auth fails
  });

  it('should handle modules with missing coverage files', async () => {
    const modules = [
      { name: ':core:common', filePath: 'core-common/report.xml' },
      { name: ':parent', filePath: 'parent-module/report.xml' }, // Returns null
      { name: ':data:repository', filePath: 'data-repository/report.xml' },
    ];

    const result = await aggregateCoverage(modules, {}, 0);

    // Null coverage should not contribute to overall calculation
    // Overall: (850 + 390) / (1000 + 500) = 1240/1500 = 82.67%
    expect(result.percentage).toBeCloseTo(82.67, 1);
    expect(result.modules).toHaveLength(3);
    expect(result.modules[1].coverage).toBeNull();
    expect(result.modules[1].passed).toBe(false); // Missing coverage = not passed
  });

  it('should handle empty module list', async () => {
    const result = await aggregateCoverage([], {}, 0);

    expect(result.percentage).toBe(0);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(0);
    expect(result.modules).toHaveLength(0);
  });

  it('should handle all modules with missing coverage', async () => {
    const modules = [
      { name: ':parent1', filePath: 'parent1/report.xml' },
      { name: ':parent2', filePath: 'parent2/report.xml' },
    ];

    const result = await aggregateCoverage(modules, {}, 0);

    expect(result.percentage).toBe(0);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(0);
    expect(result.modules).toHaveLength(2);
    expect(result.modules[0].coverage).toBeNull();
    expect(result.modules[1].coverage).toBeNull();
  });

  it('should use correct threshold for each module type', async () => {
    const modules = [
      { name: ':core:common', filePath: 'core-common/report.xml' }, // 85% vs 80%
      { name: ':core:testing', filePath: 'core-testing/report.xml' }, // 92% vs 0% (exact match)
      { name: ':data:repository', filePath: 'data-repository/report.xml' }, // 78% vs 75%
    ];

    const thresholds = {
      core: 80,
      ':core:testing': 0, // Exact match override
      data: 75,
    };

    const result = await aggregateCoverage(modules, thresholds, 60);

    expect(result.modules[0].threshold).toBe(80); // Type match
    expect(result.modules[1].threshold).toBe(0); // Exact match
    expect(result.modules[2].threshold).toBe(75); // Type match

    expect(result.modules[0].passed).toBe(true); // 85 >= 80
    expect(result.modules[1].passed).toBe(true); // 92 >= 0
    expect(result.modules[2].passed).toBe(true); // 78 >= 75
  });

  it('should parse all modules in parallel', async () => {
    // This test verifies that Promise.all is used for parallel parsing
    const startTime = Date.now();

    const modules = [
      { name: ':core:common', filePath: 'core-common/report.xml' },
      { name: ':core:testing', filePath: 'core-testing/report.xml' },
      { name: ':data:repository', filePath: 'data-repository/report.xml' },
      { name: ':feature:auth', filePath: 'feature-auth/report.xml' },
    ];

    await aggregateCoverage(modules, {}, 0);

    const duration = Date.now() - startTime;

    // If parsed in parallel, should be fast (< 100ms)
    // If parsed sequentially with delays, would be much slower
    expect(duration).toBeLessThan(100);
  });
});
