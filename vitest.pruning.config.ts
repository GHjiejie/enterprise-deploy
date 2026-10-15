import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/pruning/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
