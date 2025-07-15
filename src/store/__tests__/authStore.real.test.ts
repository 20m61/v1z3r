/**
 * Real implementation tests for authStore
 * Tests without mocking to verify actual store behavior
 */

import { renderHook, act } from '@testing-library/react';

// Unmock the store for real tests
jest.unmock('@/store/authStore');

// Mock only the error handler
const mockErrorHandler = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/utils/errorHandler', () => ({
  errorHandler: mockErrorHandler,
}));

// Import after unmocking
const { useAuthStore, cleanupAuthStore } = require('@/store/authStore');

describe('authStore (Real Implementation)', () => {
  beforeEach(() => {
    // Reset store to initial state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.clearAuth();
    });
    
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanupAuthStore();
  });

  describe('Initial State', () => {
    it('starts with correct default values', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.accessToken).toBeNull();
      expect(result.current.idToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.tokenExpiry).toBeNull();
    });
  });

  describe('User Management', () => {
    it('sets and clears user correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const testUser = {
        id: 'test-123',
        email: 'test@example.com',
        fullName: 'Test User',
        vjHandle: 'test_vj',
        tier: 'premium' as const,
        emailVerified: true,
        groups: ['premium'],
      };

      act(() => {
        result.current.setUser(testUser);
      });

      expect(result.current.user).toEqual(testUser);
      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Token Management', () => {
    it('sets tokens with correct expiry', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const tokens = {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600, // 1 hour
      };

      const beforeTime = Date.now();
      
      act(() => {
        result.current.setTokens(tokens);
      });

      const afterTime = Date.now();

      expect(result.current.accessToken).toBe(tokens.accessToken);
      expect(result.current.idToken).toBe(tokens.idToken);
      expect(result.current.refreshToken).toBe(tokens.refreshToken);
      expect(result.current.isAuthenticated).toBe(true);
      
      // Check expiry is set correctly (1 hour from now)
      const expectedExpiry = beforeTime + (tokens.expiresIn * 1000);
      expect(result.current.tokenExpiry).toBeGreaterThanOrEqual(expectedExpiry);
      expect(result.current.tokenExpiry).toBeLessThanOrEqual(afterTime + (tokens.expiresIn * 1000));
    });

    it('checks token expiry correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      
      // No token set
      expect(result.current.isTokenExpired()).toBe(true);

      // Set expired token
      act(() => {
        result.current.setTokens({
          accessToken: 'token',
          idToken: 'id',
          refreshToken: 'refresh',
          expiresIn: -1, // Already expired
        });
      });

      expect(result.current.isTokenExpired()).toBe(true);

      // Set valid token
      act(() => {
        result.current.setTokens({
          accessToken: 'token',
          idToken: 'id',
          refreshToken: 'refresh',
          expiresIn: 3600, // 1 hour
        });
      });

      expect(result.current.isTokenExpired()).toBe(false);
    });
  });

  describe('Authentication Flow', () => {
    it('handles successful mock login', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const response = await result.current.signIn('test@example.com', 'Test123!@#');
        expect(response.success).toBe(true);
      });

      expect(result.current.user).toEqual(expect.objectContaining({
        email: 'test@example.com',
      }));
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockErrorHandler.info).toHaveBeenCalledWith('User signed in', { email: 'test@example.com' });
    });

    it('handles failed login', async () => {
      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.signIn('wrong@example.com', 'wrongpass');
        })
      ).rejects.toThrow('NotAuthorizedException');

      expect(result.current.isAuthenticated).toBe(false);
      expect(mockErrorHandler.error).toHaveBeenCalled();
    });

    it('handles sign out', async () => {
      const { result } = renderHook(() => useAuthStore());

      // First sign in
      await act(async () => {
        await result.current.signIn('test@example.com', 'Test123!@#');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Then sign out
      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.accessToken).toBeNull();
      expect(mockErrorHandler.info).toHaveBeenCalledWith('User signed out');
    });
  });

  describe('Loading States', () => {
    it('manages loading state during operations', async () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isLoading).toBe(false);

      const signInPromise = act(async () => {
        await result.current.signIn('test@example.com', 'Test123!@#');
      });

      // Note: Due to the way React Testing Library works,
      // we can't easily test intermediate loading states
      // But we can verify it's false after completion
      await signInPromise;
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('gets user attributes correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const testUser = {
        id: 'test-123',
        email: 'test@example.com',
        fullName: 'Test User',
        vjHandle: 'test_vj',
        tier: 'premium' as const,
        emailVerified: true,
        groups: ['premium'],
      };

      act(() => {
        result.current.setUser(testUser);
      });

      expect(result.current.getUserAttribute('email')).toBe('test@example.com');
      expect(result.current.getUserAttribute('fullName')).toBe('Test User');
      expect(result.current.getUserAttribute('nonexistent')).toBeUndefined();

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.getUserAttribute('email')).toBeUndefined();
    });

    it('checks user roles correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const testUser = {
        id: 'test-123',
        email: 'test@example.com',
        tier: 'premium' as const,
        emailVerified: true,
        groups: ['premium', 'beta'],
      };

      act(() => {
        result.current.setUser(testUser);
      });

      expect(result.current.hasRole('premium')).toBe(true);
      expect(result.current.hasRole('beta')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.hasRole('premium')).toBe(false);
    });
  });

  describe('Session Refresh', () => {
    it('refreshes session with valid refresh token', async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial tokens
      act(() => {
        result.current.setTokens({
          accessToken: 'old-access',
          idToken: 'old-id',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        });
      });

      // Refresh session
      await act(async () => {
        const success = await result.current.refreshSession();
        expect(success).toBe(true);
      });

      // Check new tokens are set
      expect(result.current.accessToken).toBe('new-access-token');
      expect(result.current.idToken).toBe('new-id-token');
      expect(result.current.refreshToken).toBe('refresh-token');
    });

    it('fails refresh without refresh token', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const success = await result.current.refreshSession();
        expect(success).toBe(false);
      });
    });
  });

  describe('Persistence', () => {
    it('persists user data but not tokens to localStorage', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const testUser = {
        id: 'test-123',
        email: 'test@example.com',
        tier: 'free' as const,
        emailVerified: true,
      };

      act(() => {
        result.current.setUser(testUser);
        result.current.setTokens({
          accessToken: 'access',
          idToken: 'id',
          refreshToken: 'refresh',
          expiresIn: 3600,
        });
      });

      // Check localStorage
      const stored = localStorage.getItem('auth-storage');
      expect(stored).toBeTruthy();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.user).toEqual(testUser);
        expect(parsed.state.tokenExpiry).toBeDefined();
        
        // Tokens should NOT be in localStorage for security
        expect(parsed.state.accessToken).toBeUndefined();
        expect(parsed.state.idToken).toBeUndefined();
        expect(parsed.state.refreshToken).toBeUndefined();
      }
    });
  });

  describe('Mock Auth Methods', () => {
    it('handles email verification', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const success = await result.current.verifyEmail('test@example.com', '123456');
        expect(success).toBe(true);
      });
    });

    it('handles forgot password', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const success = await result.current.forgotPassword('test@example.com');
        expect(success).toBe(true);
      });
    });

    it('handles MFA setup', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const mfa = await result.current.setupMFA();
        expect(mfa).toEqual({
          secret: expect.any(String),
          qrCode: expect.any(String),
        });
      });
    });
  });
});