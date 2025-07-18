/**
 * Authentication Store using Zustand
 * Manages user authentication state and JWT tokens
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { errorHandler } from '@/utils/errorHandler';
import { cognitoAuth } from '@/services/auth/cognitoAuth';
import { tokenManager } from '@/services/auth/tokenManager';

interface User {
  id: string;
  email: string;
  fullName?: string;
  vjHandle?: string;
  tier: 'free' | 'premium' | 'admin';
  emailVerified: boolean;
  groups?: string[];
  mfaEnabled?: boolean;
  passwordLastChanged?: string;
}

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
  }) => void;
  clearAuth: () => void;
  
  // Auth operations
  signIn: (email: string, password: string) => Promise<{
    success: boolean;
    challengeName?: string;
    session?: string;
  }>;
  signUp: (params: {
    username: string;
    password: string;
    attributes: Record<string, string>;
  }) => Promise<{ success: boolean; userSub?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  resendVerificationCode: (email: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  
  // MFA operations
  setupMFA: () => Promise<{ secret: string; qrCode: string }>;
  verifyMFA: (code: string, session?: string) => Promise<boolean>;
  
  // Utility
  isTokenExpired: () => boolean;
  getUserAttribute: (attribute: string) => string | undefined;
  hasRole: (role: string) => boolean;
}

// Use the new Cognito auth service

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
        idToken: null,
        refreshToken: null,
        tokenExpiry: null,
        
        // State setters
        setUser: (user) => set({ user, isAuthenticated: !!user }),
        
        setTokens: ({ accessToken, idToken, refreshToken, expiresIn }) => {
          // Store tokens in the secure token manager
          tokenManager.setTokens({ accessToken, idToken, refreshToken, expiresIn });
          
          const expiry = Date.now() + expiresIn * 1000;
          set({
            accessToken,
            idToken,
            refreshToken,
            tokenExpiry: expiry,
            isAuthenticated: true,
          });
        },
        
        clearAuth: () => {
          // Clear tokens from secure storage
          tokenManager.clearTokens();
          
          set({
            user: null,
            isAuthenticated: false,
            accessToken: null,
            idToken: null,
            refreshToken: null,
            tokenExpiry: null,
          });
        },
        
        // Auth operations
        signIn: async (email, password) => {
          set({ isLoading: true });
          
          try {
            const result = await cognitoAuth.signIn(email, password);
            
            if (result.success && result.user && result.tokens) {
              get().setUser(result.user);
              get().setTokens(result.tokens);
              
              errorHandler.info('User signed in', { email });
              return { success: true };
            }
            
            return { 
              success: false, 
              challengeName: result.challengeName,
              session: result.session,
            };
          } catch (error) {
            errorHandler.error('Sign in failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },
        
        signUp: async (params) => {
          set({ isLoading: true });
          
          try {
            const result = await cognitoAuth.signUp({
              username: params.username,
              password: params.password,
              attributes: {
                email: params.attributes.email || params.username,
                ...params.attributes
              }
            });
            errorHandler.info('User signed up', { email: params.username });
            return result;
          } catch (error) {
            errorHandler.error('Sign up failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },
        
        signOut: async () => {
          set({ isLoading: true });
          
          try {
            await cognitoAuth.signOut();
            get().clearAuth();
            errorHandler.info('User signed out');
          } catch (error) {
            errorHandler.error('Sign out failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },
        
        refreshSession: async () => {
          const refreshToken = tokenManager.getRefreshToken();
          if (!refreshToken) return false;
          
          try {
            const tokens = await cognitoAuth.refreshSession(refreshToken);
            if (tokens) {
              get().setTokens(tokens);
              return true;
            }
            return false;
          } catch (error) {
            errorHandler.warn('Token refresh failed', error instanceof Error ? error : new Error(String(error)));
            get().clearAuth();
            return false;
          }
        },
        
        verifyEmail: async (email, code) => {
          try {
            const result = await cognitoAuth.verifyEmail(email, code);
            return result;
          } catch (error) {
            errorHandler.error('Email verification failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        resendVerificationCode: async (email) => {
          try {
            const result = await cognitoAuth.resendVerificationCode(email);
            return result;
          } catch (error) {
            errorHandler.error('Resend verification code failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        forgotPassword: async (email) => {
          try {
            const result = await cognitoAuth.forgotPassword(email);
            return result;
          } catch (error) {
            errorHandler.error('Forgot password request failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        confirmForgotPassword: async (email, code, newPassword) => {
          try {
            const result = await cognitoAuth.confirmForgotPassword(email, code, newPassword);
            return result;
          } catch (error) {
            errorHandler.error('Password reset failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        changePassword: async (oldPassword, newPassword) => {
          try {
            const accessToken = tokenManager.getAccessToken();
            if (!accessToken) throw new Error('No access token');
            
            const result = await cognitoAuth.changePassword(accessToken, oldPassword, newPassword);
            return result;
          } catch (error) {
            errorHandler.error('Password change failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        setupMFA: async () => {
          try {
            const accessToken = tokenManager.getAccessToken();
            if (!accessToken) throw new Error('No access token');
            
            const result = await cognitoAuth.setupMFA(accessToken);
            return result;
          } catch (error) {
            errorHandler.error('MFA setup failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
          }
        },
        
        verifyMFA: async (code, session) => {
          try {
            const result = await cognitoAuth.verifyMFA(session || '', code);
            if (result) {
              get().setTokens(result);
              return true;
            }
            return false;
          } catch (error) {
            errorHandler.error('MFA verification failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        // Utility methods
        isTokenExpired: () => {
          return tokenManager.isTokenExpired();
        },
        
        getUserAttribute: (attribute) => {
          const userInfo = tokenManager.getUserInfo();
          if (!userInfo) return undefined;
          return userInfo[attribute];
        },
        
        hasRole: (role) => {
          return tokenManager.hasRole(role);
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          // セキュリティ向上: トークンをlocalStorageに保存しない
          // 本番環境ではhttpOnly cookieまたはsecure sessionStorageを使用
          // accessToken: state.accessToken,
          // idToken: state.idToken,
          // refreshToken: state.refreshToken,
          tokenExpiry: state.tokenExpiry,
        }),
      }
    )
  )
);

// Auto-refresh token before expiry with cleanup
let tokenRefreshInterval: NodeJS.Timeout | null = null;

if (typeof window !== 'undefined') {
  // Clear any existing interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }
  
  // Set up new interval to check for token refresh needs
  tokenRefreshInterval = setInterval(() => {
    const store = useAuthStore.getState();
    if (store.isAuthenticated && tokenManager.needsRefresh()) {
      store.refreshSession();
    }
  }, 60000); // Check every minute
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  });
}

// Export cleanup function
export const cleanupAuthStore = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};