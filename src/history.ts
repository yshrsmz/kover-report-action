/**
 * History tracking for coverage data
 * Stores coverage history in GitHub artifacts and compares against baseline
 */

/**
 * Default history retention (number of entries to keep)
 */
export const DEFAULT_HISTORY_RETENTION = 50

/**
 * Default baseline branch name
 */
export const DEFAULT_BASELINE_BRANCH = 'main'

/**
 * A single history entry representing coverage at a point in time
 */
export interface HistoryEntry {
  timestamp: string // ISO 8601 format
  branch: string // Branch name (e.g., 'main', 'feature/xyz')
  commit: string // Commit SHA
  overall: {
    percentage: number // Overall coverage percentage
    covered: number // Total covered instructions
    total: number // Total instructions
  }
  modules: Record<string, number> // Module name -> coverage percentage
}

/**
 * Comparison result between current and baseline coverage
 */
export interface HistoryComparison {
  overallDelta: number // Change in overall coverage (percentage points)
  moduleDelta: Record<string, number | null> // Module name -> delta (null if no baseline)
  baseline: HistoryEntry // The baseline entry used for comparison
}

/**
 * Load history from JSON string
 * Returns empty array if JSON is invalid or not an array
 */
export function loadHistory(json: string): HistoryEntry[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed as HistoryEntry[]
  } catch {
    return []
  }
}

/**
 * Save history to JSON string
 */
export function saveHistory(history: HistoryEntry[]): string {
  return JSON.stringify(history, null, 2)
}

/**
 * Add a new entry to history (prepends to array)
 * Returns a new array without mutating the original
 */
export function addHistoryEntry(
  history: HistoryEntry[],
  entry: HistoryEntry
): HistoryEntry[] {
  return [entry, ...history]
}

/**
 * Trim history to keep only the most recent N entries
 * Returns a new array without mutating the original
 */
export function trimHistory(
  history: HistoryEntry[],
  retention: number
): HistoryEntry[] {
  return history.slice(0, retention)
}

/**
 * Compare current coverage with baseline from history
 * Returns null if no baseline exists for the specified branch
 */
export function compareWithBaseline(
  history: HistoryEntry[],
  currentModules: Record<string, number>,
  currentOverall: number,
  baselineBranch: string
): HistoryComparison | null {
  // Find most recent entry from the baseline branch
  const baseline = history.find(entry => entry.branch === baselineBranch)

  if (!baseline) {
    return null
  }

  // Calculate overall delta
  const overallDelta = currentOverall - baseline.overall.percentage

  // Calculate per-module delta
  const moduleDelta: Record<string, number | null> = {}
  for (const [moduleName, currentCoverage] of Object.entries(currentModules)) {
    const baselineCoverage = baseline.modules[moduleName]
    if (baselineCoverage !== undefined) {
      moduleDelta[moduleName] = currentCoverage - baselineCoverage
    } else {
      // Module exists in current but not in baseline (new module)
      moduleDelta[moduleName] = null
    }
  }

  return {
    overallDelta,
    moduleDelta,
    baseline
  }
}

/**
 * Create a history entry from current coverage data
 */
export function createHistoryEntry(
  timestamp: string,
  branch: string,
  commit: string,
  overallPercentage: number,
  overallCovered: number,
  overallTotal: number,
  modules: Record<string, number>
): HistoryEntry {
  return {
    timestamp,
    branch,
    commit,
    overall: {
      percentage: overallPercentage,
      covered: overallCovered,
      total: overallTotal
    },
    modules
  }
}

/**
 * Get trend indicator emoji based on delta
 * @param delta - Coverage change in percentage points
 * @returns Emoji: ↑ (increase), ↓ (decrease), → (no change)
 */
export function getTrendIndicator(delta: number): string {
  if (delta > 0.1) return '↑' // Increased
  if (delta < -0.1) return '↓' // Decreased
  return '→' // No significant change (±0.1%)
}

/**
 * Format delta as a string with sign and percentage
 * @param delta - Coverage change in percentage points
 * @returns Formatted string like "+2.5%" or "-1.0%"
 */
export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

/**
 * Validate history entry structure
 * Returns true if entry has all required fields
 */
export function isValidHistoryEntry(entry: unknown): entry is HistoryEntry {
  if (typeof entry !== 'object' || entry === null) return false

  const e = entry as Record<string, unknown>

  return (
    typeof e.timestamp === 'string' &&
    typeof e.branch === 'string' &&
    typeof e.commit === 'string' &&
    typeof e.overall === 'object' &&
    e.overall !== null &&
    typeof (e.overall as Record<string, unknown>).percentage === 'number' &&
    typeof (e.overall as Record<string, unknown>).covered === 'number' &&
    typeof (e.overall as Record<string, unknown>).total === 'number' &&
    typeof e.modules === 'object' &&
    e.modules !== null
  )
}
