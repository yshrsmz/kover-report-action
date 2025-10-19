/**
 * Tests for HistoryManager
 */

import { describe, expect, test } from 'vitest';
import { DefaultHistoryManager, type HistoryStore } from '../history/manager';

/**
 * In-memory implementation of HistoryStore for testing
 * Uses a class because it needs internal state to store data
 */
class InMemoryHistoryStore implements HistoryStore {
  private data: string | null = null;

  async load(): Promise<string | null> {
    return this.data;
  }

  async save(data: string): Promise<void> {
    this.data = data;
  }

  /**
   * Get current stored data for test assertions
   */
  getData(): string | null {
    return this.data;
  }

  /**
   * Clear stored data for test isolation
   */
  clear(): void {
    this.data = null;
  }
}

describe('HistoryManager', () => {
  describe('initialization', () => {
    test('starts with empty history', async () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      await manager.load();

      expect(manager.getEntryCount()).toBe(0);
    });

    test('loads existing history from store', async () => {
      const store = new InMemoryHistoryStore();
      const existingHistory = JSON.stringify([
        {
          timestamp: '2025-01-01T00:00:00Z',
          branch: 'main',
          commit: 'abc123',
          overall: { percentage: 80, covered: 800, total: 1000 },
          modules: { ':core': 80 },
        },
      ]);
      await store.save(existingHistory);

      const manager = new DefaultHistoryManager(store, 50, 'main');
      await manager.load();

      expect(manager.getEntryCount()).toBe(1);
    });

    test('handles invalid JSON gracefully', async () => {
      const store = new InMemoryHistoryStore();
      await store.save('invalid json {');

      const manager = new DefaultHistoryManager(store, 50, 'main');
      await manager.load();

      expect(manager.getEntryCount()).toBe(0);
    });

    test('handles non-array JSON gracefully', async () => {
      const store = new InMemoryHistoryStore();
      await store.save(JSON.stringify({ not: 'an array' }));

      const manager = new DefaultHistoryManager(store, 50, 'main');
      await manager.load();

      expect(manager.getEntryCount()).toBe(0);
    });
  });

  describe('append', () => {
    test('appends new entry to empty history', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      expect(manager.getEntryCount()).toBe(1);
    });

    test('prepends new entry to existing history', async () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      // Add first entry
      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 75, covered: 750, total: 1000, modules: { ':core': 75 } }
      );

      await manager.persist();
      const data = store.getData();
      expect(data).not.toBeNull();
      const savedData = JSON.parse(data || '[]');
      expect(savedData[0].commit).toBe('abc123');

      // Add second entry
      manager.append(
        { branch: 'main', commit: 'def456', timestamp: '2025-01-02T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      await manager.persist();
      const updatedDataStr = store.getData();
      expect(updatedDataStr).not.toBeNull();
      const updatedData = JSON.parse(updatedDataStr || '[]');
      expect(updatedData[0].commit).toBe('def456'); // Most recent first
      expect(updatedData[1].commit).toBe('abc123');
    });

    test('trims history beyond retention limit', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 3, 'main'); // Only keep 3 entries

      // Add 5 entries
      for (let i = 1; i <= 5; i++) {
        manager.append(
          {
            branch: 'main',
            commit: `commit${i}`,
            timestamp: `2025-01-0${i}T00:00:00Z`,
          },
          { overall: 70 + i, covered: 700 + i * 10, total: 1000, modules: {} }
        );
      }

      expect(manager.getEntryCount()).toBe(3); // Only 3 most recent kept
    });
  });

  describe('compare', () => {
    test('returns null when history is empty', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      const comparison = manager.compare({
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 80 },
      });

      expect(comparison).toBeNull();
    });

    test('returns null when no baseline branch entry exists', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      // Add entry for different branch
      manager.append(
        { branch: 'feature/xyz', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 75, covered: 750, total: 1000, modules: { ':core': 75 } }
      );

      const comparison = manager.compare({
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 80 },
      });

      expect(comparison).toBeNull(); // No 'main' branch entry
    });

    test('compares with baseline and calculates positive delta', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      // Add baseline entry
      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 75, covered: 750, total: 1000, modules: { ':core': 75, ':data': 70 } }
      );

      // Compare with improved coverage
      const comparison = manager.compare({
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 82, ':data': 78 },
      });

      expect(comparison).not.toBeNull();
      expect(comparison?.overallDelta).toBe(5); // 80 - 75
      expect(comparison?.moduleDelta[':core']).toBe(7); // 82 - 75
      expect(comparison?.moduleDelta[':data']).toBe(8); // 78 - 70
      expect(comparison?.baseline.commit).toBe('abc123');
    });

    test('compares with baseline and calculates negative delta', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      // Add baseline entry
      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 85, covered: 850, total: 1000, modules: { ':core': 90 } }
      );

      // Compare with degraded coverage
      const comparison = manager.compare({
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 82 },
      });

      expect(comparison).not.toBeNull();
      expect(comparison?.overallDelta).toBe(-5); // 80 - 85
      expect(comparison?.moduleDelta[':core']).toBe(-8); // 82 - 90
    });

    test('handles new modules (not in baseline)', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      // Add baseline with only :core
      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 75, covered: 750, total: 1000, modules: { ':core': 75 } }
      );

      // Compare with new :data module
      const comparison = manager.compare({
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 80, ':data': 85 },
      });

      expect(comparison).not.toBeNull();
      expect(comparison?.moduleDelta[':core']).toBe(5);
      expect(comparison?.moduleDelta[':data']).toBeNull(); // New module
    });

    test('uses most recent baseline entry when multiple exist', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      // Add older baseline
      manager.append(
        { branch: 'main', commit: 'old123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 70, covered: 700, total: 1000, modules: { ':core': 70 } }
      );

      // Add newer baseline
      manager.append(
        { branch: 'main', commit: 'new456', timestamp: '2025-01-02T00:00:00Z' },
        { overall: 75, covered: 750, total: 1000, modules: { ':core': 75 } }
      );

      const comparison = manager.compare({
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 80 },
      });

      expect(comparison).not.toBeNull();
      expect(comparison?.baseline.commit).toBe('new456'); // Uses most recent
      expect(comparison?.overallDelta).toBe(5); // 80 - 75 (not 80 - 70)
    });
  });

  describe('getHistory', () => {
    test('returns empty array for new manager', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      const history = manager.getHistory();

      expect(history).toEqual([]);
    });

    test('returns copy of history entries after append', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      const history = manager.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].commit).toBe('abc123');
      expect(history[0].overall.percentage).toBe(80);
    });

    test('returns copy that does not affect internal state', () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      const history = manager.getHistory();
      // Try to mutate the returned array
      history.push({
        timestamp: '2025-01-02T00:00:00Z',
        branch: 'feature',
        commit: 'def456',
        overall: { percentage: 85, covered: 850, total: 1000 },
        modules: { ':core': 85 },
      });

      // Internal state should be unchanged
      expect(manager.getEntryCount()).toBe(1);
      expect(manager.getHistory()).toHaveLength(1);
    });
  });

  describe('persist', () => {
    test('saves empty history to store', async () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      await manager.persist();

      const saved = store.getData();
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved || '[]')).toEqual([]);
    });

    test('saves appended entries to store', async () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'main');

      manager.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      await manager.persist();

      const saved = store.getData();
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved || '[]');
      expect(parsed).toHaveLength(1);
      expect(parsed[0].commit).toBe('abc123');
      expect(parsed[0].overall.percentage).toBe(80);
    });

    test('persisted data can be loaded by new manager instance', async () => {
      const store = new InMemoryHistoryStore();
      const manager1 = new DefaultHistoryManager(store, 50, 'main');

      manager1.append(
        { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      await manager1.persist();

      // Create new manager instance with same store
      const manager2 = new DefaultHistoryManager(store, 50, 'main');
      await manager2.load();

      expect(manager2.getEntryCount()).toBe(1);

      const comparison = manager2.compare({
        overall: 85,
        covered: 850,
        total: 1000,
        modules: { ':core': 85 },
      });

      expect(comparison).not.toBeNull();
      expect(comparison?.baseline.commit).toBe('abc123');
    });
  });

  describe('integration scenarios', () => {
    test('complete workflow: load → compare → append → persist', async () => {
      const store = new InMemoryHistoryStore();

      // Setup: Save initial baseline
      const existingHistory = JSON.stringify([
        {
          timestamp: '2025-01-01T00:00:00Z',
          branch: 'main',
          commit: 'baseline',
          overall: { percentage: 75, covered: 750, total: 1000 },
          modules: { ':core': 75, ':data': 70 },
        },
      ]);
      await store.save(existingHistory);

      // Load history
      const manager = new DefaultHistoryManager(store, 50, 'main');
      await manager.load();
      expect(manager.getEntryCount()).toBe(1);

      // Compare current with baseline
      const snapshot = {
        overall: 80,
        covered: 800,
        total: 1000,
        modules: { ':core': 82, ':data': 78 },
      };

      const comparison = manager.compare(snapshot);
      expect(comparison).not.toBeNull();
      expect(comparison?.overallDelta).toBe(5);

      // Append new entry
      manager.append(
        { branch: 'feature/xyz', commit: 'new123', timestamp: '2025-01-02T00:00:00Z' },
        snapshot
      );
      expect(manager.getEntryCount()).toBe(2);

      // Persist changes
      await manager.persist();

      // Verify persistence
      const savedData = store.getData();
      expect(savedData).not.toBeNull();
      const saved = JSON.parse(savedData || '[]');
      expect(saved).toHaveLength(2);
      expect(saved[0].commit).toBe('new123');
      expect(saved[1].commit).toBe('baseline');
    });

    test('retention trimming across multiple appends', async () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 5, 'main'); // Keep only 5

      // Add 10 entries
      for (let i = 1; i <= 10; i++) {
        manager.append(
          {
            branch: i % 2 === 0 ? 'main' : 'feature',
            commit: `commit${i}`,
            timestamp: `2025-01-${i.toString().padStart(2, '0')}T00:00:00Z`,
          },
          {
            overall: 70 + i,
            covered: 700 + i * 10,
            total: 1000,
            modules: { ':core': 70 + i },
          }
        );
      }

      expect(manager.getEntryCount()).toBe(5); // Trimmed to 5

      await manager.persist();
      const savedDataStr = store.getData();
      expect(savedDataStr).not.toBeNull();
      const saved = JSON.parse(savedDataStr || '[]');

      expect(saved).toHaveLength(5);
      expect(saved[0].commit).toBe('commit10'); // Most recent
      expect(saved[4].commit).toBe('commit6'); // 5th most recent
    });

    test('handles multiple baseline branches correctly', async () => {
      const store = new InMemoryHistoryStore();
      const manager = new DefaultHistoryManager(store, 50, 'develop'); // Baseline is 'develop'

      // Add entries for main, develop, and feature branches
      manager.append(
        { branch: 'main', commit: 'main1', timestamp: '2025-01-01T00:00:00Z' },
        { overall: 75, covered: 750, total: 1000, modules: { ':core': 75 } }
      );

      manager.append(
        { branch: 'develop', commit: 'dev1', timestamp: '2025-01-02T00:00:00Z' },
        { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
      );

      manager.append(
        { branch: 'feature/xyz', commit: 'feat1', timestamp: '2025-01-03T00:00:00Z' },
        { overall: 82, covered: 820, total: 1000, modules: { ':core': 82 } }
      );

      // Compare should use 'develop' as baseline (most recent 'develop' entry)
      const comparison = manager.compare({
        overall: 85,
        covered: 850,
        total: 1000,
        modules: { ':core': 85 },
      });

      expect(comparison).not.toBeNull();
      expect(comparison?.baseline.branch).toBe('develop');
      expect(comparison?.baseline.commit).toBe('dev1');
      expect(comparison?.overallDelta).toBe(5); // 85 - 80
    });
  });
});
