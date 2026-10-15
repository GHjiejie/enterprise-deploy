import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/profiles/**/*.test.ts',
      'tests/console/**/*.test.ts',
      'tests/delivery/**/*.test.ts',
    ],
    environment: 'node',
  },
});
