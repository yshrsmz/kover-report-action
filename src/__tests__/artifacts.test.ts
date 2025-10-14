import type { DefaultArtifactClient } from '@actions/artifact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_FILENAME, loadHistoryFromArtifacts, saveHistoryToArtifacts } from '../artifacts';

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

describe('loadHistoryFromArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const result = await loadHistoryFromArtifacts();

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

    const result = await loadHistoryFromArtifacts();

    expect(result).toBe('[]');
  });

  it('should return empty array when getArtifact throws', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    // Mock artifact API error
    vi.mocked(mockClient.getArtifact).mockRejectedValue(new Error('Artifact not found'));

    const result = await loadHistoryFromArtifacts();

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

    const result = await loadHistoryFromArtifacts();

    expect(result).toBe('[]');
  });

  it('should use custom artifact name', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.getArtifact).mockResolvedValue({
      artifact: undefined,
    } as unknown as Awaited<ReturnType<DefaultArtifactClient['getArtifact']>>);

    await loadHistoryFromArtifacts('custom-history');

    expect(mockClient.getArtifact).toHaveBeenCalledWith('custom-history');
  });
});

describe('saveHistoryToArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await saveHistoryToArtifacts(historyJson);

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
    await expect(saveHistoryToArtifacts('{}')).resolves.toBeUndefined();
  });

  it('should use custom artifact name', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.uploadArtifact).mockResolvedValue({
      id: 456,
      size: 1024,
    });

    await saveHistoryToArtifacts('{}', 'custom-history');

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

    await saveHistoryToArtifacts('{}');

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('should set 90-day retention', async () => {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const mockClient = new DefaultArtifactClient();

    vi.mocked(mockClient.uploadArtifact).mockResolvedValue({
      id: 456,
      size: 1024,
    });

    await saveHistoryToArtifacts('{}');

    expect(mockClient.uploadArtifact).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ retentionDays: 90 })
    );
  });
});
