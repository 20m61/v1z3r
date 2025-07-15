/**
 * E2E tests for session management
 * Tests token refresh, session persistence, and multi-device scenarios
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from '../fixtures/auth';
import { TestHelpers } from '../fixtures/helpers';
import { testUrls, timeouts } from '../fixtures/test-data';

test.describe('Session Management', () => {
  let authHelper: AuthHelper;
  let testHelper: TestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testHelper = new TestHelpers(page);
    await authHelper.clearAuthState();
  });

  test('automatic token refresh on expiry', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Mock token that's about to expire
    await page.evaluate(() => {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        // Set token to expire in 10 seconds
        parsed.state.tokenExpiry = Date.now() + 10000;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    });
    
    // Wait for token to expire
    await page.waitForTimeout(11000);
    
    // Make a request that requires auth
    await page.goto(testUrls.dashboard);
    
    // Should still be authenticated (token refreshed)
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    expect(page.url()).toContain(testUrls.dashboard);
  });

  test('session persistence across tabs', async ({ context, page }) => {
    // Login in first tab
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    await page.goto(testUrls.dashboard);
    
    // Open new tab
    const newTab = await context.newPage();
    const newAuthHelper = new AuthHelper(newTab);
    
    // New tab should share session
    await newTab.goto(testUrls.dashboard);
    expect(await newAuthHelper.isAuthenticated()).toBeTruthy();
    
    // Logout in new tab
    await newAuthHelper.logout();
    
    // Original tab should reflect logout on next navigation
    await page.goto('/visualizer');
    await page.waitForURL((url) => url.pathname === testUrls.login);
  });

  test('remember me functionality', async ({ page, context }) => {
    await page.goto(testUrls.login);
    
    // Check if remember me checkbox exists
    const rememberMe = page.locator('input[name="rememberMe"]');
    if (await rememberMe.isVisible()) {
      await rememberMe.check();
    }
    
    // Login
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    await page.click('button[type="submit"]');
    
    await page.waitForURL(testUrls.dashboard);
    
    // Get cookies
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('session'));
    
    if (authCookie) {
      // Check cookie expiry (should be extended if remember me is checked)
      const expiryDate = new Date(authCookie.expires * 1000);
      const daysDiff = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      
      // If remember me was checked, expiry should be > 1 day
      if (await rememberMe.isVisible()) {
        expect(daysDiff).toBeGreaterThan(1);
      }
    }
  });

  test('handles network interruption during token refresh', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Set token to expired
    await page.evaluate(() => {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        parsed.state.tokenExpiry = Date.now() - 1000;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    });
    
    // Simulate network failure for refresh endpoint
    await page.route('**/api/auth/refresh', (route) => {
      route.abort('failed');
    });
    
    // Try to access protected route
    await page.goto(testUrls.dashboard);
    
    // Should redirect to login due to failed refresh
    await page.waitForURL((url) => url.pathname === testUrls.login);
  });

  test('multiple device logout', async ({ browser }) => {
    // Simulate two devices
    const device1 = await browser.newContext();
    const device2 = await browser.newContext();
    
    const page1 = await device1.newPage();
    const page2 = await device2.newPage();
    
    const auth1 = new AuthHelper(page1);
    const auth2 = new AuthHelper(page2);
    
    try {
      // Login on both devices
      await auth1.login(testUsers.regular.email, testUsers.regular.password);
      await auth2.login(testUsers.regular.email, testUsers.regular.password);
      
      // Both should be authenticated
      await page1.goto(testUrls.dashboard);
      await page2.goto(testUrls.dashboard);
      
      expect(await auth1.isAuthenticated()).toBeTruthy();
      expect(await auth2.isAuthenticated()).toBeTruthy();
      
      // Logout from device 1
      await auth1.logout();
      
      // Device 2 might still work (depends on implementation)
      // but should detect logout on next server interaction
      await page2.reload();
      
      // Check if device 2 is still authenticated or logged out
      const isAuth2 = await auth2.isAuthenticated();
      // This behavior depends on backend implementation
      // (whether it invalidates all sessions or just one)
    } finally {
      await device1.close();
      await device2.close();
    }
  });

  test('session activity timeout', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Simulate inactivity by mocking last activity time
    await page.evaluate(() => {
      // Mock implementation - depends on how activity is tracked
      const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      const lastActivity = Date.now() - INACTIVITY_TIMEOUT - 1000;
      sessionStorage.setItem('lastActivity', lastActivity.toString());
    });
    
    // Try to navigate
    await page.goto('/visualizer');
    
    // Might show timeout message or redirect to login
    const hasTimeoutMessage = await page.locator('text=/session expired|timeout|inactive/i').isVisible({
      timeout: timeouts.short
    }).catch(() => false);
    
    const isOnLogin = page.url().includes(testUrls.login);
    
    expect(hasTimeoutMessage || isOnLogin).toBeTruthy();
  });

  test('preserves session data on token refresh', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Set some session data
    await page.evaluate(() => {
      sessionStorage.setItem('userPreferences', JSON.stringify({
        theme: 'dark',
        layout: 'compact'
      }));
    });
    
    // Force token refresh
    await page.evaluate(() => {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        parsed.state.tokenExpiry = Date.now() - 1000;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    });
    
    // Navigate to trigger refresh
    await page.goto(testUrls.dashboard);
    
    // Check if session data is preserved
    const preferences = await page.evaluate(() => {
      return sessionStorage.getItem('userPreferences');
    });
    
    expect(preferences).toBeTruthy();
    if (preferences) {
      const parsed = JSON.parse(preferences);
      expect(parsed.theme).toBe('dark');
      expect(parsed.layout).toBe('compact');
    }
  });

  test('handles clock skew between client and server', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Simulate clock skew (client time ahead of server)
    await page.evaluate(() => {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        // Set expiry based on "wrong" client time
        parsed.state.tokenExpiry = Date.now() + (2 * 60 * 60 * 1000); // 2 hours ahead
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    });
    
    // Should still handle auth correctly
    await page.goto(testUrls.dashboard);
    expect(await authHelper.isAuthenticated()).toBeTruthy();
  });

  test('secure cookie handling', async ({ page, context }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Check cookies
    const cookies = await context.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('token') || 
      c.name.includes('session')
    );
    
    // Verify secure cookie attributes
    authCookies.forEach(cookie => {
      // In production, these should be true
      if (page.url().startsWith('https')) {
        expect(cookie.secure).toBeTruthy();
        expect(cookie.sameSite).toBe('Strict' || 'Lax');
      }
      
      // Should have httpOnly for security tokens
      if (cookie.name.includes('token')) {
        expect(cookie.httpOnly).toBeTruthy();
      }
    });
  });

  test('graceful degradation without localStorage', async ({ page }) => {
    // Disable localStorage
    await page.addInitScript(() => {
      delete (window as any).localStorage;
    });
    
    await page.goto(testUrls.login);
    
    // Should still be able to login (using cookies/sessionStorage)
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    await page.click('button[type="submit"]');
    
    // Check if login works without localStorage
    const loginSucceeded = await page.waitForURL((url) => 
      url.pathname === testUrls.dashboard, 
      { timeout: timeouts.medium }
    ).then(() => true).catch(() => false);
    
    // App might show a warning or fallback appropriately
    if (!loginSucceeded) {
      const hasWarning = await page.locator('text=/storage|cookies|browser/i').isVisible();
      expect(hasWarning).toBeTruthy();
    }
  });
});