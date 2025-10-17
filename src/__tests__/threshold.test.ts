import { beforeEach, describe, expect, it } from 'vitest';
import { SpyLogger } from '../common/logger';
import { validateThresholds } from '../config/thresholds';
import { checkThreshold, getModuleType, getThresholdForModule } from '../coverage/threshold';

describe('getModuleType', () => {
  it('should extract type from :core:common', () => {
    expect(getModuleType(':core:common')).toBe('core');
  });

  it('should extract type from :app', () => {
    expect(getModuleType(':app')).toBe('app');
  });

  it('should extract type from :feature:auth:ui', () => {
    expect(getModuleType(':feature:auth:ui')).toBe('feature');
  });

  it('should return default for empty string', () => {
    expect(getModuleType('')).toBe('default');
  });

  it('should return default for module with only colon', () => {
    expect(getModuleType(':')).toBe('default');
  });

  it('should handle module without leading colon', () => {
    expect(getModuleType('core:common')).toBe('core');
  });
});

describe('getThresholdForModule', () => {
  let logger: SpyLogger;

  beforeEach(() => {
    logger = new SpyLogger();
  });

  const thresholds = {
    core: 80,
    data: 75,
    ':core:testing': 0, // Exact match
    default: 60,
  };

  it('should use exact name match first', () => {
    expect(getThresholdForModule(logger, ':core:testing', thresholds, 50)).toBe(0);
  });

  it('should use type match if no exact match', () => {
    expect(getThresholdForModule(logger, ':core:common', thresholds, 50)).toBe(80);
  });

  it('should use default if no type match', () => {
    expect(getThresholdForModule(logger, ':feature:auth', thresholds, 50)).toBe(60);
  });

  it('should use minCoverage if no default', () => {
    expect(getThresholdForModule(logger, ':unknown', {}, 70)).toBe(70);
  });

  it('should use 0 as hard default', () => {
    expect(getThresholdForModule(logger, ':unknown', {}, 0)).toBe(0);
  });

  it('should handle empty thresholds object', () => {
    expect(getThresholdForModule(logger, ':app', {}, 50)).toBe(50);
  });

  it('should prioritize exact match over type match', () => {
    const config = {
      core: 80,
      ':core:testing': 0,
    };
    expect(getThresholdForModule(logger, ':core:testing', config, 50)).toBe(0);
    expect(getThresholdForModule(logger, ':core:common', config, 50)).toBe(80);
  });
});

describe('checkThreshold', () => {
  it('should return true when coverage equals threshold', () => {
    expect(checkThreshold(80, 80)).toBe(true);
  });

  it('should return true when coverage exceeds threshold', () => {
    expect(checkThreshold(85, 80)).toBe(true);
  });

  it('should return false when coverage below threshold', () => {
    expect(checkThreshold(75, 80)).toBe(false);
  });

  it('should handle zero threshold', () => {
    expect(checkThreshold(0, 0)).toBe(true);
    expect(checkThreshold(10, 0)).toBe(true);
  });

  it('should handle 100% coverage', () => {
    expect(checkThreshold(100, 100)).toBe(true);
    expect(checkThreshold(100, 90)).toBe(true);
  });

  it('should handle decimal values', () => {
    expect(checkThreshold(85.5, 85)).toBe(true);
    expect(checkThreshold(84.9, 85)).toBe(false);
  });
});

describe('validateThresholds', () => {
  it('should accept valid thresholds object', () => {
    const thresholds = {
      core: 80,
      data: 75,
      default: 60,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });

  it('should accept thresholds with exact module names', () => {
    const thresholds = {
      ':core:testing': 0,
      feature: 70,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });

  it('should accept decimal thresholds', () => {
    const thresholds = {
      core: 85.5,
      default: 60.0,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });

  it('should throw error for negative threshold', () => {
    const thresholds = {
      core: -5,
    };
    expect(() => validateThresholds(thresholds)).toThrow('must be between 0 and 100');
  });

  it('should throw error for threshold > 100', () => {
    const thresholds = {
      core: 105,
    };
    expect(() => validateThresholds(thresholds)).toThrow('must be between 0 and 100');
  });

  it('should throw error for non-numeric threshold', () => {
    const thresholds = {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid type intentionally
      core: 'eighty' as any,
    };
    expect(() => validateThresholds(thresholds)).toThrow('must be a number');
  });

  it('should accept empty object', () => {
    expect(() => validateThresholds({})).not.toThrow();
  });

  it('should accept thresholds at boundary values', () => {
    const thresholds = {
      min: 0,
      max: 100,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });

  it('should reject module type with colons', () => {
    const thresholds = {
      'core:common': 80, // Should be ':core:common' for full module name
    };
    expect(() => validateThresholds(thresholds)).toThrow('module types cannot contain colons');
  });

  it('should reject module name with empty segments', () => {
    const thresholds = {
      ':core::testing': 80,
    };
    expect(() => validateThresholds(thresholds)).toThrow('cannot contain empty segments');
  });

  it('should reject incomplete module name (trailing colon)', () => {
    const thresholds = {
      ':core:': 80,
    };
    expect(() => validateThresholds(thresholds)).toThrow('incomplete module name');
  });

  it('should reject module name with only colon', () => {
    const thresholds = {
      ':': 80,
    };
    expect(() => validateThresholds(thresholds)).toThrow('incomplete module name');
  });

  it('should reject empty key', () => {
    const thresholds = {
      '': 80,
    };
    expect(() => validateThresholds(thresholds)).toThrow('cannot be empty');
  });

  it('should accept valid module types', () => {
    const thresholds = {
      core: 80,
      data: 75,
      feature: 70,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });

  it('should accept valid full module names', () => {
    const thresholds = {
      ':core:testing': 0,
      ':feature:auth:ui': 70,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });

  it('should accept mix of module types, names, and default', () => {
    const thresholds = {
      core: 80,
      ':core:testing': 0,
      feature: 70,
      default: 60,
    };
    expect(() => validateThresholds(thresholds)).not.toThrow();
  });
});
