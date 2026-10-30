import { defineConfig, devices } from '@playwright/test'
import { execSync } from 'child_process'

// Build the app before running e2e tests
try {
  execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() })
} catch {
  // Build may have already been done
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  },
  projects: [
    {
      name: 'electron',
      use: devices['Desktop Chrome'],
    }
  ]
})
