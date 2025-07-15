/**
 * Unit tests for authStore
 * Tests authentication state management, token handling, and session persistence
 */

import { act, renderHook } from '@testing-library/react';
import { useAuthStore, cleanupAuthStore } from '@/store/authStore';

// Mock error handler
jest.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock timers for token refresh
jest.useFakeTimers();

describe('authStore', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    vjHandle: 'test_vj',
    tier: 'premium' as const,
    emailVerified: true,
    groups: ['premium'],
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  };

  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.clearAuth();
    });
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    // Cleanup auth store intervals
    cleanupAuthStore();
    jest.clearAllTimers();
  });

  describe('State Management', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.accessToken).toBeNull();
      expect(result.current.idToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.tokenExpiry).toBeNull();
    });

    it('sets user correctly', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('sets tokens correctly', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setTokens(mockTokens);
      });

      expect(result.current.accessToken).toBe(mockTokens.accessToken);
      expect(result.current.idToken).toBe(mockTokens.idToken);
      expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('clears auth state', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set some state first
      act(() => {
        result.current.setUser(mockUser);
        result.current.setTokens(mockTokens);
      });

      // Clear auth
      act(() => {
        result.current.clearAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.accessToken).toBeNull();
      expect(result.current.idToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.tokenExpiry).toBeNull();
    });
  });

  describe('Authentication Operations', () => {
    it('handles successful sign in', async () => {
      const { result } = renderHook(() => useAuthStore());

      let response;
      await act(async () => {
        response = await result.current.signIn('test@example.com', 'Test123!@#');
      });

      expect(response).toEqual({ success: true });
      expect(result.current.user).toEqual(expect.objectContaining({
        email: 'test@example.com',
      }));
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('handles sign in with MFA challenge', async () => {
      const { result } = renderHook(() => useAuthStore());

      let response;
      await act(async () => {
        // Sign in with non-test credentials to trigger MFA
        response = await result.current.signIn('mfa@example.com', 'password');
      });

      expect(response).toEqual({
        success: false,
        challengeName: expect.any(String),
        session: expect.any(String),
      });
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles sign in error', async () => {
      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.signIn('wrong@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('NotAuthorizedException');

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles sign up', async () => {
      const { result } = renderHook(() => useAuthStore());

      const signUpParams = {
        username: 'newuser@example.com',
        password: 'Test123!@#',
        attributes: {
          email: 'newuser@example.com',
          name: 'New User',
        },
      };

      let response;
      await act(async () => {
        response = await result.current.signUp(signUpParams);
      });

      expect(response).toEqual({
        success: true,
        userSub: expect.any(String),
      });
    });

    it('handles sign out', async () => {
      const { result } = renderHook(() => useAuthStore());

      // Sign in first
      act(() => {
        result.current.setUser(mockUser);
        result.current.setTokens(mockTokens);
      });

      // Sign out
      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.accessToken).toBeNull();
    });
  });

  describe('Token Management', () => {
    it('checks if token is expired', () => {
      const { result } = renderHook(() => useAuthStore());

      // No token expiry
      expect(result.current.isTokenExpired()).toBe(true);

      // Set expired token
      act(() => {
        result.current.setTokens({
          ...mockTokens,
          expiresIn: -1, // Expired
        });
      });

      expect(result.current.isTokenExpired()).toBe(true);

      // Set valid token
      act(() => {
        result.current.setTokens({
          ...mockTokens,
          expiresIn: 3600, // 1 hour
        });
      });

      expect(result.current.isTokenExpired()).toBe(false);
    });

    it('refreshes session', async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set refresh token
      act(() => {
        result.current.setTokens(mockTokens);
      });

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshSession();
      });

      expect(refreshResult).toBe(true);
      expect(result.current.accessToken).toBe('new-access-token');
    });

    it('handles refresh failure', async () => {
      const { result } = renderHook(() => useAuthStore());

      // No refresh token
      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshSession();
      });

      expect(refreshResult).toBe(false);
    });

    it('auto-refreshes expired tokens', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set expired token
      act(() => {
        result.current.setUser(mockUser);
        result.current.setTokens({
          ...mockTokens,
          expiresIn: -1, // Already expired
        });
      });

      // Fast-forward to trigger refresh interval
      act(() => {
        jest.advanceTimersByTime(300000); // 5 minutes
      });

      expect(result.current.refreshSession).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    it('gets user attributes', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.getUserAttribute('email')).toBe('test@example.com');
      expect(result.current.getUserAttribute('fullName')).toBe('Test User');
      expect(result.current.getUserAttribute('nonexistent')).toBeUndefined();
    });

    it('checks user roles', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.hasRole('premium')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
      
      // Check tier-based role
      expect(result.current.hasRole('premium')).toBe(true);
    });

    it('handles role check without user', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasRole('any-role')).toBe(false);
    });
  });

  describe('MFA Operations', () => {
    it('sets up MFA', async () => {
      const { result } = renderHook(() => useAuthStore());

      let mfaSetup;
      await act(async () => {
        mfaSetup = await result.current.setupMFA();
      });

      expect(mfaSetup).toEqual({
        secret: expect.any(String),
        qrCode: expect.any(String),
      });
    });

    it('verifies MFA code', async () => {
      const { result } = renderHook(() => useAuthStore());

      let verifyResult;
      await act(async () => {
        verifyResult = await result.current.verifyMFA('123456');
      });

      expect(verifyResult).toBe(true);
    });
  });

  describe('Password Operations', () => {
    it('handles forgot password', async () => {
      const { result } = renderHook(() => useAuthStore());

      let forgotResult;
      await act(async () => {
        forgotResult = await result.current.forgotPassword('test@example.com');
      });

      expect(forgotResult).toBe(true);
    });

    it('confirms forgot password', async () => {
      const { result } = renderHook(() => useAuthStore());

      let confirmResult;
      await act(async () => {
        confirmResult = await result.current.confirmForgotPassword(
          'test@example.com',
          '123456',
          'NewPassword123!@#'
        );
      });

      expect(confirmResult).toBe(true);
    });

    it('changes password', async () => {
      const { result } = renderHook(() => useAuthStore());

      let changeResult;
      await act(async () => {
        changeResult = await result.current.changePassword(
          'OldPassword123!@#',
          'NewPassword123!@#'
        );
      });

      expect(changeResult).toBe(true);
    });
  });

  describe('Email Verification', () => {
    it('verifies email', async () => {
      const { result } = renderHook(() => useAuthStore());

      let verifyResult;
      await act(async () => {
        verifyResult = await result.current.verifyEmail(
          'test@example.com',
          '123456'
        );
      });

      expect(verifyResult).toBe(true);
    });

    it('resends verification code', async () => {
      const { result } = renderHook(() => useAuthStore());

      let resendResult;
      await act(async () => {
        resendResult = await result.current.resendVerificationCode(
          'test@example.com'
        );
      });

      expect(resendResult).toBe(true);
    });
  });

  describe('Persistence', () => {
    it('persists user but not tokens to localStorage', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
        result.current.setTokens(mockTokens);
      });

      // Check localStorage
      const storedData = JSON.parse(
        localStorage.getItem('auth-storage') || '{}'
      );

      expect(storedData.state.user).toEqual(mockUser);
      expect(storedData.state.accessToken).toBeUndefined();
      expect(storedData.state.idToken).toBeUndefined();
      expect(storedData.state.refreshToken).toBeUndefined();
      expect(storedData.state.tokenExpiry).toBeDefined();
    });

    it('restores user from localStorage on init', () => {
      // Set data in localStorage
      const persistedData = {
        state: {
          user: mockUser,
          tokenExpiry: Date.now() + 3600000,
        },
        version: 0,
      };
      localStorage.setItem('auth-storage', JSON.stringify(persistedData));

      // Create new store instance
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.tokenExpiry).toBe(persistedData.state.tokenExpiry);
    });
  });
});