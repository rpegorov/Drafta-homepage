import { defineConfig } from 'vitest/config';

// Static checks read dist/, so `npm run build` runs before `npm test` (CI does both).
// Script tests build their own jsdom page per test (tests/helpers/browser.mjs),
// hence the node environment here.
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.mjs'],
    environment: 'node',
    testTimeout: 20000,
  },
});
