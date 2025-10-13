import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Load a fixture file from the __fixtures__ directory
 * @param relativePath Path relative to __fixtures__ directory
 * @returns Content of the fixture file
 */
export async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = join(__dirname, '../../__fixtures__', relativePath);
  return readFile(fixturePath, 'utf-8');
}
