import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import type { InlineConfig } from 'vitest/node';

const test: InlineConfig = {
  include: ['tests/architecture/**/*.test.ts', 'tests/console/**/*.test.ts'],
  environment: 'node',
  testTimeout: 60000,
  hookTimeout: 60000,
  fileParallelism: false,
};

export default defineConfig({
  plugins: [vue()],
  ...{ test },
});
