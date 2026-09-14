import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/vscode-mock.ts'],
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
  },
});
