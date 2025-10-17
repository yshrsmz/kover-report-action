import { beforeEach, describe, expect, it } from 'vitest';
import { SpyLogger } from '../common/logger';
import { extractModuleName, parseGradleProjects } from '../discovery/utils';
import { loadFixture } from './helpers';

describe('parseGradleProjects', () => {
  it('should extract module names from Gradle output', async () => {
    const output = await loadFixture('gradle-output/multi-module.txt');
    const modules = parseGradleProjects(output);

    expect(modules).toEqual([
      ':app',
      ':core:common',
      ':core:testing',
      ':data:repository',
      ':feature:auth',
    ]);
  });

  it('should filter out Root project line', async () => {
    const output = await loadFixture('gradle-output/multi-module.txt');
    const modules = parseGradleProjects(output);

    expect(modules).not.toContain('myapp');
    expect(modules.every((m) => !m.includes('Root project'))).toBe(true);
  });

  it('should handle single module', async () => {
    const output = await loadFixture('gradle-output/single-module.txt');
    const modules = parseGradleProjects(output);

    expect(modules).toEqual([':app']);
  });

  it('should return empty array for empty output', () => {
    const modules = parseGradleProjects('');
    expect(modules).toEqual([]);
  });

  it('should handle modules with special characters', () => {
    const output = "Project ':module-name_123'";
    const modules = parseGradleProjects(output);
    expect(modules).toEqual([':module-name_123']);
  });

  it('should handle modules without leading colon', () => {
    const output = "Project 'module-name'";
    const modules = parseGradleProjects(output);
    expect(modules).toEqual([':module-name']);
  });
});

describe('extractModuleName', () => {
  let logger: SpyLogger;

  beforeEach(() => {
    logger = new SpyLogger();
  });

  it('should extract module name from two-level module path', () => {
    const moduleName = extractModuleName(logger, 'core/common/build/reports/kover/report.xml');
    expect(moduleName).toBe(':core:common');
  });

  it('should handle single-level modules', () => {
    const moduleName = extractModuleName(logger, 'app/build/reports/kover/report.xml');
    expect(moduleName).toBe(':app');
  });

  it('should handle three-level modules', () => {
    const moduleName = extractModuleName(logger, 'feature/auth/ui/build/reports/kover/report.xml');
    expect(moduleName).toBe(':feature:auth:ui');
  });

  it('should handle alternative path patterns', () => {
    const moduleName = extractModuleName(logger, 'core/common/kover/report.xml');
    expect(moduleName).toBe(':core:common');
  });

  it('should handle absolute paths within workspace', () => {
    // Mock workspace environment
    const originalEnv = process.env.GITHUB_WORKSPACE;
    process.env.GITHUB_WORKSPACE = '/home/user/workspace';

    const moduleName = extractModuleName(
      logger,
      '/home/user/workspace/core/common/build/reports/kover/report.xml'
    );
    expect(moduleName).toBe(':core:common');

    // Restore
    process.env.GITHUB_WORKSPACE = originalEnv;
  });

  it('should handle Windows-style backslashes', () => {
    const moduleName = extractModuleName(logger, 'core\\common\\build\\reports\\kover\\report.xml');
    expect(moduleName).toBe(':core:common');
  });

  it('should handle mixed path separators', () => {
    const moduleName = extractModuleName(logger, 'core/common\\build/reports\\kover/report.xml');
    expect(moduleName).toBe(':core:common');
  });
});
