import { defineConfig, devices } from '@playwright/test'

const phone = { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } }

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // the local database serves one connection at a time, so a full parallel run is slower than one test
  expect: { timeout: 10_000 },
  // a device that has seen the intro already; tests/e2e/intro.spec.ts starts from a fresh one
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', storageState: 'tests/e2e/intro-seen.json' },
  projects: [
    { name: 'phone', use: phone, testIgnore: /offline\.spec\.ts/ },
    { name: 'phone-reduced-motion', use: { ...phone, contextOptions: { reducedMotion: 'reduce' } }, testIgnore: /offline\.spec\.ts/ },
    // the service worker only exists in the production build, so offline runs against `vite preview`
    { name: 'offline', use: { ...phone, baseURL: 'http://localhost:4173' }, testMatch: /offline\.spec\.ts/ },
  ],
  webServer: [
    { command: 'npm run db:local', port: 5432, reuseExistingServer: true },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
    { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
  ],
})
