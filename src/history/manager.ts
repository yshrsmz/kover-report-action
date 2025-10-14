/**
 * History Manager - Stateful coordinator for coverage history operations
 *
 * This uses a class (not functional pattern) because it genuinely needs stateful behavior:
 * - Maintains mutable `history` array across load/compare/append/persist operations
 * - Operations mutate internal state (append modifies history, load initializes it)
 * - Lifecycle: load → mutate (compare/append) → persist
 */

import {
  addHistoryEntry,
  compareWithBaseline,
  createHistoryEntry,
  type HistoryComparison,
  type HistoryEntry,
  loadHistory,
  saveHistory,
  trimHistory,
} from '../history';

/**
 * Storage interface for history persistence
 * Abstracts artifact I/O, file system, or other storage mechanisms
 */
export interface HistoryStore {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
}

/**
 * Context information for a coverage snapshot
 */
export interface HistoryContext {
  branch: string;
  commit: string;
  timestamp: string;
}

/**
 * Coverage snapshot data for history tracking
 */
export interface CoverageSnapshot {
  overall: number;
  covered: number;
  total: number;
  modules: Record<string, number>;
}

/**
 * History Manager - Coordinates coverage history operations
 *
 * Manages the lifecycle of coverage history:
 * 1. load() - Initialize from storage
 * 2. compare() - Compare current coverage with baseline
 * 3. append() - Add new entry to history
 * 4. persist() - Save to storage
 */
export class HistoryManager {
  private history: HistoryEntry[] = [];

  constructor(
    private readonly store: HistoryStore,
    private readonly retention: number,
    private readonly baselineBranch: string
  ) {}

  /**
   * Load history from storage
   * Initializes internal history array
   */
  async load(): Promise<void> {
    const json = await this.store.load();
    if (json) {
      this.history = loadHistory(json);
    }
  }

  /**
   * Compare current coverage snapshot with baseline
   * Returns null if no baseline exists for the configured branch
   */
  compare(snapshot: CoverageSnapshot): HistoryComparison | null {
    if (this.history.length === 0) {
      return null;
    }

    return compareWithBaseline(
      this.history,
      snapshot.modules,
      snapshot.overall,
      this.baselineBranch
    );
  }

  /**
   * Append new coverage snapshot to history
   * Automatically trims history based on retention policy
   */
  append(context: HistoryContext, snapshot: CoverageSnapshot): void {
    const entry = createHistoryEntry(
      context.timestamp,
      context.branch,
      context.commit,
      snapshot.overall,
      snapshot.covered,
      snapshot.total,
      snapshot.modules
    );

    this.history = trimHistory(addHistoryEntry(this.history, entry), this.retention);
  }

  /**
   * Persist current history to storage
   */
  async persist(): Promise<void> {
    const json = saveHistory(this.history);
    await this.store.save(json);
  }

  /**
   * Get current number of history entries
   * Useful for testing and debugging
   */
  getEntryCount(): number {
    return this.history.length;
  }
}
