import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against the real stack: capsule-api built and run on
 * port 3100, this app on 5174, plus the Postgres, SeaweedFS and Ollama that
 * `npm run setup` in capsule-api starts. Not part of `npm run check`: CI has no
 * stack. The storage bucket must allow uploads from http://localhost:5174.
 */
const API = 'http://localhost:3100';
const WEB = 'http://localhost:5174';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Model calls are slow when a model is cold.
  timeout: 300_000,
  expect: { timeout: 120_000 },
  workers: 1,
  reporter: 'list',
  use: { ...devices['Pixel 7'], baseURL: WEB, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run build && node dist/main',
      cwd: '../capsule-api',
      env: { PORT: '3100', CORS_ORIGINS: WEB },
      url: `${API}/v1/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      env: { VITE_API_URL: API },
      url: WEB,
      reuseExistingServer: false,
    },
  ],
});
