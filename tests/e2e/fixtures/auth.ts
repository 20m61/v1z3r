/**
 * Authentication fixtures for E2E tests
 * Provides reusable authentication utilities
 */

import { Page } from '@playwright/test';

export const testUsers = {
  regular: {
    email: 'test@example.com',
    password: 'Test123!@#',
    fullName: 'Test User',
    vjHandle: 'test_vj',
  },
  premium: {
    email: 'premium@example.com',
    password: 'Premium123!@#',
    fullName: 'Premium User',
    vjHandle: 'premium_vj',
  },
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!@#',
    fullName: 'Admin User',
    vjHandle: 'admin_vj',
  },
};

export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/auth/login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    
    // Wait for navigation
    await this.page.waitForURL((url) => !url.pathname.includes('/auth/login'));
  }

  async register(user: typeof testUsers.regular) {
    await this.page.goto('/auth/register');
    await this.page.fill('input[name="email"]', user.email);
    await this.page.fill('input[name="password"]', user.password);
    await this.page.fill('input[name="confirmPassword"]', user.password);
    await this.page.fill('input[name="fullName"]', user.fullName);
    await this.page.fill('input[name="vjHandle"]', user.vjHandle);
    await this.page.click('button[type="submit"]');
  }

  async logout() {
    // Look for user menu or logout button
    const userMenu = this.page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.click('[data-testid="logout-button"]');
    } else {
      // Direct navigation if UI is not available
      await this.page.goto('/auth/logout');
    }
    
    // Wait for redirect to home or login
    await this.page.waitForURL((url) => 
      url.pathname === '/' || url.pathname === '/auth/login'
    );
  }

  async isAuthenticated(): Promise<boolean> {
    // Check for authenticated indicators
    const indicators = [
      this.page.locator('[data-testid="user-menu"]'),
      this.page.locator('[data-testid="dashboard-nav"]'),
      this.page.locator('text=Dashboard'),
    ];

    for (const indicator of indicators) {
      if (await indicator.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  async getAuthCookies() {
    const cookies = await this.page.context().cookies();
    return cookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('token') ||
      cookie.name.includes('session')
    );
  }

  async setAuthCookies(cookies: any[]) {
    await this.page.context().addCookies(cookies);
  }

  async clearAuthState() {
    // Clear cookies
    await this.page.context().clearCookies();
    
    // Clear local storage
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async waitForAuthRedirect(expectedPath: string) {
    await this.page.waitForURL((url) => url.pathname.includes(expectedPath), {
      timeout: 10000,
    });
  }

  async fillMFACode(code: string) {
    await this.page.fill('input[name="mfaCode"]', code);
    await this.page.click('button[type="submit"]');
  }

  async fillVerificationCode(code: string) {
    await this.page.fill('input[name="verificationCode"]', code);
    await this.page.click('button[type="submit"]');
  }
}