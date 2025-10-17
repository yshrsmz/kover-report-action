// From parser.ts

export type {
  ModuleCoverage,
  ModuleInfo,
  OverallCoverage,
} from './aggregator';
// From aggregator.ts
export {
  aggregateCoverage,
  getFailedModules,
  getMissingCoverageModules,
} from './aggregator';
export type { CoverageResult } from './parser';
export { parseCoverageFile } from './parser';

// From threshold.ts
export {
  checkThreshold,
  getModuleType,
  getThresholdForModule,
} from './threshold';
