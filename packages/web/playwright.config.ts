import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'fs'

// On this dev machine Chromium lives at a fixed path.
// In CI (and anywhere that path doesn't exist) Playwright uses its own browser.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const localChromium = existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined

function chromiumProject(name: string, device: ReturnType<typeof devices[string]>) {
  return {
    name,
    use: {
      ...device,
      ...(localChromium ? { launchOptions: { executablePath: localChromium } } : {}),
    },
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    chromiumProject('chromium', devices['Desktop Chrome']),
    chromiumProject('mobile-chrome', devices['Pixel 5']),
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
