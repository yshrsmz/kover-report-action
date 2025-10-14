import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSecurePath } from '../paths';

describe('resolveSecurePath - Path Traversal Prevention', () => {
  const workspace = '/home/user/workspace';

  it('should allow valid relative path', () => {
    const result = resolveSecurePath(workspace, 'core/common/report.xml');
    expect(result).toContain('workspace');
    expect(result).toContain('core/common/report.xml');
  });

  it('should allow nested modules', () => {
    const result = resolveSecurePath(workspace, 'feature/auth/ui/report.xml');
    expect(result).toContain('feature/auth/ui/report.xml');
  });

  it('should reject path traversal with ../', () => {
    expect(() => {
      resolveSecurePath(workspace, '../../../etc/passwd');
    }).toThrow('Path traversal detected');
  });

  it('should reject path traversal in middle of path', () => {
    expect(() => {
      resolveSecurePath(workspace, 'core/../../../etc/passwd');
    }).toThrow('Path traversal detected');
  });

  it('should reject absolute paths that escape workspace', () => {
    expect(() => {
      resolveSecurePath(workspace, '/etc/passwd');
    }).toThrow('Path traversal detected');
  });

  it('should allow paths with . (current directory)', () => {
    const result = resolveSecurePath(workspace, './core/common/report.xml');
    expect(result).toContain('core/common/report.xml');
  });

  it('should normalize paths correctly', () => {
    const result = resolveSecurePath(workspace, 'core/./common/../common/report.xml');
    // After normalization, should still be within workspace
    expect(result.startsWith(workspace)).toBe(true);
  });

  it('should handle Windows-style paths (if on Windows)', () => {
    // This test adapts based on platform
    const result = resolveSecurePath(workspace, join('core', 'common', 'report.xml'));
    expect(result).toBeTruthy();
  });

  it('should reject symlink-style attacks', () => {
    // Paths that might resolve outside after symlink resolution
    expect(() => {
      resolveSecurePath(workspace, 'link/../../../etc/passwd');
    }).toThrow('Path traversal detected');
  });

  it('should handle module names with special characters safely', () => {
    // Module names might have special characters but shouldn't allow traversal
    const result = resolveSecurePath(workspace, 'module-name_123/report.xml');
    expect(result).toContain('module-name_123');
  });
});
