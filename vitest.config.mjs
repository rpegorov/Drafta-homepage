import { defineConfig } from 'vitest/config';

// Static checks read dist/: `npm run build` builds it and then runs these tests,
// so Workers Builds never deploys a site with a red test.
// Script tests build their own jsdom page per test (tests/helpers/browser.mjs),
// hence the node environment here.
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.mjs'],
    environment: 'node',
    testTimeout: 20000,
  },
});
