import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpyLogger } from '../common/logger';

// Mock the modules
vi.mock('@actions/github');

import { findArtifactFromBaseline } from '../history/github-artifacts';
// Import after mocking
import { postCoverageComment } from '../reporter/github';

describe('postCoverageComment', () => {
  let logger: SpyLogger;
  let setSecret: (secret: string) => void;
  const mockOctokit = {
    rest: {
      issues: {
        createComment: vi.fn(),
        updateComment: vi.fn(),
        listComments: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    logger = new SpyLogger();
    setSecret = vi.fn();

    // @ts-expect-error - mocking github context
    github.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      payload: {
        pull_request: { number: 123 },
      },
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mock type casting for test setup
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });

  it('should create a new comment when none exists', async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [], // No existing comments
    });
    mockOctokit.rest.issues.createComment.mockResolvedValue({
      data: { id: 456 },
    });

    const report = '<!-- kover-coverage-report -->\n## Coverage Report';
    await postCoverageComment(logger, setSecret, 'test-token', report);

    expect(setSecret).toHaveBeenCalledWith('test-token');
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
    });
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: report,
    });
    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  it('should update existing comment when found', async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [
        { id: 100, body: 'Some other comment' },
        { id: 200, body: '<!-- kover-coverage-report -->\nOld report' },
        { id: 300, body: 'Another comment' },
      ],
    });
    mockOctokit.rest.issues.updateComment.mockResolvedValue({
      data: { id: 200 },
    });

    const report = '<!-- kover-coverage-report -->\n## New Coverage Report';
    await postCoverageComment(logger, setSecret, 'test-token', report);

    expect(setSecret).toHaveBeenCalledWith('test-token');
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
    });
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      comment_id: 200,
      body: report,
    });
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('should handle missing token gracefully', async () => {
    await postCoverageComment(logger, setSecret, '', 'report');

    expect(logger.calls.info).toContain('No GitHub token provided. Skipping PR comment posting.');
    expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  it('should skip when not in PR context', async () => {
    // @ts-expect-error - mocking github context
    github.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      payload: {}, // No pull_request
    };

    await postCoverageComment(logger, setSecret, 'test-token', 'report');

    expect(logger.calls.info).toContain(
      'Not running in a pull request context. Skipping PR comment.'
    );
    expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
  });

  it('should handle API errors without throwing', async () => {
    mockOctokit.rest.issues.listComments.mockRejectedValue(new Error('API Error'));

    const report = '<!-- kover-coverage-report -->\n## Coverage Report';
    await expect(
      postCoverageComment(logger, setSecret, 'test-token', report)
    ).resolves.not.toThrow();

    expect(logger.calls.warn).toContain('Failed to post coverage comment: API Error');
  });

  it('should handle rate limit errors gracefully', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    mockOctokit.rest.issues.listComments.mockRejectedValue(rateLimitError);

    await postCoverageComment(logger, setSecret, 'test-token', 'report');

    expect(logger.calls.warn).toContain('Failed to post coverage comment: Rate limit exceeded');
  });

  it('should mask token in logs', async () => {
    const token = 'ghp_secret_token_12345';
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

    await postCoverageComment(logger, setSecret, token, 'report');

    expect(setSecret).toHaveBeenCalledWith(token);
  });

  it('should handle create comment failure', async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.createComment.mockRejectedValue(new Error('Create failed'));

    await expect(
      postCoverageComment(logger, setSecret, 'test-token', 'report')
    ).resolves.not.toThrow();

    expect(logger.calls.warn).toContain('Failed to post coverage comment: Create failed');
  });

  it('should handle update comment failure', async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 200, body: '<!-- kover-coverage-report -->\nOld' }],
    });
    mockOctokit.rest.issues.updateComment.mockRejectedValue(new Error('Update failed'));

    await expect(
      postCoverageComment(logger, setSecret, 'test-token', 'report')
    ).resolves.not.toThrow();

    expect(logger.calls.warn).toContain('Failed to post coverage comment: Update failed');
  });
});

