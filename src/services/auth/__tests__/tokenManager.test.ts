/**
 * Token Manager Tests
 */

import { tokenManager } from '../tokenManager';

describe('TokenManager', () => {
  beforeEach(() => {
    // Clear tokens before each test
    tokenManager.clearTokens();
    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  });

  describe('Token Storage', () => {
    it('should store tokens in memory', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      };

      tokenManager.setTokens(tokens);

      expect(tokenManager.getAccessToken()).toBe('test-access-token');
      expect(tokenManager.getIdToken()).toBe('test-id-token');
      expect(tokenManager.getRefreshToken()).toBe('test-refresh-token');
    });

    it('should clear all tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      };

      tokenManager.setTokens(tokens);
      tokenManager.clearTokens();

      expect(tokenManager.getAccessToken()).toBeNull();
      expect(tokenManager.getIdToken()).toBeNull();
      expect(tokenManager.getRefreshToken()).toBeNull();
    });

    it('should store expiry in sessionStorage', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      };

      const beforeTime = Date.now();
      tokenManager.setTokens(tokens);
      const afterTime = Date.now();

      const storedExpiry = sessionStorage.getItem('v1z3r_token_expiry');
      expect(storedExpiry).toBeTruthy();
      
      const expiry = parseInt(storedExpiry!, 10);
      expect(expiry).toBeGreaterThanOrEqual(beforeTime + 3600 * 1000);
      expect(expiry).toBeLessThanOrEqual(afterTime + 3600 * 1000);
    });
  });

  describe('Token Expiry', () => {
    it('should detect expired tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: -1, // Already expired
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.isTokenExpired()).toBe(true);
    });

    it('should detect valid tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600, // Valid for 1 hour
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.isTokenExpired()).toBe(false);
    });

    it('should detect tokens needing refresh', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 240, // 4 minutes - less than 5 minute threshold
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.needsRefresh()).toBe(true);
    });

    it('should not need refresh for fresh tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600, // 1 hour
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.needsRefresh()).toBe(false);
    });
  });

  describe('Token Decoding', () => {
    it('should decode valid JWT token', () => {
      // Mock JWT token with header.payload.signature
      const mockToken = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjE2MjM5MDIyfQ',
        'signature'
      ].join('.');

      const decoded = tokenManager.decodeToken(mockToken);
      expect(decoded).toEqual({
        sub: '1234567890',
        email: 'test@example.com',
        exp: 1616239022,
      });
    });

    it('should return null for invalid token format', () => {
      const decoded = tokenManager.decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should handle URL-safe base64', () => {
      // Token with URL-safe characters (-_)
      const mockToken = [
        'header',
        'eyJzdWIiOiJ0ZXN0LXVzZXJfaWQifQ', // {"sub":"test-user_id"}
        'signature'
      ].join('.');

      const decoded = tokenManager.decodeToken(mockToken);
      expect(decoded).toEqual({
        sub: 'test-user_id',
      });
    });
  });

  describe('User Info', () => {
    it('should extract user info from ID token', () => {
      // Mock ID token payload
      const mockIdToken = [
        'header',
        btoa(JSON.stringify({
          sub: 'user-123',
          email: 'test@example.com',
          email_verified: true,
          name: 'Test User',
          'custom:vj_handle': 'test_vj',
          'custom:tier': 'premium',
          'cognito:groups': ['premium', 'beta'],
        })),
        'signature'
      ].join('.');

      tokenManager.setTokens({
        accessToken: 'access-token',
        idToken: mockIdToken,
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });

      const userInfo = tokenManager.getUserInfo();
      expect(userInfo).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        vjHandle: 'test_vj',
        tier: 'premium',
        groups: ['premium', 'beta'],
      });
    });

    it('should return null when no ID token', () => {
      const userInfo = tokenManager.getUserInfo();
      expect(userInfo).toBeNull();
    });

    it('should handle missing custom attributes', () => {
      const mockIdToken = [
        'header',
        btoa(JSON.stringify({
          sub: 'user-123',
          email: 'test@example.com',
          email_verified: true,
        })),
        'signature'
      ].join('.');

      tokenManager.setTokens({
        accessToken: 'access-token',
        idToken: mockIdToken,
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });

      const userInfo = tokenManager.getUserInfo();
      expect(userInfo?.tier).toBe('free');
      expect(userInfo?.groups).toEqual([]);
    });
  });

  describe('Role Checking', () => {
    beforeEach(() => {
      const mockIdToken = [
        'header',
        btoa(JSON.stringify({
          sub: 'user-123',
          email: 'admin@example.com',
          'custom:tier': 'admin',
          'cognito:groups': ['admin', 'premium'],
        })),
        'signature'
      ].join('.');

      tokenManager.setTokens({
        accessToken: 'access-token',
        idToken: mockIdToken,
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });
    });

    it('should check user has role from groups', () => {
      expect(tokenManager.hasRole('admin')).toBe(true);
      expect(tokenManager.hasRole('premium')).toBe(true);
      expect(tokenManager.hasRole('moderator')).toBe(false);
    });

    it('should check user has role from tier', () => {
      expect(tokenManager.hasRole('admin')).toBe(true);
    });

    it('should return false when no user info', () => {
      tokenManager.clearTokens();
      expect(tokenManager.hasRole('admin')).toBe(false);
    });
  });

  describe('Time Until Expiry', () => {
    it('should calculate time until expiry', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600, // 1 hour
      };

      tokenManager.setTokens(tokens);
      const timeLeft = tokenManager.getTimeUntilExpiry();
      
      expect(timeLeft).toBeGreaterThan(3595);
      expect(timeLeft).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: -1,
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.getTimeUntilExpiry()).toBe(0);
    });
  });
});