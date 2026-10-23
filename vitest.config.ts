import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/architecture/**/*.test.ts', 'tests/console/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
