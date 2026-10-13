import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '.relay/**',
      'dist/**',
      'node_modules/**',
      'tests/e2e/**',
    ],
  },
});
