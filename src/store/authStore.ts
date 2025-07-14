/**
 * Authentication Store using Zustand
 * Manages user authentication state and JWT tokens
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { errorHandler } from '@/utils/errorHandler';

interface User {
  id: string;
  email: string;
  fullName?: string;
  vjHandle?: string;
  tier: 'free' | 'premium' | 'admin';
  emailVerified: boolean;
  groups?: string[];
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

// Mock implementation for development
// Replace with actual AWS Amplify Auth calls in production
const mockAuth = {
  signIn: async (email: string, password: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock validation
    if (email === 'test@example.com' && password === 'Test123!@#') {
      return {
        success: true,
        user: {
          id: 'mock-user-123',
          email,
          fullName: 'Test User',
          vjHandle: 'test_vj',
          tier: 'premium' as const,
          emailVerified: true,
          groups: ['premium'],
        },
        tokens: {
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600,
        },
      };
    }
    
    throw new Error('NotAuthorizedException');
  },
  
  signUp: async (params: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, userSub: 'mock-user-sub' };
  },
  
  signOut: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  },
  
  refreshSession: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  },
};

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
          const expiry = Date.now() + expiresIn * 1000;
          set({
            accessToken,
            idToken,
            refreshToken,
            tokenExpiry: expiry,
            isAuthenticated: true,
          });
        },
        
        clearAuth: () => set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          idToken: null,
          refreshToken: null,
          tokenExpiry: null,
        }),
        
        // Auth operations
        signIn: async (email, password) => {
          set({ isLoading: true });
          
          try {
            const result = await mockAuth.signIn(email, password);
            
            if (result.success && result.user && result.tokens) {
              get().setUser(result.user);
              get().setTokens(result.tokens);
              
              errorHandler.info('User signed in', { email });
              return { success: true };
            }
            
            return { 
              success: false, 
              challengeName: (result as any).challengeName,
              session: (result as any).session,
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
            const result = await mockAuth.signUp(params);
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
            await mockAuth.signOut();
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
          const { refreshToken } = get();
          if (!refreshToken) return false;
          
          try {
            const result = await mockAuth.refreshSession();
            if (result) {
              // Update tokens with new values
              // In production, this would come from the refresh response
              get().setTokens({
                accessToken: 'new-access-token',
                idToken: 'new-id-token',
                refreshToken: refreshToken,
                expiresIn: 3600,
              });
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
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          } catch (error) {
            errorHandler.error('Email verification failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        resendVerificationCode: async (email) => {
          try {
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          } catch (error) {
            errorHandler.error('Resend verification code failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        forgotPassword: async (email) => {
          try {
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          } catch (error) {
            errorHandler.error('Forgot password request failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        confirmForgotPassword: async (email, code, newPassword) => {
          try {
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          } catch (error) {
            errorHandler.error('Password reset failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        changePassword: async (oldPassword, newPassword) => {
          try {
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          } catch (error) {
            errorHandler.error('Password change failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        setupMFA: async () => {
          try {
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              secret: 'MOCK_SECRET_KEY',
              qrCode: 'data:image/png;base64,mockQRCode',
            };
          } catch (error) {
            errorHandler.error('MFA setup failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
          }
        },
        
        verifyMFA: async (code, session) => {
          try {
            // Mock implementation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          } catch (error) {
            errorHandler.error('MFA verification failed', error instanceof Error ? error : new Error(String(error)));
            return false;
          }
        },
        
        // Utility methods
        isTokenExpired: () => {
          const { tokenExpiry } = get();
          if (!tokenExpiry) return true;
          return Date.now() > tokenExpiry;
        },
        
        getUserAttribute: (attribute) => {
          const { user } = get();
          if (!user) return undefined;
          return (user as any)[attribute];
        },
        
        hasRole: (role) => {
          const { user } = get();
          if (!user) return false;
          return user.groups?.includes(role) || user.tier === role;
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          idToken: state.idToken,
          refreshToken: state.refreshToken,
          tokenExpiry: state.tokenExpiry,
        }),
      }
    )
  )
);

// Auto-refresh token before expiry
if (typeof window !== 'undefined') {
  setInterval(() => {
    const store = useAuthStore.getState();
    if (store.isAuthenticated && store.isTokenExpired()) {
      store.refreshSession();
    }
  }, 60000); // Check every minute
}