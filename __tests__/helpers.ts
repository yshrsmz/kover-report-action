import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Load a fixture file from the __fixtures__ directory
 * @param relativePath - Path relative to __fixtures__/ directory
 * @returns Content of the fixture file as a string
 * @example
 * const xml = await loadFixture('kover-reports/valid-partial-coverage.xml');
 * const gradleOutput = await loadFixture('gradle-output/multi-module.txt');
 */
export async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = join(__dirname, '../__fixtures__', relativePath);
  return readFile(fixturePath, 'utf-8');
}

/**
 * Load a fixture file and parse it as JSON
 * @param relativePath - Path relative to __fixtures__/ directory
 * @returns Parsed JSON object
 * @example
 * const thresholds = await loadJsonFixture('thresholds/complex.json');
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic default for flexible test fixture loading
export async function loadJsonFixture<T = any>(relativePath: string): Promise<T> {
  const content = await loadFixture(relativePath);
  return JSON.parse(content);
}

/**
 * Helper to assert that a function throws an error with a specific message
 * @param fn - Function that should throw
 * @param expectedMessage - Expected error message (partial match)
 * @example
 * expectError(() => parseInvalid(), 'Invalid format');
 */
// biome-ignore lint/suspicious/noExplicitAny: Test helper accepts any return type from test functions
export function expectError(fn: () => any, expectedMessage?: string): void {
  let threw = false;
  let error: Error | undefined;

  try {
    fn();
  } catch (e) {
    threw = true;
    error = e as Error;
  }

  if (!threw) {
    throw new Error('Expected function to throw an error, but it did not');
  }

  if (expectedMessage && error && !error.message.includes(expectedMessage)) {
    throw new Error(
      `Expected error message to include "${expectedMessage}", but got: "${error.message}"`
    );
  }
}

/**
 * Helper to assert that an async function throws an error with a specific message
 * @param fn - Async function that should throw
 * @param expectedMessage - Expected error message (partial match)
 * @example
 * await expectAsyncError(async () => await parseInvalid(), 'Invalid format');
 */
// biome-ignore lint/suspicious/noExplicitAny: Test helper accepts any return type from async test functions
export async function expectAsyncError(
  fn: () => Promise<any>,
  expectedMessage?: string
): Promise<void> {
  let threw = false;
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    threw = true;
    error = e as Error;
  }

  if (!threw) {
    throw new Error('Expected function to throw an error, but it did not');
  }

  if (expectedMessage && error && !error.message.includes(expectedMessage)) {
    throw new Error(
      `Expected error message to include "${expectedMessage}", but got: "${error.message}"`
    );
  }
}
