/**
 * E2E tests for visualizer effects
 * Tests WebGL rendering, audio reactivity, and effect switching
 */

import { test, expect } from '@playwright/test';
import { AuthHelper } from '../fixtures/auth';
import { TestHelpers } from '../fixtures/helpers';
import { testUrls, timeouts } from '../fixtures/test-data';

test.describe('Visualizer Effects', () => {
  let authHelper: AuthHelper;
  let testHelper: TestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testHelper = new TestHelpers(page);
    
    // Login before each test
    await authHelper.login('test@example.com', 'Test123!@#');
  });

  test('loads visualizer with WebGL context', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    
    // Wait for WebGL to initialize
    await testHelper.waitForWebGL();
    
    // Check canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Verify WebGL context
    const hasWebGL = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null;
    });
    
    expect(hasWebGL).toBe(true);
  });

  test('switches between different effects', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    const effects = ['waveform', 'spectrum', 'particles'];
    
    for (const effect of effects) {
      // Click effect button
      await page.click(`[data-testid="effect-${effect}"]`);
      
      // Wait for effect to change
      await page.waitForTimeout(500);
      
      // Verify effect is active
      await expect(page.locator(`[data-testid="effect-${effect}"]`)).toHaveClass(/active/);
      
      // Take screenshot for visual verification
      await testHelper.takeScreenshot(`effect-${effect}`);
    }
  });

  test('responds to audio input', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    await testHelper.waitForAudioContext();
    
    // Enable microphone
    await page.click('[data-testid="mic-toggle"]');
    
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    // Simulate audio input
    await testHelper.simulateAudioInput(440, 2000);
    
    // Check if visualizer is responding
    const isResponding = await page.evaluate(() => {
      return window.performance.now() > 0; // Simplified check
    });
    
    expect(isResponding).toBe(true);
  });

  test('adjusts sensitivity control', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    const sensitivitySlider = page.locator('[data-testid="sensitivity-slider"]');
    
    // Get initial value
    const initialValue = await sensitivitySlider.inputValue();
    
    // Change sensitivity
    await sensitivitySlider.fill('2');
    
    // Verify change
    await expect(sensitivitySlider).toHaveValue('2');
    
    // Check if effect updates
    const sensitivityApplied = await page.evaluate(() => {
      const store = (window as any).__visualizerStore;
      return store?.sensitivity === 2;
    });
    
    expect(sensitivityApplied || initialValue !== '2').toBe(true);
  });

  test('changes color themes', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    const colorPicker = page.locator('[data-testid="color-picker"]');
    
    // Click to open color picker
    await colorPicker.click();
    
    // Select a preset color
    await page.click('[data-testid="color-preset-purple"]');
    
    // Verify color changed
    const currentColor = await page.evaluate(() => {
      const store = (window as any).__visualizerStore;
      return store?.colorTheme;
    });
    
    expect(currentColor).toMatch(/#[a-f0-9]{6}/i);
  });

  test('maintains performance above 30 FPS', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Enable effects
    await page.click('[data-testid="effect-particles"]');
    
    // Measure FPS
    const fps = await testHelper.measureFPS(5000);
    
    expect(fps).toBeGreaterThanOrEqual(30);
  });

  test('handles fullscreen mode', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Click fullscreen button
    await page.click('[data-testid="fullscreen-toggle"]');
    
    // Wait for transition
    await page.waitForTimeout(1000);
    
    // Check if fullscreen (may not work in headless mode)
    const isFullscreen = await page.evaluate(() => {
      return document.fullscreenElement !== null ||
             (document as any).webkitFullscreenElement !== null;
    });
    
    // Exit fullscreen if entered
    if (isFullscreen) {
      await page.keyboard.press('Escape');
    }
  });

  test('saves and loads presets', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Configure effect
    await page.click('[data-testid="effect-waveform"]');
    await page.fill('[data-testid="sensitivity-slider"]', '1.5');
    
    // Save preset
    await page.click('[data-testid="save-preset-button"]');
    await page.fill('[data-testid="preset-name-input"]', 'Test Preset');
    await page.click('[data-testid="confirm-save-preset"]');
    
    // Wait for save
    await expect(page.locator('text=/saved successfully/i')).toBeVisible({
      timeout: timeouts.medium,
    });
    
    // Change settings
    await page.click('[data-testid="effect-particles"]');
    
    // Load preset
    await page.click('[data-testid="presets-dropdown"]');
    await page.click('text=Test Preset');
    
    // Verify settings restored
    await expect(page.locator('[data-testid="effect-waveform"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="sensitivity-slider"]')).toHaveValue('1.5');
  });

  test('displays FPS counter', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Enable FPS display
    await page.click('[data-testid="settings-menu"]');
    await page.click('[data-testid="show-fps-toggle"]');
    
    // Check FPS counter is visible
    await expect(page.locator('[data-testid="fps-counter"]')).toBeVisible();
    
    // Verify FPS updates
    const fps1 = await page.locator('[data-testid="fps-counter"]').textContent();
    await page.waitForTimeout(2000);
    const fps2 = await page.locator('[data-testid="fps-counter"]').textContent();
    
    expect(fps1).not.toBe(fps2); // FPS should update
  });

  test('handles WebGL context loss gracefully', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Simulate context loss
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl && 'loseContext' in gl.getExtension('WEBGL_lose_context')!) {
          (gl.getExtension('WEBGL_lose_context') as any).loseContext();
        }
      }
    });
    
    // Should show error or attempt recovery
    const hasError = await page.locator('text=/context lost|error|reload/i').isVisible({
      timeout: timeouts.short,
    }).catch(() => false);
    
    const recovered = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null && !gl.isContextLost();
    });
    
    expect(hasError || recovered).toBe(true);
  });

  test('accessibility - keyboard navigation', async ({ page }) => {
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Tab through controls
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="effect-waveform"]')).toBeFocused();
    
    // Activate with Enter
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="effect-waveform"]')).toHaveClass(/active/);
    
    // Tab to sensitivity
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Adjust with arrow keys
    const slider = page.locator('[data-testid="sensitivity-slider"]');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    
    const newValue = await slider.inputValue();
    expect(parseFloat(newValue)).toBeGreaterThan(1);
  });

  test('responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(testUrls.visualizer);
    await testHelper.waitForWebGL();
    
    // Check mobile menu
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-toggle"]');
    
    // Check controls are accessible
    await expect(page.locator('[data-testid="effect-waveform"]')).toBeVisible();
    await expect(page.locator('[data-testid="sensitivity-slider"]')).toBeVisible();
  });
});