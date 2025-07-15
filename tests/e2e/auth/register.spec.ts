/**
 * E2E tests for registration functionality
 * Tests complete registration flows including validation and verification
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from '../fixtures/auth';
import { TestHelpers } from '../fixtures/helpers';
import { testUrls, timeouts } from '../fixtures/test-data';

test.describe('Registration Flow', () => {
  let authHelper: AuthHelper;
  let testHelper: TestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testHelper = new TestHelpers(page);
    await authHelper.clearAuthState();
  });

  test('successful registration with valid data', async ({ page }) => {
    await page.goto(testUrls.register);
    
    // Generate unique user data
    const timestamp = Date.now();
    const newUser = {
      email: `newuser${timestamp}@example.com`,
      password: 'StrongPass123!@#',
      fullName: 'New Test User',
      vjHandle: `new_vj_${timestamp}`,
    };
    
    // Fill registration form
    await page.fill('input[name="email"]', newUser.email);
    await page.fill('input[name="password"]', newUser.password);
    await page.fill('input[name="confirmPassword"]', newUser.password);
    await page.fill('input[name="fullName"]', newUser.fullName);
    await page.fill('input[name="vjHandle"]', newUser.vjHandle);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show verification form
    await expect(page.locator('text=/verify your email/i')).toBeVisible({
      timeout: timeouts.medium
    });
    
    // Verification code input should be visible
    await expect(page.locator('input[name="verificationCode"]')).toBeVisible();
  });

  test('validates email uniqueness', async ({ page }) => {
    await page.goto(testUrls.register);
    
    // Use existing user email
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.fill('input[name="password"]', 'StrongPass123!@#');
    await page.fill('input[name="confirmPassword"]', 'StrongPass123!@#');
    await page.fill('input[name="fullName"]', 'Duplicate User');
    await page.fill('input[name="vjHandle"]', 'duplicate_vj');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=/email already registered/i')).toBeVisible({
      timeout: timeouts.medium
    });
  });

  test('password strength validation', async ({ page }) => {
    await page.goto(testUrls.register);
    
    const passwordInput = page.locator('input[name="password"]');
    const strengthIndicator = page.locator('[data-testid="password-strength"]');
    
    // Weak password
    await passwordInput.fill('weak');
    await expect(page.locator('text=/at least 12 characters/i')).toBeVisible();
    
    // Medium password
    await passwordInput.fill('Medium123');
    await expect(page.locator('text=/uppercase letter/i')).toBeVisible();
    
    // Strong password
    await passwordInput.fill('StrongPass123!@#');
    await expect(page.locator('text=/at least 12 characters/i')).not.toBeVisible();
    
    // Check strength indicator if present
    if (await strengthIndicator.isVisible()) {
      await expect(strengthIndicator).toContainText(/strong/i);
    }
  });

  test('password confirmation must match', async ({ page }) => {
    await page.goto(testUrls.register);
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'StrongPass123!@#');
    await page.fill('input[name="confirmPassword"]', 'DifferentPass123!@#');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=/passwords do not match/i')).toBeVisible();
  });

  test('VJ handle validation', async ({ page }) => {
    await page.goto(testUrls.register);
    
    const vjHandleInput = page.locator('input[name="vjHandle"]');
    
    // Test invalid characters
    await vjHandleInput.fill('invalid handle!');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/letters, numbers, underscores, and hyphens/i')).toBeVisible();
    
    // Test too short
    await vjHandleInput.fill('ab');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/at least 3 characters/i')).toBeVisible();
    
    // Valid handle
    await vjHandleInput.fill('valid_vj_123');
    // Error should be cleared
    await expect(page.locator('text=/at least 3 characters/i')).not.toBeVisible();
  });

  test('email verification flow', async ({ page }) => {
    await page.goto(testUrls.register);
    
    // Complete registration
    const timestamp = Date.now();
    const newUser = {
      email: `verify${timestamp}@example.com`,
      password: 'StrongPass123!@#',
      fullName: 'Verify User',
      vjHandle: `verify_${timestamp}`,
    };
    
    await page.fill('input[name="email"]', newUser.email);
    await page.fill('input[name="password"]', newUser.password);
    await page.fill('input[name="confirmPassword"]', newUser.password);
    await page.fill('input[name="fullName"]', newUser.fullName);
    await page.fill('input[name="vjHandle"]', newUser.vjHandle);
    
    await page.click('button[type="submit"]');
    
    // Wait for verification form
    await expect(page.locator('text=/verify your email/i')).toBeVisible();
    
    // Test resend code functionality
    const resendButton = page.locator('button:has-text("Resend Code")');
    await expect(resendButton).toBeVisible();
    
    await resendButton.click();
    await expect(page.locator('text=/verification code sent/i')).toBeVisible();
    
    // Enter verification code (mock)
    await page.fill('input[name="verificationCode"]', '123456');
    await page.click('button:has-text("Verify Email")');
    
    // Should redirect to login with success message
    await page.waitForURL((url) => url.pathname === testUrls.login);
    expect(page.url()).toContain('verified=true');
  });

  test('navigation between login and register', async ({ page }) => {
    // Start at register
    await page.goto(testUrls.register);
    
    // Navigate to login
    await page.click('text=/already have an account/i');
    await page.waitForURL(testUrls.login);
    
    // Navigate back to register
    await page.click('text=/create account/i');
    await page.waitForURL(testUrls.register);
  });

  test('form preserves data on validation error', async ({ page }) => {
    await page.goto(testUrls.register);
    
    const userData = {
      email: 'preserve@example.com',
      fullName: 'Preserve User',
      vjHandle: 'preserve_vj',
    };
    
    // Fill form with short password
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="password"]', 'short');
    await page.fill('input[name="confirmPassword"]', 'short');
    await page.fill('input[name="fullName"]', userData.fullName);
    await page.fill('input[name="vjHandle"]', userData.vjHandle);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Data should be preserved
    await expect(page.locator('input[name="email"]')).toHaveValue(userData.email);
    await expect(page.locator('input[name="fullName"]')).toHaveValue(userData.fullName);
    await expect(page.locator('input[name="vjHandle"]')).toHaveValue(userData.vjHandle);
  });

  test('shows loading state during submission', async ({ page }) => {
    await page.goto(testUrls.register);
    
    // Fill valid form
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `loading${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'StrongPass123!@#');
    await page.fill('input[name="confirmPassword"]', 'StrongPass123!@#');
    await page.fill('input[name="fullName"]', 'Loading User');
    await page.fill('input[name="vjHandle"]', `loading_${timestamp}`);
    
    // Intercept API call to delay response
    await page.route('**/api/auth/register', async (route) => {
      await page.waitForTimeout(1000);
      await route.continue();
    });
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Button should show loading state
    await expect(page.locator('button[type="submit"]')).toContainText(/creating account/i);
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('accessibility - form has proper structure', async ({ page }) => {
    await page.goto(testUrls.register);
    
    // Check form accessibility
    const violations = await testHelper.checkAccessibility('form');
    expect(violations).toHaveLength(0);
    
    // Check all inputs have labels
    const inputs = ['email', 'password', 'confirmPassword', 'fullName', 'vjHandle'];
    for (const inputName of inputs) {
      const input = page.locator(`input[name="${inputName}"]`);
      const label = page.locator(`label[for="${inputName}"]`);
      await expect(input).toBeVisible();
      await expect(label).toBeVisible();
    }
  });

  test('responsive design - works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(testUrls.register);
    
    // Form should be visible
    await expect(page.locator('form')).toBeVisible();
    
    // All form elements should be accessible
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `mobile${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'StrongPass123!@#');
    await page.fill('input[name="confirmPassword"]', 'StrongPass123!@#');
    await page.fill('input[name="fullName"]', 'Mobile User');
    await page.fill('input[name="vjHandle"]', `mobile_${timestamp}`);
    
    // Submit should work
    await page.click('button[type="submit"]');
    
    // Should show verification form
    await expect(page.locator('text=/verify your email/i')).toBeVisible({
      timeout: timeouts.medium
    });
  });
});