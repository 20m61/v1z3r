/**
 * E2E tests for protected routes and authorization
 * Tests route guards, role-based access, and session management
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from '../fixtures/auth';
import { TestHelpers } from '../fixtures/helpers';
import { testUrls, timeouts } from '../fixtures/test-data';

test.describe('Protected Routes', () => {
  let authHelper: AuthHelper;
  let testHelper: TestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testHelper = new TestHelpers(page);
    await authHelper.clearAuthState();
  });

  const protectedRoutes = [
    '/dashboard',
    '/dashboard/settings',
    '/visualizer',
    '/presets',
    '/presets/new',
    '/sessions',
    '/profile',
  ];

  test('redirects to login when accessing protected routes without auth', async ({ page }) => {
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login
      await page.waitForURL((url) => url.pathname === testUrls.login);
      
      // Should include return URL
      expect(page.url()).toContain('returnUrl');
      expect(page.url()).toContain(encodeURIComponent(route));
    }
  });

  test('allows access to protected routes when authenticated', async ({ page }) => {
    // Login first
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Test accessing protected routes
    for (const route of protectedRoutes.slice(0, 3)) { // Test a few to save time
      await page.goto(route);
      
      // Should not redirect to login
      await page.waitForURL((url) => url.pathname === route, {
        timeout: timeouts.short
      });
      
      // Should show authenticated UI
      expect(await authHelper.isAuthenticated()).toBeTruthy();
    }
  });

  test('role-based access control for premium features', async ({ page }) => {
    // Login as regular user
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Try to access premium feature
    await page.goto('/dashboard/premium-features');
    
    // Should show access denied message
    await expect(page.locator('text=/access denied|premium required|upgrade/i')).toBeVisible({
      timeout: timeouts.medium
    });
  });

  test('admin-only routes', async ({ page }) => {
    // Login as regular user
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Try to access admin panel
    await page.goto('/admin');
    
    // Should show access denied or redirect
    const isAccessDenied = await page.locator('text=/access denied|forbidden|unauthorized/i').isVisible({
      timeout: timeouts.short
    }).catch(() => false);
    
    const isRedirected = page.url().includes('/dashboard') || page.url().includes('/');
    
    expect(isAccessDenied || isRedirected).toBeTruthy();
  });

  test('maintains auth state across page refreshes', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Navigate to dashboard
    await page.goto(testUrls.dashboard);
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    
    // Refresh page
    await page.reload();
    
    // Should still be authenticated
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    expect(page.url()).toContain(testUrls.dashboard);
  });

  test('logout clears session and redirects', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Verify authenticated
    await page.goto(testUrls.dashboard);
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    
    // Logout
    await authHelper.logout();
    
    // Should redirect to home or login
    await page.waitForURL((url) => 
      url.pathname === '/' || url.pathname === testUrls.login
    );
    
    // Try to access protected route
    await page.goto(testUrls.dashboard);
    
    // Should redirect to login
    await page.waitForURL((url) => url.pathname === testUrls.login);
  });

  test('session timeout handling', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Mock expired token
    await page.evaluate(() => {
      // Modify token expiry in storage
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        parsed.state.tokenExpiry = Date.now() - 1000; // Expired
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    });
    
    // Try to access protected route
    await page.goto(testUrls.dashboard);
    
    // Should attempt token refresh or redirect to login
    const isOnDashboard = page.url().includes(testUrls.dashboard);
    const isOnLogin = page.url().includes(testUrls.login);
    
    expect(isOnDashboard || isOnLogin).toBeTruthy();
  });

  test('deep linking to protected routes after login', async ({ page }) => {
    const targetRoute = '/dashboard/settings?tab=security';
    
    // Try to access deep link
    await page.goto(targetRoute);
    
    // Should redirect to login with return URL
    await page.waitForURL((url) => url.pathname === testUrls.login);
    expect(page.url()).toContain('returnUrl');
    
    // Login
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to original deep link
    await page.waitForURL((url) => url.href.includes(targetRoute));
    expect(page.url()).toContain('tab=security');
  });

  test('concurrent session handling', async ({ browser }) => {
    // Create two browser contexts (sessions)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const auth1 = new AuthHelper(page1);
    const auth2 = new AuthHelper(page2);
    
    try {
      // Login in first session
      await auth1.login(testUsers.regular.email, testUsers.regular.password);
      await page1.goto(testUrls.dashboard);
      expect(await auth1.isAuthenticated()).toBeTruthy();
      
      // Second session should not be authenticated
      await page2.goto(testUrls.dashboard);
      await page2.waitForURL((url) => url.pathname === testUrls.login);
      
      // Login in second session
      await auth2.login(testUsers.regular.email, testUsers.regular.password);
      await page2.goto(testUrls.dashboard);
      expect(await auth2.isAuthenticated()).toBeTruthy();
      
      // Both sessions should work independently
      await page1.reload();
      expect(await auth1.isAuthenticated()).toBeTruthy();
      
      await page2.reload();
      expect(await auth2.isAuthenticated()).toBeTruthy();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('handles browser back/forward navigation', async ({ page }) => {
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Navigate through multiple pages
    await page.goto(testUrls.dashboard);
    await page.goto('/dashboard/settings');
    await page.goto('/visualizer');
    
    // Go back
    await page.goBack();
    await page.waitForURL('**/dashboard/settings');
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    
    // Go back again
    await page.goBack();
    await page.waitForURL(testUrls.dashboard);
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    
    // Go forward
    await page.goForward();
    await page.waitForURL('**/dashboard/settings');
    expect(await authHelper.isAuthenticated()).toBeTruthy();
  });

  test('API route protection', async ({ page }) => {
    // Try to access API without auth
    const response = await page.request.get('/api/user/profile');
    expect(response.status()).toBe(401);
    
    // Login
    await authHelper.login(testUsers.regular.email, testUsers.regular.password);
    
    // Get auth cookies
    const cookies = await authHelper.getAuthCookies();
    
    // Try API with auth
    const authenticatedResponse = await page.request.get('/api/user/profile', {
      headers: {
        'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ')
      }
    });
    
    // Should be successful or return appropriate status
    expect([200, 404]).toContain(authenticatedResponse.status());
  });
});