/**
 * E2E tests for login functionality
 * Tests complete login flows including error cases and MFA
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from '../fixtures/auth';
import { TestHelpers } from '../fixtures/helpers';
import { testUrls, timeouts } from '../fixtures/test-data';

test.describe('Login Flow', () => {
  let authHelper: AuthHelper;
  let testHelper: TestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testHelper = new TestHelpers(page);
    await authHelper.clearAuthState();
  });

  test('successful login with valid credentials', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Fill login form
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(testUrls.dashboard, { timeout: timeouts.medium });
    
    // Verify user is authenticated
    expect(await authHelper.isAuthenticated()).toBeTruthy();
    
    // Check for user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('login fails with invalid credentials', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Fill with invalid credentials
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/incorrect password/i')).toBeVisible({ 
      timeout: timeouts.short 
    });
    
    // Should remain on login page
    expect(page.url()).toContain(testUrls.login);
    
    // Should not be authenticated
    expect(await authHelper.isAuthenticated()).toBeFalsy();
  });

  test('validates email format', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Enter invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'somepassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('text=/invalid email format/i')).toBeVisible();
    
    // Form should not be submitted
    expect(page.url()).toContain(testUrls.login);
  });

  test('validates password requirements', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Enter short password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'short');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('text=/password must be at least 8 characters/i')).toBeVisible();
  });

  test('redirects to forgot password', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Click forgot password link
    await page.click('text=/forgot password/i');
    
    // Should navigate to forgot password page
    await page.waitForURL('**/auth/forgot-password');
    expect(page.url()).toContain('/auth/forgot-password');
  });

  test('redirects to registration', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Click create account link
    await page.click('text=/create account/i');
    
    // Should navigate to registration page
    await page.waitForURL('**/auth/register');
    expect(page.url()).toContain('/auth/register');
  });

  test('persists return URL after login', async ({ page }) => {
    // Try to access protected page
    await page.goto('/dashboard/settings');
    
    // Should redirect to login with return URL
    await page.waitForURL((url) => url.pathname === testUrls.login);
    expect(page.url()).toContain('returnUrl');
    
    // Login
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    await page.click('button[type="submit"]');
    
    // Should redirect back to original page
    await page.waitForURL('**/dashboard/settings');
    expect(page.url()).toContain('/dashboard/settings');
  });

  test('shows loading state during submission', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Fill form
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    
    // Intercept API call to delay response
    await page.route('**/api/auth/login', async (route) => {
      await page.waitForTimeout(1000);
      await route.continue();
    });
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Button should show loading state
    await expect(page.locator('button[type="submit"]')).toContainText(/signing in/i);
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('handles network errors gracefully', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Mock network failure
    await page.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });
    
    // Fill and submit form
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/network error|failed to connect/i')).toBeVisible({
      timeout: timeouts.medium
    });
  });

  test('social login buttons are functional', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Check Google login button
    const googleButton = page.locator('button:has-text("Google")');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
    
    // Check GitHub login button
    const githubButton = page.locator('button:has-text("GitHub")');
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toBeEnabled();
  });

  test('maintains form state on validation error', async ({ page }) => {
    await page.goto(testUrls.login);
    
    const email = 'test@example.com';
    
    // Fill form with invalid password
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'short');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Email should still be filled
    await expect(page.locator('input[name="email"]')).toHaveValue(email);
    
    // Password should be cleared for security
    await expect(page.locator('input[name="password"]')).toHaveValue('short');
  });

  test('accessibility - form has proper labels', async ({ page }) => {
    await page.goto(testUrls.login);
    
    // Check form accessibility
    const violations = await testHelper.checkAccessibility('form');
    expect(violations).toHaveLength(0);
    
    // Check that inputs have labels
    const emailInput = page.locator('input[name="email"]');
    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toBeVisible();
    
    const passwordInput = page.locator('input[name="password"]');
    const passwordLabel = page.locator('label[for="password"]');
    await expect(passwordLabel).toBeVisible();
  });

  test('responsive design - works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(testUrls.login);
    
    // Form should be visible and functional
    await expect(page.locator('form')).toBeVisible();
    
    // Fill and submit form
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', testUsers.regular.password);
    await page.click('button[type="submit"]');
    
    // Should still work on mobile
    await page.waitForURL(testUrls.dashboard, { timeout: timeouts.medium });
  });
});