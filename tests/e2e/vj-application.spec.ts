/**
 * End-to-End Tests for VJ Application
 * 
 * Tests the complete VJ workflow from UI interaction to module integration:
 * - Visual rendering initialization
 * - Parameter control interface
 * - Real-time sync capabilities  
 * - Preset management workflow
 */

import { test, expect } from '@playwright/test'

test.describe('VJ Application E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main application page
    await page.goto('/')
    
    // Click launch button to start VJ application
    await page.click('button:has-text("Launch VJ Application")')
    
    // Wait for the VJ application to initialize
    await page.waitForSelector('[data-testid="vj-application"]', { timeout: 15000 })
  })

  test('should initialize VJ application successfully', async ({ page }) => {
    // Check that the status bar shows initialization
    const statusBar = page.locator('.status-bar')
    await expect(statusBar).toBeVisible()
    
    // Verify rendering status
    const renderingStatus = page.locator('[data-testid="rendering-status"]')
    await expect(renderingStatus).toContainText('Rendering: ✓')
    
    // Check that the canvas is present and visible
    const canvas = page.locator('[data-testid="visual-canvas"]')
    await expect(canvas).toBeVisible()
    
    // Verify canvas dimensions
    const canvasElement = await canvas.elementHandle()
    const width = await canvasElement?.getAttribute('width')
    const height = await canvasElement?.getAttribute('height')
    expect(width).toBe('800')
    expect(height).toBe('600')
  })

  test('should display performance monitor', async ({ page }) => {
    // Wait for initialization to complete
    await page.waitForTimeout(2000)
    
    // Check performance monitor
    const performanceMonitor = page.locator('[data-testid="performance-monitor"]')
    await expect(performanceMonitor).toBeVisible()
    
    // Verify FPS display
    await expect(performanceMonitor.locator('div:has-text("FPS:")')).toBeVisible()
    await expect(performanceMonitor.locator('div:has-text("Frame Time:")')).toBeVisible()
    await expect(performanceMonitor.locator('div:has-text("Memory:")')).toBeVisible()
  })

  test('should render control panel interface', async ({ page }) => {
    // Wait for controller to load
    await page.waitForSelector('[data-testid="control-panel"]', { timeout: 5000 })
    
    const controlPanel = page.locator('[data-testid="control-panel"]')
    await expect(controlPanel).toBeVisible()
    
    // Check for main control tabs
    await expect(page.locator('role=tab[name*="Parameters"]')).toBeVisible()
    await expect(page.locator('role=tab[name*="Layers"]')).toBeVisible()
    await expect(page.locator('role=tab[name*="Presets"]')).toBeVisible()
  })

  test('should interact with parameter controls', async ({ page }) => {
    // Wait for control panel
    await page.waitForSelector('[data-testid="control-panel"]')
    
    // Ensure we're on parameters tab
    const parametersTab = page.locator('role=tab[name*="Parameters"]')
    await parametersTab.click()
    
    // Find and interact with sensitivity slider
    const sensitivitySlider = page.locator('role=slider[name*="sensitivity" i]')
    await expect(sensitivitySlider).toBeVisible()
    
    // Change slider value
    await sensitivitySlider.fill('0.8')
    
    // Verify the change was applied (visual feedback or state change)
    await expect(sensitivitySlider).toHaveValue('0.8')
    
    // Test speed control
    const speedSlider = page.locator('role=slider[name*="speed" i]')
    if (await speedSlider.isVisible()) {
      await speedSlider.fill('1.5')
      await expect(speedSlider).toHaveValue('1.5')
    }
  })

  test('should manage layers', async ({ page }) => {
    // Wait for control panel
    await page.waitForSelector('[data-testid="control-panel"]')
    
    // Switch to layers tab
    const layersTab = page.locator('role=tab[name*="Layers"]')
    await layersTab.click()
    
    // Add a new layer
    const addLayerButton = page.locator('role=button[name*="Add Layer" i]')
    if (await addLayerButton.isVisible()) {
      await addLayerButton.click()
      
      // Verify layer was added (check for layer list or feedback)
      await page.waitForTimeout(1000)
      
      // Look for layer controls or confirmation
      const layerControls = page.locator('[class*="layer"]')
      if (await layerControls.count() > 0) {
        await expect(layerControls.first()).toBeVisible()
      }
    }
  })

  test('should handle preset management', async ({ page }) => {
    // Wait for control panel
    await page.waitForSelector('[data-testid="control-panel"]')
    
    // Switch to presets tab
    const presetsTab = page.locator('role=tab[name*="Presets"]')
    await presetsTab.click()
    
    // Test save preset functionality
    const saveButton = page.locator('role=button[name*="Save Current" i]')
    if (await saveButton.isVisible()) {
      await saveButton.click()
      
      // Look for save confirmation or preset list update
      await page.waitForTimeout(1000)
    }
    
    // Test load preset functionality (if presets exist)
    const presetItems = page.locator('[class*="preset-item"], [data-testid*="preset"]')
    const presetCount = await presetItems.count()
    
    if (presetCount > 0) {
      // Click first preset to load it
      await presetItems.first().click()
      await page.waitForTimeout(1000)
    }
  })

  test('should show sync status when configured', async ({ page }) => {
    // Check sync status in status bar
    const syncStatus = page.locator('[data-testid="sync-status"]')
    await expect(syncStatus).toBeVisible()
    
    // Since we're not running a real sync server, it should show disconnected
    await expect(syncStatus).toContainText('Sync: ✗')
  })

  test('should show storage status when configured', async ({ page }) => {
    // Check storage status in status bar
    const storageStatus = page.locator('[data-testid="storage-status"]')
    await expect(storageStatus).toBeVisible()
    
    // Storage availability depends on configuration
    // Just verify the status is displayed
  })

  test('should be responsive to window resize', async ({ page }) => {
    // Get initial canvas size
    const canvas = page.locator('[data-testid="visual-canvas"]')
    const initialBox = await canvas.boundingBox()
    
    // Resize viewport
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.waitForTimeout(500)
    
    // Check that canvas is still visible and responsive
    await expect(canvas).toBeVisible()
    const newBox = await canvas.boundingBox()
    
    // Canvas should adapt to new viewport (this depends on CSS implementation)
    expect(newBox?.width).toBeGreaterThan(0)
    expect(newBox?.height).toBeGreaterThan(0)
  })

  test('should handle errors gracefully', async ({ page }) => {
    // Monitor console for errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    // Try to trigger potential error scenarios
    // Invalid parameter values
    const sensitivitySlider = page.locator('role=slider[name*="sensitivity" i]')
    if (await sensitivitySlider.isVisible()) {
      await sensitivitySlider.fill('999') // Invalid high value
      await page.waitForTimeout(500)
      
      // App should still be functional
      await expect(page.locator('[data-testid="vj-application"]')).toBeVisible()
    }
    
    // Check that no critical errors occurred
    const criticalErrors = errors.filter(error => 
      error.includes('TypeError') || 
      error.includes('ReferenceError') ||
      error.includes('Cannot read properties')
    )
    
    expect(criticalErrors.length).toBe(0)
  })

  test('should maintain performance under load', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(2000)
    
    // Rapid parameter changes to test performance
    const sensitivitySlider = page.locator('role=slider[name*="sensitivity" i]')
    
    if (await sensitivitySlider.isVisible()) {
      const values = ['0.2', '0.5', '0.8', '1.0', '0.3', '0.7', '0.9']
      
      for (const value of values) {
        await sensitivitySlider.fill(value)
        await page.waitForTimeout(100) // Quick succession
      }
    }
    
    // Verify app is still responsive
    await expect(page.locator('[data-testid="vj-application"]')).toBeVisible()
    
    // Check performance monitor still shows reasonable values
    const performanceMonitor = page.locator('[data-testid="performance-monitor"]')
    if (await performanceMonitor.isVisible()) {
      const fpsText = await performanceMonitor.locator('div:has-text("FPS:")').textContent()
      
      // Extract FPS value (basic check)
      if (fpsText) {
        const fps = parseFloat(fpsText.replace('FPS: ', ''))
        if (!isNaN(fps)) {
          expect(fps).toBeGreaterThan(20) // Reasonable minimum FPS
        }
      }
    }
  })
})