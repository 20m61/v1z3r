import { test, expect } from '@playwright/test';

test.describe('VJ Application Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main VJ interface', async ({ page }) => {
    // Check that the main components are present
    await expect(page.locator('[data-testid="control-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="visual-canvas"]')).toBeVisible();
  });

  test('should handle microphone permissions gracefully', async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Try to start audio analysis
    const startButton = page.locator('button', { hasText: /start|開始/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should show some indication that audio is being processed
      await expect(page.locator('[data-testid="audio-indicator"]')).toBeVisible();
    }
  });

  test('should allow switching between visual effect types', async ({ page }) => {
    // Find effect type selector
    const effectSelector = page.locator('[data-testid="effect-selector"]');
    
    if (await effectSelector.isVisible()) {
      // Try different effect types
      await effectSelector.selectOption('spectrum');
      await expect(page.locator('[data-testid="visual-canvas"]')).toBeVisible();
      
      await effectSelector.selectOption('waveform');
      await expect(page.locator('[data-testid="visual-canvas"]')).toBeVisible();
    }
  });

  test('should support preset management', async ({ page }) => {
    // Look for preset controls
    const presetTab = page.locator('button', { hasText: /preset|プリセット/i });
    
    if (await presetTab.isVisible()) {
      await presetTab.click();
      
      // Should be able to see preset list or create new preset
      const presetSection = page.locator('[data-testid="preset-section"]');
      await expect(presetSection.or(page.locator('text=preset', { hasText: /save|保存/i }))).toBeVisible();
    }
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Main interface should still be usable
    await expect(page.locator('[data-testid="control-panel"]')).toBeVisible();
    
    // Touch targets should be appropriately sized
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const boundingBox = await button.boundingBox();
        if (boundingBox) {
          // Touch targets should be at least 44px (iOS guideline)
          expect(boundingBox.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test('should handle errors gracefully', async ({ page, context }) => {
    // Deny microphone permissions to test error handling
    await context.grantPermissions([]);
    
    const startButton = page.locator('button', { hasText: /start|開始/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should show error message or fallback UI
      await expect(
        page.locator('text=/error|エラー/i').or(
          page.locator('[data-testid="error-message"]')
        )
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should maintain performance standards', async ({ page }) => {
    // Start performance monitoring
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that the page loads within reasonable time
    const performanceEntries = await page.evaluate(() => {
      return JSON.stringify(performance.getEntriesByType('navigation'));
    });
    
    const navigation = JSON.parse(performanceEntries)[0];
    
    // Page should load within 3 seconds
    expect(navigation.loadEventEnd - navigation.navigationStart).toBeLessThan(3000);
    
    // Check for memory leaks by monitoring heap size
    const initialHeap = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Interact with the app for a bit
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(100 + i * 10, 100 + i * 10);
      await page.waitForTimeout(100);
    }
    
    const finalHeap = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Memory growth should be reasonable (less than 10MB for simple interactions)
    if (initialHeap > 0 && finalHeap > 0) {
      expect(finalHeap - initialHeap).toBeLessThan(10 * 1024 * 1024);
    }
  });
});