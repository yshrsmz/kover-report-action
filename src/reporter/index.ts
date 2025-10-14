import type { OverallCoverage } from '../aggregator';
import type { HistoryComparison } from '../history';

export interface ReportResult {
  overall: OverallCoverage;
  comparison?: HistoryComparison;
}

/**
 * Reporter function type
 * A reporter takes a result and title, and emits the report
 */
export type Reporter = (result: ReportResult, title: string) => Promise<void>;

export { createActionsReporter } from './actions-reporter';
