// From parser.ts

export type {
  ModuleCoverage,
  ModuleInfo,
  OverallCoverage,
} from './aggregator.js';
// From aggregator.ts
export {
  aggregateCoverage,
  getFailedModules,
  getMissingCoverageModules,
} from './aggregator.js';
export type { CoverageResult } from './parser.js';
export { parseCoverageFile } from './parser.js';

// From threshold.ts
export {
  checkThreshold,
  getModuleType,
  getThresholdForModule,
} from './threshold.js';
