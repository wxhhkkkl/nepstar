import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: 'chrome',
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: '/Users/leelee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js --host 127.0.0.1',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
