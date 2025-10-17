import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addHistoryEntry,
  compareWithBaseline,
  type HistoryEntry,
  loadHistory,
  saveHistory,
  trimHistory,
} from '../history/index';

// Helper to load test fixtures
async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = join(__dirname, '../../__fixtures__', relativePath);
  return readFile(fixturePath, 'utf-8');
}

describe('HistoryEntry', () => {
  it('should create a valid history entry', () => {
    const entry: HistoryEntry = {
      timestamp: '2025-01-15T10:30:00Z',
      branch: 'main',
      commit: 'abc123',
      overall: {
        percentage: 85.5,
        covered: 855,
        total: 1000,
      },
      modules: {
        ':core:common': 85.5,
        ':data:repository': 78.2,
      },
    };

    expect(entry.timestamp).toBe('2025-01-15T10:30:00Z');
    expect(entry.branch).toBe('main');
    expect(entry.overall.percentage).toBe(85.5);
    expect(entry.modules[':core:common']).toBe(85.5);
  });
});

describe('loadHistory', () => {
  it('should load valid history from JSON string', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);

    expect(history).toHaveLength(3);
    expect(history[0].timestamp).toBe('2025-01-15T10:30:00Z');
    expect(history[0].overall.percentage).toBe(85.5);
    expect(history[0].modules[':core:common']).toBe(85.5);
  });

  it('should return empty array for empty history', async () => {
    const json = await loadFixture('history/empty-history.json');
    const history = loadHistory(json);

    expect(history).toEqual([]);
  });

  it('should return empty array for invalid JSON', () => {
    const history = loadHistory('invalid json {');
    expect(history).toEqual([]);
  });

  it('should return empty array for non-array JSON', () => {
    const history = loadHistory('{"foo": "bar"}');
    expect(history).toEqual([]);
  });

  it('should handle single entry history', async () => {
    const json = await loadFixture('history/single-entry.json');
    const history = loadHistory(json);

    expect(history).toHaveLength(1);
    expect(history[0].overall.percentage).toBe(85.5);
  });
});

describe('saveHistory', () => {
  it('should serialize history to JSON string', () => {
    const history: HistoryEntry[] = [
      {
        timestamp: '2025-01-15T10:30:00Z',
        branch: 'main',
        commit: 'abc123',
        overall: {
          percentage: 85.5,
          covered: 855,
          total: 1000,
        },
        modules: {
          ':core:common': 85.5,
        },
      },
    ];

    const json = saveHistory(history);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].timestamp).toBe('2025-01-15T10:30:00Z');
    expect(parsed[0].overall.percentage).toBe(85.5);
  });

  it('should handle empty history', () => {
    const json = saveHistory([]);
    expect(json).toBe('[]');
  });

  it('should produce valid JSON', () => {
    const history: HistoryEntry[] = [
      {
        timestamp: '2025-01-15T10:30:00Z',
        branch: 'main',
        commit: 'abc123',
        overall: { percentage: 85.5, covered: 855, total: 1000 },
        modules: {},
      },
    ];

    const json = saveHistory(history);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('addHistoryEntry', () => {
  it('should add new entry to empty history', () => {
    const history: HistoryEntry[] = [];
    const newEntry: HistoryEntry = {
      timestamp: '2025-01-15T10:30:00Z',
      branch: 'main',
      commit: 'abc123',
      overall: { percentage: 85.5, covered: 855, total: 1000 },
      modules: { ':core:common': 85.5 },
    };

    const updated = addHistoryEntry(history, newEntry);

    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual(newEntry);
  });

  it('should prepend new entry to existing history', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);
    const newEntry: HistoryEntry = {
      timestamp: '2025-01-16T10:30:00Z',
      branch: 'main',
      commit: 'new123',
      overall: { percentage: 86.0, covered: 860, total: 1000 },
      modules: { ':core:common': 86.0 },
    };

    const updated = addHistoryEntry(history, newEntry);

    expect(updated).toHaveLength(4);
    expect(updated[0].timestamp).toBe('2025-01-16T10:30:00Z'); // Most recent first
    expect(updated[1].timestamp).toBe('2025-01-15T10:30:00Z'); // Previous entries follow
  });

  it('should not mutate original history array', () => {
    const history: HistoryEntry[] = [
      {
        timestamp: '2025-01-15T10:30:00Z',
        branch: 'main',
        commit: 'abc123',
        overall: { percentage: 85.5, covered: 855, total: 1000 },
        modules: {},
      },
    ];
    const originalLength = history.length;
    const newEntry: HistoryEntry = {
      timestamp: '2025-01-16T10:30:00Z',
      branch: 'main',
      commit: 'def456',
      overall: { percentage: 86.0, covered: 860, total: 1000 },
      modules: {},
    };

    addHistoryEntry(history, newEntry);

    expect(history).toHaveLength(originalLength); // Original unchanged
  });
});

