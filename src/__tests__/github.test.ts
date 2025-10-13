import * as core from '@actions/core';
import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the modules
vi.mock('@actions/core');
vi.mock('@actions/github');

// Import after mocking
import { postCoverageComment } from '../github';

describe('postCoverageComment', () => {
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

    // Setup default mocks
    vi.mocked(core.info).mockImplementation(() => {});
    vi.mocked(core.warning).mockImplementation(() => {});
    vi.mocked(core.setSecret).mockImplementation(() => {});

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
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [], // No existing comments
    } as any);
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.createComment.mockResolvedValue({
      data: { id: 456 },
    } as any);

    const report = '<!-- kover-coverage-report -->\n## Coverage Report';
    await postCoverageComment('test-token', report);

    expect(core.setSecret).toHaveBeenCalledWith('test-token');
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
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [
        { id: 100, body: 'Some other comment' },
        { id: 200, body: '<!-- kover-coverage-report -->\nOld report' },
        { id: 300, body: 'Another comment' },
      ],
    } as any);
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.updateComment.mockResolvedValue({
      data: { id: 200 },
    } as any);

    const report = '<!-- kover-coverage-report -->\n## New Coverage Report';
    await postCoverageComment('test-token', report);

    expect(core.setSecret).toHaveBeenCalledWith('test-token');
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
    await postCoverageComment('', 'report');

    expect(core.info).toHaveBeenCalledWith(
      'No GitHub token provided. Skipping PR comment posting.'
    );
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

    await postCoverageComment('test-token', 'report');

    expect(core.info).toHaveBeenCalledWith(
      'Not running in a pull request context. Skipping PR comment.'
    );
    expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
  });

  it('should handle API errors without throwing', async () => {
    mockOctokit.rest.issues.listComments.mockRejectedValue(new Error('API Error'));

    const report = '<!-- kover-coverage-report -->\n## Coverage Report';
    await expect(postCoverageComment('test-token', report)).resolves.not.toThrow();

    expect(core.warning).toHaveBeenCalledWith('Failed to post coverage comment: API Error');
  });

  it('should handle rate limit errors gracefully', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    mockOctokit.rest.issues.listComments.mockRejectedValue(rateLimitError);

    await postCoverageComment('test-token', 'report');

    expect(core.warning).toHaveBeenCalledWith(
      'Failed to post coverage comment: Rate limit exceeded'
    );
  });

  it('should mask token in logs', async () => {
    const token = 'ghp_secret_token_12345';
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] } as any);
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } } as any);

    await postCoverageComment(token, 'report');

    expect(core.setSecret).toHaveBeenCalledWith(token);
  });

  it('should handle create comment failure', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] } as any);
    mockOctokit.rest.issues.createComment.mockRejectedValue(new Error('Create failed'));

    await expect(postCoverageComment('test-token', 'report')).resolves.not.toThrow();

    expect(core.warning).toHaveBeenCalledWith('Failed to post coverage comment: Create failed');
  });

  it('should handle update comment failure', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock response type casting
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 200, body: '<!-- kover-coverage-report -->\nOld' }],
    } as any);
    mockOctokit.rest.issues.updateComment.mockRejectedValue(new Error('Update failed'));

    await expect(postCoverageComment('test-token', 'report')).resolves.not.toThrow();

    expect(core.warning).toHaveBeenCalledWith('Failed to post coverage comment: Update failed');
  });
});
