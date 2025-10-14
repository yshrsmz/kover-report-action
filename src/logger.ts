/**
 * Logger interface for action output
 *
 * Abstracts logging operations to enable testing and support
 * multiple output channels beyond GitHub Actions.
 *
 * Note: This interface is intentionally pure (side-effect free).
 * Workflow control (like marking an action as failed) should be
 * handled by throwing typed errors that the entrypoint catches,
 * not by mixing logging with control flow.
 */
export interface Logger {
  /**
   * Log an informational message
   */
  info(message: string): void;

  /**
   * Log a debug message (only visible when debug mode enabled)
   */
  debug(message: string): void;

  /**
   * Log a warning message
   */
  warn(message: string): void;

  /**
   * Log an error message
   */
  error(message: string): void;
}

/**
 * Logger implementation that forwards to @actions/core
 *
 * This adapter allows the action to use the Logger interface
 * while delegating to the GitHub Actions core library.
 */
export class ActionsLogger implements Logger {
  constructor(private readonly core: typeof import('@actions/core')) {}

  info(message: string): void {
    this.core.info(message);
  }

  debug(message: string): void {
    this.core.debug(message);
  }

  warn(message: string): void {
    this.core.warning(message);
  }

  error(message: string): void {
    this.core.error(message);
  }
}

/**
 * Factory function to create a logger instance
 *
 * @param core - The @actions/core module
 * @returns Logger instance that forwards to GitHub Actions core
 */
export function createLogger(core: typeof import('@actions/core')): Logger {
  return new ActionsLogger(core);
}

/**
 * Spy logger for testing
 *
 * Records all logging calls for assertion in tests.
 * Useful for verifying that components log expected messages
 * without actually writing to console or GitHub Actions.
 */
export class SpyLogger implements Logger {
  readonly calls = {
    info: [] as string[],
    debug: [] as string[],
    warn: [] as string[],
    error: [] as string[],
  };

  info(message: string): void {
    this.calls.info.push(message);
  }

  debug(message: string): void {
    this.calls.debug.push(message);
  }

  warn(message: string): void {
    this.calls.warn.push(message);
  }

  error(message: string): void {
    this.calls.error.push(message);
  }

  /**
   * Check if any message matching the pattern was logged
   */
  hasMessage(level: keyof SpyLogger['calls'], pattern: string | RegExp): boolean {
    const messages = this.calls[level];
    if (typeof pattern === 'string') {
      return messages.some((msg) => msg.includes(pattern));
    }
    // Clone regex to avoid mutation of caller's regex (global/sticky flags affect lastIndex)
    const regex = new RegExp(pattern.source, pattern.flags);
    return messages.some((msg) => regex.test(msg));
  }

  /**
   * Get count of messages at given level
   */
  getMessageCount(level: keyof SpyLogger['calls']): number {
    return this.calls[level].length;
  }

  /**
   * Clear all recorded calls
   */
  clear(): void {
    this.calls.info = [];
    this.calls.debug = [];
    this.calls.warn = [];
    this.calls.error = [];
  }

  /**
   * Get all messages across all levels
   */
  getAllMessages(): string[] {
    return [...this.calls.info, ...this.calls.debug, ...this.calls.warn, ...this.calls.error];
  }
}