describe('trimHistory', () => {
  it('should keep all entries when below retention limit', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);

    const trimmed = trimHistory(history, 10);

    expect(trimmed).toHaveLength(3); // All 3 entries kept
  });

  it('should trim entries exceeding retention limit', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);

    const trimmed = trimHistory(history, 2);

    expect(trimmed).toHaveLength(2);
    expect(trimmed[0].timestamp).toBe('2025-01-15T10:30:00Z'); // Keep most recent
    expect(trimmed[1].timestamp).toBe('2025-01-14T10:30:00Z');
  });

  it('should handle retention of 1', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);

    const trimmed = trimHistory(history, 1);

    expect(trimmed).toHaveLength(1);
    expect(trimmed[0].timestamp).toBe('2025-01-15T10:30:00Z');
  });

  it('should handle empty history', () => {
    const trimmed = trimHistory([], 5);
    expect(trimmed).toEqual([]);
  });

  it('should not mutate original history', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);
    const originalLength = history.length;

    trimHistory(history, 1);

    expect(history).toHaveLength(originalLength);
  });
});

describe('compareWithBaseline', () => {
  it('should compare current coverage with latest baseline', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);
    const currentModules = {
      ':core:common': 87.0, // +1.5% from baseline (85.5)
      ':core:testing': 91.0, // -1.0% from baseline (92.0)
      ':data:repository': 78.2, // No change (78.2)
      ':feature:auth': 72.0, // +1.5% from baseline (70.5)
    };

    const comparison = compareWithBaseline(
      history,
      currentModules,
      86.0, // Current overall
      'main'
    );

    expect(comparison).toBeDefined();
    expect(comparison?.overallDelta).toBeCloseTo(0.5, 1); // 86.0 - 85.5 = 0.5
    expect(comparison?.moduleDelta[':core:common']).toBeCloseTo(1.5, 1);
    expect(comparison?.moduleDelta[':core:testing']).toBeCloseTo(-1.0, 1);
    expect(comparison?.moduleDelta[':data:repository']).toBeCloseTo(0, 1);
    expect(comparison?.moduleDelta[':feature:auth']).toBeCloseTo(1.5, 1);
  });

  it('should return null when no baseline exists', () => {
    const comparison = compareWithBaseline([], {}, 85.0, 'main');
    expect(comparison).toBeNull();
  });

  it('should compare with most recent baseline from specified branch', async () => {
    const history: HistoryEntry[] = [
      {
        timestamp: '2025-01-16T10:30:00Z',
        branch: 'feature',
        commit: 'xyz',
        overall: { percentage: 80.0, covered: 800, total: 1000 },
        modules: { ':core:common': 80.0 },
      },
      {
        timestamp: '2025-01-15T10:30:00Z',
        branch: 'main',
        commit: 'abc',
        overall: { percentage: 85.5, covered: 855, total: 1000 },
        modules: { ':core:common': 85.5 },
      },
    ];

    const comparison = compareWithBaseline(history, { ':core:common': 86.0 }, 86.0, 'main');

    expect(comparison).toBeDefined();
    expect(comparison?.overallDelta).toBeCloseTo(0.5, 1); // 86.0 - 85.5 (from main, not feature)
  });

  it('should handle modules not in baseline', async () => {
    const json = await loadFixture('history/single-entry.json');
    const history = loadHistory(json);
    const currentModules = {
      ':core:common': 87.0,
      ':new:module': 75.0, // New module not in baseline
    };

    const comparison = compareWithBaseline(history, currentModules, 86.0, 'main');

    expect(comparison).toBeDefined();
    expect(comparison?.moduleDelta[':core:common']).toBeCloseTo(1.5, 1);
    expect(comparison?.moduleDelta[':new:module']).toBeNull(); // No baseline to compare
  });

  it('should handle modules removed from current', async () => {
    const json = await loadFixture('history/valid-history.json');
    const history = loadHistory(json);
    const currentModules = {
      ':core:common': 87.0,
      // :core:testing removed
    };

    const comparison = compareWithBaseline(history, currentModules, 87.0, 'main');

    expect(comparison).toBeDefined();
    expect(comparison?.moduleDelta[':core:common']).toBeCloseTo(1.5, 1);
    expect(comparison?.moduleDelta[':core:testing']).toBeUndefined(); // Not in current
  });
});