describe('findArtifactFromBaseline', () => {
  let logger: SpyLogger;
  const mockOctokit = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: vi.fn(),
        listWorkflowRunArtifacts: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new SpyLogger();

    // @ts-expect-error - mocking github context
    github.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mock type casting for test setup
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });

  it('should find artifact from baseline branch', async () => {
    // Mock workflow runs
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 1001, name: 'CI', conclusion: 'success' },
          { id: 1002, name: 'CI', conclusion: 'success' },
        ],
      },
    });

    // Mock artifacts for first run
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            id: 5001,
            name: 'coverage-history',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5001/zip',
          },
          {
            id: 5002,
            name: 'other-artifact',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toEqual({
      id: 5001,
      name: 'coverage-history',
      archive_download_url: expect.any(String),
    });
    expect(mockOctokit.rest.actions.listWorkflowRunsForRepo).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      status: 'completed',
      per_page: 100,
      page: 1,
    });
    expect(mockOctokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      run_id: 1001,
      per_page: 100,
    });
  });

  it('should paginate through workflow runs until artifact is found', async () => {
    // Mock first page - no artifact
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValueOnce({
      data: {
        workflow_runs: [{ id: 1001, name: 'CI', conclusion: 'success' }],
      },
    });
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            id: 5001,
            name: 'other-artifact',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5001/zip',
          },
        ],
      },
    });

    // Mock second page - artifact found
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValueOnce({
      data: {
        workflow_runs: [{ id: 1002, name: 'CI', conclusion: 'success' }],
      },
    });
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            id: 5002,
            name: 'coverage-history',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toEqual({
      id: 5002,
      name: 'coverage-history',
      archive_download_url:
        'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
    });
    expect(mockOctokit.rest.actions.listWorkflowRunsForRepo).toHaveBeenCalledTimes(2);
    expect(mockOctokit.rest.actions.listWorkflowRunsForRepo).toHaveBeenNthCalledWith(1, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      status: 'completed',
      per_page: 100,
      page: 1,
    });
    expect(mockOctokit.rest.actions.listWorkflowRunsForRepo).toHaveBeenNthCalledWith(2, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      status: 'completed',
      per_page: 100,
      page: 2,
    });
  });

  it('should skip expired artifacts', async () => {
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 1001, name: 'CI', conclusion: 'success' },
          { id: 1002, name: 'CI', conclusion: 'success' },
        ],
      },
    });

    // First run has expired artifact
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            id: 5001,
            name: 'coverage-history',
            expired: true,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5001/zip',
          },
        ],
      },
    });

    // Second run has valid artifact
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            id: 5002,
            name: 'coverage-history',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toEqual({
      id: 5002,
      name: 'coverage-history',
      archive_download_url:
        'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
    });
  });

  it('should return null when artifact not found', async () => {
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [{ id: 1001, name: 'CI', conclusion: 'success' }],
      },
    });

    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
      data: {
        artifacts: [
          {
            id: 5001,
            name: 'other-artifact',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5001/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toBeNull();
  });

  it('should return null when no workflow runs exist', async () => {
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toBeNull();
    expect(mockOctokit.rest.actions.listWorkflowRunArtifacts).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockRejectedValue(new Error('API Error'));

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toBeNull();
    expect(logger.calls.warn).toContain('Failed to search for baseline artifact: API Error');
  });

  it('should handle artifact listing errors for specific runs', async () => {
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 1001, name: 'CI', conclusion: 'success' },
          { id: 1002, name: 'CI', conclusion: 'success' },
        ],
      },
    });

    // First run errors
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockRejectedValueOnce(
      new Error('Artifact list failed')
    );

    // Second run succeeds
    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            id: 5002,
            name: 'coverage-history',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toEqual({
      id: 5002,
      name: 'coverage-history',
      archive_download_url:
        'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
    });
    expect(logger.calls.debug).toContain(
      'Could not list artifacts for run #1001: Artifact list failed'
    );
  });

  it('should stop after max pages', async () => {
    // Always return runs to simulate many pages
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [{ id: 1001, name: 'CI', conclusion: 'success' }],
      },
    });

    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
      data: {
        artifacts: [
          {
            id: 5001,
            name: 'other-artifact',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5001/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toBeNull();
    // Should stop at max pages (5 with increased per_page)
    expect(mockOctokit.rest.actions.listWorkflowRunsForRepo).toHaveBeenCalledTimes(5);
  });

  it('should check multiple artifacts in a single run', async () => {
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [{ id: 1001, name: 'CI', conclusion: 'success' }],
      },
    });

    mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
      data: {
        artifacts: [
          {
            id: 5001,
            name: 'artifact1',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5001/zip',
          },
          {
            id: 5002,
            name: 'artifact2',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5002/zip',
          },
          {
            id: 5003,
            name: 'coverage-history',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5003/zip',
          },
          {
            id: 5004,
            name: 'artifact4',
            expired: false,
            archive_download_url:
              'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5004/zip',
          },
        ],
      },
    });

    const result = await findArtifactFromBaseline(logger, 'test-token', 'coverage-history', 'main');

    expect(result).toEqual({
      id: 5003,
      name: 'coverage-history',
      archive_download_url:
        'https://api.github.com/repos/test-owner/test-repo/actions/artifacts/5003/zip',
    });
  });
});
