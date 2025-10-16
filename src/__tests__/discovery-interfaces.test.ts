import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as discoveryModule from '../discovery';
import { createCommandDiscovery, createGlobDiscovery } from '../discovery/index';
import { SpyLogger } from '../logger';
import * as pathsModule from '../paths';

// Mock the old discovery module functions
vi.mock('../discovery', () => ({
  discoverModulesFromCommand: vi.fn(),
  discoverModulesFromGlob: vi.fn(),
}));

vi.mock('../paths', async () => {
  const actual = await vi.importActual('../paths');
  return {
    ...actual,
    resolveModulePath: vi.fn(),
  };
});

describe('createCommandDiscovery', () => {
  let logger: SpyLogger;
  const mockDiscoverModulesFromCommand = vi.mocked(discoveryModule.discoverModulesFromCommand);
  const mockResolveModulePath = vi.mocked(pathsModule.resolveModulePath);

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new SpyLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create discovery function that discovers modules and resolves paths', async () => {
    const command = './gradlew -q projects';
    const pathTemplate = '{module}/build/reports/kover/report.xml';
    const discover = createCommandDiscovery(logger, command, pathTemplate);

    mockDiscoverModulesFromCommand.mockResolvedValue([':core', ':app']);
    mockResolveModulePath.mockImplementation(
      (module: string) => `${module.slice(1)}/build/reports/kover/report.xml`
    );

    const result = await discover({ ignoredModules: [] });

    expect(mockDiscoverModulesFromCommand).toHaveBeenCalledWith(logger, command, []);
    expect(mockResolveModulePath).toHaveBeenCalledWith(':core', pathTemplate);
    expect(mockResolveModulePath).toHaveBeenCalledWith(':app', pathTemplate);
    expect(result).toEqual([
      { name: ':core', filePath: 'core/build/reports/kover/report.xml' },
      { name: ':app', filePath: 'app/build/reports/kover/report.xml' },
    ]);
  });

  it('should pass ignored modules to discovery function', async () => {
    const command = './gradlew -q projects';
    const pathTemplate = '{module}/build/reports/kover/report.xml';
    const discover = createCommandDiscovery(logger, command, pathTemplate);

    mockDiscoverModulesFromCommand.mockResolvedValue([':core']);
    mockResolveModulePath.mockReturnValue('core/build/reports/kover/report.xml');

    await discover({ ignoredModules: [':test', ':build-logic'] });

    expect(mockDiscoverModulesFromCommand).toHaveBeenCalledWith(logger, command, [
      ':test',
      ':build-logic',
    ]);
  });

  it('should throw helpful error when no modules found', async () => {
    const command = './gradlew -q projects';
    const pathTemplate = '{module}/build/reports/kover/report.xml';
    const discover = createCommandDiscovery(logger, command, pathTemplate);

    mockDiscoverModulesFromCommand.mockResolvedValue([]);

    await expect(discover({ ignoredModules: [] })).rejects.toThrow(
      /No modules found by discovery command/
    );
    await expect(discover({ ignoredModules: [] })).rejects.toThrow(
      /Command: .\/gradlew -q projects/
    );
  });

  it('should propagate errors from discovery function', async () => {
    const command = './gradlew -q projects';
    const pathTemplate = '{module}/build/reports/kover/report.xml';
    const discover = createCommandDiscovery(logger, command, pathTemplate);

    mockDiscoverModulesFromCommand.mockRejectedValue(new Error('Command execution failed'));

    await expect(discover({ ignoredModules: [] })).rejects.toThrow('Command execution failed');
  });
});

describe('createGlobDiscovery', () => {
  let logger: SpyLogger;
  const mockDiscoverModulesFromGlob = vi.mocked(discoveryModule.discoverModulesFromGlob);

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new SpyLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create discovery function that discovers modules using glob pattern', async () => {
    const pattern = '**/build/reports/kover/report.xml';
    const discover = createGlobDiscovery(logger, pattern);

    mockDiscoverModulesFromGlob.mockResolvedValue([
      { module: ':core', filePath: 'core/build/reports/kover/report.xml' },
      { module: ':app', filePath: 'app/build/reports/kover/report.xml' },
    ]);

    const result = await discover({ ignoredModules: [] });

    expect(mockDiscoverModulesFromGlob).toHaveBeenCalledWith(logger, pattern, []);
    expect(result).toEqual([
      { name: ':core', filePath: 'core/build/reports/kover/report.xml' },
      { name: ':app', filePath: 'app/build/reports/kover/report.xml' },
    ]);
  });

  it('should pass ignored modules to discovery function', async () => {
    const pattern = '**/build/reports/kover/report.xml';
    const discover = createGlobDiscovery(logger, pattern);

    mockDiscoverModulesFromGlob.mockResolvedValue([
      { module: ':core', filePath: 'core/build/reports/kover/report.xml' },
    ]);

    await discover({ ignoredModules: [':test'] });

    expect(mockDiscoverModulesFromGlob).toHaveBeenCalledWith(logger, pattern, [':test']);
  });

  it('should throw helpful error when no files found', async () => {
    const pattern = '**/build/reports/kover/report.xml';
    const discover = createGlobDiscovery(logger, pattern);

    mockDiscoverModulesFromGlob.mockResolvedValue([]);

    await expect(discover({ ignoredModules: [] })).rejects.toThrow(
      /No coverage files found matching pattern/
    );
    await expect(discover({ ignoredModules: [] })).rejects.toThrow(
      /Pattern: \*\*\/build\/reports\/kover\/report.xml/
    );
  });

  it('should propagate errors from discovery function', async () => {
    const pattern = '**/build/reports/kover/report.xml';
    const discover = createGlobDiscovery(logger, pattern);

    mockDiscoverModulesFromGlob.mockRejectedValue(new Error('Glob pattern failed'));

    await expect(discover({ ignoredModules: [] })).rejects.toThrow('Glob pattern failed');
  });
});
