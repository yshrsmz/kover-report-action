import type { DefaultArtifactClient } from '@actions/artifact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_FILENAME, loadHistoryFromArtifacts, saveHistoryToArtifacts } from '../artifacts';
import { SpyLogger } from '../common/logger';

// Mock @actions/artifact
vi.mock('@actions/artifact', () => {
  const mockClient = {
    getArtifact: vi.fn(),
    downloadArtifact: vi.fn(),
    uploadArtifact: vi.fn(),
  };

  return {
    DefaultArtifactClient: vi.fn(() => mockClient),
  };
});

// Mock @actions/core
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
}));

// Mock github module
vi.mock('../github', () => ({
  findArtifactFromBaseline: vi.fn(),
  downloadArtifactArchive: vi.fn(),
}));

// Mock @actions/tool-cache
vi.mock('@actions/tool-cache', () => ({
  extractZip: vi.fn(),
}));

describe('loadHistoryFromArtifacts', () => {
  let logger: SpyLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new SpyLogger();
  });

  it('should load history from existing artifact', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { readFile } = await import('node:fs/promises');

    const mockClient = new DefaultArtifactClient();

    // Mock artifact exists
    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: {
        id: 123,
        name: 'coverage-history',
        size: 1024,
      },
    });

    // Mock download
    vi.mocked(mockClient.downloadArtifact).mockResolvedValue({
      downloadPath: '/tmp/download',
    });

    // Mock file read
    const historyJson = JSON.stringify([
      {
        timestamp: '2025-01-15T10:30:00Z',
        branch: 'main',
        commit: 'abc123',
        overall: { percentage: 85.5, covered: 855, total: 1000 },
        modules: { ':core:common': 85.5 },
      },
    ]);
    vi.mocked(readFile).mockResolvedValue(historyJson);

    const result = await loadHistoryFromArtifacts(logger);

    expect(result).toBe(historyJson);
    expect(mockClient.getArtifact).toHaveBeenCalledWith('coverage-history');
    expect(mockClient.downloadArtifact).toHaveBeenCalledWith(123, expect.any(Object));
  });

  it('should return empty array when artifact not found', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    // Mock artifact not found
    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: undefined,
    } as unknown as Awaited<ReturnType<DefaultArtifactClient['getArtifact']>>);

    const result = await loadHistoryFromArtifacts(logger);

    expect(result).toBe('[]');
  });

  it('should return empty array when getArtifact throws', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    // Mock artifact API error
    vi.mocked(mockClient.getArtifact).mockRejectedValue(new Error('Artifact not found'));

    const result = await loadHistoryFromArtifacts(logger);

    expect(result).toBe('[]');
  });

  it('should return empty array when download fails', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: { id: 123, name: 'coverage-history', size: 1024 },
    });

    // Mock download failure
    vi.mocked(mockClient.downloadArtifact).mockRejectedValue(new Error('Download failed'));

    const result = await loadHistoryFromArtifacts(logger);

    expect(result).toBe('[]');
  });

  it('should use custom artifact name', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: undefined,
    } as unknown as Awaited<ReturnType<DefaultArtifactClient['getArtifact']>>);

    await loadHistoryFromArtifacts(logger, 'custom-history');

    expect(mockClient.getArtifact).toHaveBeenCalledWith('custom-history');
  });

  it('should load from baseline branch when baseline is configured', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { findArtifactFromBaseline, downloadArtifactArchive } = await import('../github');
    const { readFile } = await import('node:fs/promises');
    const toolCache = await import('@actions/tool-cache');
    const mockClient = new DefaultArtifactClient();

    // Mock finding artifact from baseline
    vi.mocked(findArtifactFromBaseline).mockResolvedValue({
      id: 999,
      name: 'coverage-history',
      archive_download_url: 'https://api.github.com/repos/owner/repo/actions/artifacts/999/zip',
    });

    // Mock the downloadArtifactArchive function
    vi.mocked(downloadArtifactArchive).mockResolvedValue(
      '/tmp/.coverage-history-temp/coverage-history.zip'
    );

    // Mock extractZip
    vi.mocked(toolCache.extractZip).mockResolvedValue('/tmp/.coverage-history-temp');

    const historyJson = JSON.stringify([{ timestamp: '2025-01-15T10:30:00Z' }]);
    vi.mocked(readFile).mockResolvedValue(historyJson);

    const result = await loadHistoryFromArtifacts(logger, 'coverage-history', 'test-token', 'main');

    expect(result).toBe(historyJson);
    expect(findArtifactFromBaseline).toHaveBeenCalledWith(
      logger,
      'test-token',
      'coverage-history',
      'main'
    );
    expect(downloadArtifactArchive).toHaveBeenCalledWith(
      logger,
      'test-token',
      'https://api.github.com/repos/owner/repo/actions/artifacts/999/zip',
      expect.stringContaining('coverage-history.zip')
    );
    expect(toolCache.extractZip).toHaveBeenCalledWith(
      expect.stringContaining('coverage-history.zip'),
      expect.stringContaining('.coverage-history-temp')
    );
    // Should NOT check current run when baseline is configured
    expect(mockClient.getArtifact).not.toHaveBeenCalled();
  });

  it('should not search baseline branch when no token provided', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { findArtifactFromBaseline } = await import('../github');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: undefined,
    } as unknown as Awaited<ReturnType<DefaultArtifactClient['getArtifact']>>);

    const result = await loadHistoryFromArtifacts(logger, 'coverage-history', undefined, 'main');

    expect(result).toBe('[]');
    expect(findArtifactFromBaseline).not.toHaveBeenCalled();
  });

  it('should not search baseline branch when no baseline branch provided', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { findArtifactFromBaseline } = await import('../github');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: undefined,
    } as unknown as Awaited<ReturnType<DefaultArtifactClient['getArtifact']>>);

    const result = await loadHistoryFromArtifacts(
      logger,
      'coverage-history',
      'test-token',
      undefined
    );

    expect(result).toBe('[]');
    expect(findArtifactFromBaseline).not.toHaveBeenCalled();
  });

  it('should always prefer baseline artifact when baseline is configured', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { findArtifactFromBaseline, downloadArtifactArchive } = await import('../github');
    const { readFile } = await import('node:fs/promises');
    const toolCache = await import('@actions/tool-cache');
    const mockClient = new DefaultArtifactClient();

    // Mock artifact found in baseline branch
    vi.mocked(findArtifactFromBaseline).mockResolvedValue({
      id: 999,
      name: 'coverage-history',
      archive_download_url: 'https://api.github.com/repos/owner/repo/actions/artifacts/999/zip',
    });

    vi.mocked(downloadArtifactArchive).mockResolvedValue(
      '/tmp/.coverage-history-temp/coverage-history.zip'
    );

    vi.mocked(toolCache.extractZip).mockResolvedValue('/tmp/.coverage-history-temp');

    const historyJson = JSON.stringify([{ timestamp: '2025-01-15T10:30:00Z' }]);
    vi.mocked(readFile).mockResolvedValue(historyJson);

    const result = await loadHistoryFromArtifacts(logger, 'coverage-history', 'test-token', 'main');

    expect(result).toBe(historyJson);
    // Should always search baseline when token + branch provided (for comparing against baseline)
    expect(findArtifactFromBaseline).toHaveBeenCalledWith(
      logger,
      'test-token',
      'coverage-history',
      'main'
    );
    // Should NOT check current run when baseline is configured
    expect(mockClient.getArtifact).not.toHaveBeenCalled();
    expect(downloadArtifactArchive).toHaveBeenCalledWith(
      logger,
      'test-token',
      'https://api.github.com/repos/owner/repo/actions/artifacts/999/zip',
      expect.stringContaining('coverage-history.zip')
    );
  });

  it('should return empty array when baseline artifact not found', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { findArtifactFromBaseline } = await import('../github');
    const mockClient = new DefaultArtifactClient();

    // Mock artifact not in current run
    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: undefined,
    } as unknown as Awaited<ReturnType<DefaultArtifactClient['getArtifact']>>);

    // Mock baseline search returns null
    vi.mocked(findArtifactFromBaseline).mockResolvedValue(null);

    const result = await loadHistoryFromArtifacts(logger, 'coverage-history', 'test-token', 'main');

    expect(result).toBe('[]');
    expect(findArtifactFromBaseline).toHaveBeenCalledWith(
      logger,
      'test-token',
      'coverage-history',
      'main'
    );
  });
});

