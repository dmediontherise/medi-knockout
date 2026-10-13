import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const localLibDir = join(homedir(), '.local', 'pw-libs', 'usr', 'lib', 'x86_64-linux-gnu');
const browserEnv = existsSync(localLibDir)
  ? {
      LD_LIBRARY_PATH: [localLibDir, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(':'),
    }
  : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/medi-knockout/',
    trace: 'off',
    video: 'off',
    launchOptions: browserEnv ? { env: browserEnv } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/medi-knockout/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
