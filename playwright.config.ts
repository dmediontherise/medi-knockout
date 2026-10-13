import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const localLibDir = join(homedir(), '.local', 'pw-libs', 'usr', 'lib', 'x86_64-linux-gnu');
const browserEnv = existsSync(localLibDir)
  ? {
      LD_LIBRARY_PATH: [localLibDir, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(':'),
    }
  : undefined;

// Requirement 3b: Derive port from workspace cwd or PW_PORT env var, avoid shared port
const cwdHash = createHash('md5').update(process.cwd()).digest('hex');
const defaultPort = 4173 + (parseInt(cwdHash.slice(0, 8), 16) % 500);
const port = process.env.PW_PORT ? parseInt(process.env.PW_PORT, 10) : defaultPort;
const baseURL = `http://127.0.0.1:${port}/medi-knockout/`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
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
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
