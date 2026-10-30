import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { spawn } from 'child_process'

const APP_PATH = join(process.cwd(), '.electron', 'main', 'index.js')

test.describe('Chess Desktop E2E', () => {
  test('launch, navigate to pages', async ({ page }) => {
    // Launch Electron app
    const electronProcess = spawn('electron', [APP_PATH], {
      stdio: 'pipe'
    })

    try {
      // Navigate to games page
      await page.goto('/games')
      await expect(page.locator('h1')).toContainText('Games')

      // Navigate to statistics
      await page.goto('/statistics')
      await expect(page.locator('h1')).toContainText('Statistics')

      // Navigate to settings
      await page.goto('/settings')
      await expect(page.locator('h1')).toContainText('Settings')

      // Navigate back to home
      await page.goto('/')
      await expect(page.locator('h1')).toContainText('Dashboard')
    } finally {
      try {
        electronProcess.kill()
      } catch {
        // Process may already be dead
      }
    }
  })
})
