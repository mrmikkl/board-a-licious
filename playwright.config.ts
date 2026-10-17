import { defineConfig, devices } from '@playwright/test'

const phone = { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } }

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: phone },
    { name: 'phone-reduced-motion', use: { ...phone, contextOptions: { reducedMotion: 'reduce' } } },
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
})
