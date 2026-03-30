import { defineConfig } from 'vitest/config';

export const baseConfig = defineConfig({
  test: {
    passWithNoTests: true,
  },
});
