/**
 * Discovery layer interfaces and types
 *
 * This module defines the abstraction for module discovery strategies.
 * Multiple implementations (command-based, glob-based) can be swapped
 * via dependency injection.
 */

export interface DiscoveryConfig {
  ignoredModules: string[];
}

export interface ModuleReference {
  name: string;
  filePath: string;
}

/**
 * Module discovery function type
 * A discovery function takes a config and returns discovered modules
 */
export type ModuleDiscovery = (config: DiscoveryConfig) => Promise<ModuleReference[]>;

export { createCommandDiscovery } from './command.js';
export { createGlobDiscovery } from './glob.js';

// Re-export utility functions
export {
  discoverModulesFromCommand,
  discoverModulesFromGlob,
  extractModuleName,
  parseGradleProjects,
} from './utils.js';
