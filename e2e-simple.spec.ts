import { test, expect } from '@playwright/test'

test('VJ Application Basic Test', async ({ page }) => {
  // Navigate to home page
  await page.goto('/')
  
  // Check title
  await expect(page).toHaveTitle(/v1z3r/)
  
  // Check welcome screen
  await expect(page.locator('h1')).toContainText('v1z3r')
  
  // Click launch button
  await page.click('button:has-text("Launch VJ Application")')
  
  // Wait for VJ app to load
  await page.waitForSelector('[data-testid="vj-application"]', { timeout: 10000 })
  
  // Check status bar
  await expect(page.locator('.status-bar')).toBeVisible()
  
  // Check rendering status
  await expect(page.locator('[data-testid="rendering-status"]')).toContainText('Rendering:')
})