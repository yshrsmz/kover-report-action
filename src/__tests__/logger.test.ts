import { describe, expect, test, vi } from 'vitest';
import { ActionsLogger, createLogger, SpyLogger } from '../common/logger';

describe('ActionsLogger', () => {
  test('forwards info calls to core', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    const logger = new ActionsLogger(mockCore as unknown as typeof import('@actions/core'));

    logger.info('test info message');

    expect(mockCore.info).toHaveBeenCalledWith('test info message');
    expect(mockCore.info).toHaveBeenCalledTimes(1);
  });

  test('forwards debug calls to core', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    const logger = new ActionsLogger(mockCore as unknown as typeof import('@actions/core'));

    logger.debug('test debug message');

    expect(mockCore.debug).toHaveBeenCalledWith('test debug message');
    expect(mockCore.debug).toHaveBeenCalledTimes(1);
  });

  test('forwards warn calls to core.warning', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    const logger = new ActionsLogger(mockCore as unknown as typeof import('@actions/core'));

    logger.warn('test warning message');

    expect(mockCore.warning).toHaveBeenCalledWith('test warning message');
    expect(mockCore.warning).toHaveBeenCalledTimes(1);
  });

  test('forwards error calls to core', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    const logger = new ActionsLogger(mockCore as unknown as typeof import('@actions/core'));

    logger.error('test error message');

    expect(mockCore.error).toHaveBeenCalledWith('test error message');
    expect(mockCore.error).toHaveBeenCalledTimes(1);
  });

  test('handles multiple consecutive calls', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    const logger = new ActionsLogger(mockCore as unknown as typeof import('@actions/core'));

    logger.info('message 1');
    logger.info('message 2');
    logger.debug('debug 1');
    logger.warn('warning 1');

    expect(mockCore.info).toHaveBeenCalledTimes(2);
    expect(mockCore.debug).toHaveBeenCalledTimes(1);
    expect(mockCore.warning).toHaveBeenCalledTimes(1);
  });
});

describe('createLogger', () => {
  test('returns ActionsLogger instance', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };

    const logger = createLogger(mockCore as unknown as typeof import('@actions/core'));

    expect(logger).toBeInstanceOf(ActionsLogger);
  });

  test('created logger works correctly', () => {
    const mockCore = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };

    const logger = createLogger(mockCore as unknown as typeof import('@actions/core'));
    logger.info('test message');

    expect(mockCore.info).toHaveBeenCalledWith('test message');
  });
});

describe('SpyLogger', () => {
  test('records info calls', () => {
    const logger = new SpyLogger();

    logger.info('info message 1');
    logger.info('info message 2');

    expect(logger.calls.info).toEqual(['info message 1', 'info message 2']);
  });

  test('records debug calls', () => {
    const logger = new SpyLogger();

    logger.debug('debug message');

    expect(logger.calls.debug).toEqual(['debug message']);
  });

  test('records warn calls', () => {
    const logger = new SpyLogger();

    logger.warn('warning message');

    expect(logger.calls.warn).toEqual(['warning message']);
  });

  test('records error calls', () => {
    const logger = new SpyLogger();

    logger.error('error message');

    expect(logger.calls.error).toEqual(['error message']);
  });

  test('records all calls independently', () => {
    const logger = new SpyLogger();

    logger.info('info1');
    logger.debug('debug1');
    logger.warn('warn1');
    logger.error('error1');

    expect(logger.calls.info).toEqual(['info1']);
    expect(logger.calls.debug).toEqual(['debug1']);
    expect(logger.calls.warn).toEqual(['warn1']);
    expect(logger.calls.error).toEqual(['error1']);
  });

  test('hasMessage returns true for matching string', () => {
    const logger = new SpyLogger();

    logger.info('Coverage is 85%');
    logger.warn('Module :core failed');

    expect(logger.hasMessage('info', 'Coverage')).toBe(true);
    expect(logger.hasMessage('warn', ':core')).toBe(true);
    expect(logger.hasMessage('info', 'nonexistent')).toBe(false);
  });

  test('hasMessage returns true for matching regex', () => {
    const logger = new SpyLogger();

    logger.info('Coverage is 85%');
    logger.warn('Module :core failed');

    expect(logger.hasMessage('info', /Coverage is \d+%/)).toBe(true);
    expect(logger.hasMessage('warn', /Module :[\w]+ failed/)).toBe(true);
    expect(logger.hasMessage('info', /\d{3}/)).toBe(false);
  });

  test('hasMessage does not mutate global regex', () => {
    const logger = new SpyLogger();

    logger.info('test1');
    logger.info('test2');
    logger.info('test3');

    // Reuse the same global regex multiple times
    const globalRegex = /test\d/g;

    // Without the fix, the second call would fail because lastIndex was mutated
    expect(logger.hasMessage('info', globalRegex)).toBe(true);
    expect(logger.hasMessage('info', globalRegex)).toBe(true);
    expect(logger.hasMessage('info', globalRegex)).toBe(true);

    // Verify the original regex wasn't mutated
    expect(globalRegex.lastIndex).toBe(0);
  });

  test('getMessageCount returns correct counts', () => {
    const logger = new SpyLogger();

    logger.info('message 1');
    logger.info('message 2');
    logger.info('message 3');
    logger.warn('warning');

    expect(logger.getMessageCount('info')).toBe(3);
    expect(logger.getMessageCount('warn')).toBe(1);
    expect(logger.getMessageCount('debug')).toBe(0);
    expect(logger.getMessageCount('error')).toBe(0);
  });

  test('clear removes all recorded messages', () => {
    const logger = new SpyLogger();

    logger.info('info1');
    logger.debug('debug1');
    logger.warn('warn1');
    logger.error('error1');

    logger.clear();

    expect(logger.calls.info).toEqual([]);
    expect(logger.calls.debug).toEqual([]);
    expect(logger.calls.warn).toEqual([]);
    expect(logger.calls.error).toEqual([]);
  });

  test('getAllMessages returns messages from all levels', () => {
    const logger = new SpyLogger();

    logger.info('info1');
    logger.debug('debug1');
    logger.warn('warn1');
    logger.error('error1');

    const allMessages = logger.getAllMessages();

    expect(allMessages).toHaveLength(4);
    expect(allMessages).toContain('info1');
    expect(allMessages).toContain('debug1');
    expect(allMessages).toContain('warn1');
    expect(allMessages).toContain('error1');
  });

  test('getAllMessages maintains order of insertion', () => {
    const logger = new SpyLogger();

    logger.info('first');
    logger.warn('second');
    logger.info('third');
    logger.error('fourth');

    const allMessages = logger.getAllMessages();

    expect(allMessages).toEqual(['first', 'third', 'second', 'fourth']);
  });

  test('supports reuse after clear', () => {
    const logger = new SpyLogger();

    logger.info('first batch');
    logger.clear();
    logger.info('second batch');

    expect(logger.calls.info).toEqual(['second batch']);
    expect(logger.getMessageCount('info')).toBe(1);
  });
});
