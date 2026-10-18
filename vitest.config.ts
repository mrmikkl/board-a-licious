import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['fake-indexeddb/auto'],
        },
      },
      {
        // Worker code runs in Node with injected fakes (fetch, cache, PGlite) instead of workerd:
        // handlers only use web-standard APIs, so this keeps the tests fast and simple
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
