// End-to-end tests: launch the real Electron app (tests/*.spec.js). `npm test`.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  workers: 1, // every test launches its own Electron instance
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
