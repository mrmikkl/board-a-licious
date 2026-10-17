import { defineConfig, devices } from '@playwright/test'

const phone = { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } }

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // a device that has seen the intro already; tests/e2e/intro.spec.ts starts from a fresh one
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', storageState: 'tests/e2e/intro-seen.json' },
  projects: [
    { name: 'phone', use: phone },
    { name: 'phone-reduced-motion', use: { ...phone, contextOptions: { reducedMotion: 'reduce' } } },
  ],
  webServer: [
    { command: 'npm run db:local', port: 5432, reuseExistingServer: true },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
})
