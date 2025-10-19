import type { OverallCoverage } from '../coverage';
import type { HistoryComparison, HistoryEntry } from '../history';

export interface ReportResult {
  overall: OverallCoverage;
  comparison?: HistoryComparison;
  history?: HistoryEntry[];
}

/**
 * Reporter function type
 * A reporter takes a result and title, and emits the report
 */
export type Reporter = (result: ReportResult, title: string) => Promise<void>;

export { createActionsReporter } from './actions-reporter';
