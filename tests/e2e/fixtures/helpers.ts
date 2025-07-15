/**
 * Helper utilities for E2E tests
 * Provides common testing utilities and functions
 */

import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for WebGL context to be ready
   */
  async waitForWebGL() {
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null;
    }, { timeout: 10000 });
  }

  /**
   * Wait for audio context to be ready
   */
  async waitForAudioContext() {
    await this.page.waitForFunction(() => {
      return typeof window !== 'undefined' && 
             'AudioContext' in window && 
             document.querySelector('[data-testid="audio-analyzer"]');
    }, { timeout: 10000 });
  }

  /**
   * Take screenshot with consistent naming
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `tests/e2e/screenshots/${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  /**
   * Check FPS performance
   */
  async measureFPS(duration: number = 5000): Promise<number> {
    const fps = await this.page.evaluate((duration) => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        let lastTime = performance.now();
        const startTime = lastTime;
        
        function countFrames() {
          frameCount++;
          const currentTime = performance.now();
          
          if (currentTime - startTime >= duration) {
            const averageFPS = (frameCount * 1000) / (currentTime - startTime);
            resolve(Math.round(averageFPS));
          } else {
            requestAnimationFrame(countFrames);
          }
        }
        
        requestAnimationFrame(countFrames);
      });
    }, duration);
    
    return fps;
  }

  /**
   * Check memory usage
   */
  async getMemoryUsage(): Promise<{ usedJSHeapSize: number; totalJSHeapSize: number }> {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return { usedJSHeapSize: 0, totalJSHeapSize: 0 };
    });
  }

  /**
   * Simulate audio input
   */
  async simulateAudioInput(frequency: number = 440, duration: number = 1000) {
    await this.page.evaluate(({ freq, dur }) => {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.frequency.value = freq;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
      }, dur);
    }, { freq: frequency, dur: duration });
  }

  /**
   * Wait for element with retry
   */
  async waitForElement(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' }) {
    const element = this.page.locator(selector);
    await element.waitFor(options);
    return element;
  }

  /**
   * Check if element has animation
   */
  async hasAnimation(selector: string): Promise<boolean> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      return style.animationName !== 'none' || 
             style.transition !== 'none' ||
             element.classList.toString().includes('animate');
    }, selector);
  }

  /**
   * Get canvas pixel data for visual testing
   */
  async getCanvasData(): Promise<string> {
    return await this.page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('No canvas found');
      
      return (canvas as HTMLCanvasElement).toDataURL('image/png');
    });
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(options?: { timeout?: number }) {
    await this.page.waitForLoadState('networkidle', options);
  }

  /**
   * Mock API responses
   */
  async mockAPI(pattern: string | RegExp, response: any) {
    await this.page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Check console for errors
   */
  async checkConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to collect any errors
    await this.page.waitForTimeout(1000);
    
    return errors;
  }

  /**
   * Drag and drop helper
   */
  async dragAndDrop(sourceSelector: string, targetSelector: string) {
    const source = this.page.locator(sourceSelector);
    const target = this.page.locator(targetSelector);
    
    await source.hover();
    await this.page.mouse.down();
    await target.hover();
    await this.page.mouse.up();
  }

  /**
   * Check accessibility
   */
  async checkAccessibility(selector?: string) {
    const violations = await this.page.evaluate((sel) => {
      // Simple accessibility checks
      const element = sel ? document.querySelector(sel) : document.body;
      if (!element) return [];
      
      const issues: string[] = [];
      
      // Check for missing alt text on images
      const images = element.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        issues.push(`${images.length} images missing alt text`);
      }
      
      // Check for missing labels
      const inputs = element.querySelectorAll('input:not([aria-label]):not([id])');
      if (inputs.length > 0) {
        issues.push(`${inputs.length} inputs missing labels`);
      }
      
      // Check for color contrast (simplified)
      const buttons = element.querySelectorAll('button');
      buttons.forEach((btn) => {
        const style = window.getComputedStyle(btn);
        const bg = style.backgroundColor;
        const color = style.color;
        // Add more sophisticated contrast checking if needed
      });
      
      return issues;
    }, selector);
    
    return violations;
  }
}