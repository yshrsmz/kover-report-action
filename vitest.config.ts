import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude lib/ and dist/ directories from test discovery
    exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', '**/__fixtures__/**'],
    // Include only src and __tests__ directories
    include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/lib/**',
        '**/__fixtures__/**',
        '**/__tests__/**',
        '**/vitest.config.ts',
      ],
    },
  },
});