describe('saveHistoryToArtifacts', () => {
  let logger: SpyLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new SpyLogger();
  });

  it('should save history to artifact', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { writeFile } = await import('node:fs/promises');
    const mockClient = new DefaultArtifactClient();

    const historyJson = JSON.stringify([
      {
        timestamp: '2025-01-15T10:30:00Z',
        branch: 'main',
        commit: 'abc123',
        overall: { percentage: 85.5, covered: 855, total: 1000 },
        modules: { ':core:common': 85.5 },
      },
    ]);

    vi.mocked(mockClient.uploadArtifact).mockResolvedValue({
      id: 456,
      size: 1024,
    });

    await saveHistoryToArtifacts(logger, historyJson);

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(HISTORY_FILENAME),
      historyJson,
      'utf-8'
    );
    expect(mockClient.uploadArtifact).toHaveBeenCalledWith(
      'coverage-history',
      expect.arrayContaining([expect.stringContaining(HISTORY_FILENAME)]),
      expect.any(String),
      expect.objectContaining({ retentionDays: 90 })
    );
  });

  it('should handle upload failure gracefully', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { writeFile } = await import('node:fs/promises');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mockClient.uploadArtifact).mockRejectedValue(new Error('Upload failed'));

    // Should not throw
    await expect(saveHistoryToArtifacts(logger, '{}')).resolves.toBeUndefined();
  });

  it('should use custom artifact name', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.uploadArtifact).mockResolvedValue({
      id: 456,
      size: 1024,
    });

    await saveHistoryToArtifacts(logger, '{}', 'custom-history');

    expect(mockClient.uploadArtifact).toHaveBeenCalledWith(
      'custom-history',
      expect.any(Array),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('should create temp directory if it does not exist', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const { mkdir } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    const mockClient = new DefaultArtifactClient();

    // Mock directory doesn't exist
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mockClient.uploadArtifact).mockResolvedValue({
      id: 456,
      size: 1024,
    });

    await saveHistoryToArtifacts(logger, '{}');

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('should set 90-day retention', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.uploadArtifact).mockResolvedValue({
      id: 456,
      size: 1024,
    });

    await saveHistoryToArtifacts(logger, '{}');

    expect(mockClient.uploadArtifact).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ retentionDays: 90 })
    );
  });
});
