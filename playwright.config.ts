import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
  },
  webServer: {
    command: 'node /home/tolea/.cache/node/corepack/npm/12.2.0/bin/npm-cli.js run preview',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.disabled': false,
            'webgl.force-enabled': true,
            'layers.acceleration.force-enabled': true,
            'gfx.webrender.all': true,
          },
        },
      },
    },
  ],
});
