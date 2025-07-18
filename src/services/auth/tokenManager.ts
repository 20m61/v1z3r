/**
 * JWT Token Manager
 * Handles secure storage and management of authentication tokens
 */

import { errorHandler } from '@/utils/errorHandler';

interface TokenStorage {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
}

interface DecodedToken {
  exp: number;
  iat: number;
  sub: string;
  [key: string]: any;
}

class TokenManager {
  private static STORAGE_KEYS = {
    ACCESS_TOKEN: 'v1z3r_access_token',
    ID_TOKEN: 'v1z3r_id_token',
    REFRESH_TOKEN: 'v1z3r_refresh_token',
    TOKEN_EXPIRY: 'v1z3r_token_expiry',
  };

  private memoryStorage: TokenStorage = {
    accessToken: null,
    idToken: null,
    refreshToken: null,
    tokenExpiry: null,
  };

  /**
   * Store tokens securely
   * In production, consider using httpOnly cookies for refresh tokens
   */
  setTokens(tokens: {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
  }): void {
    try {
      const expiry = Date.now() + tokens.expiresIn * 1000;

      // Store in memory (most secure for SPA)
      this.memoryStorage = {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: expiry,
      };

      // For development, also store in sessionStorage
      // In production, only store non-sensitive data
      if (typeof window !== 'undefined') {
        if (process.env.NODE_ENV === 'development') {
          sessionStorage.setItem(TokenManager.STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
          sessionStorage.setItem(TokenManager.STORAGE_KEYS.ID_TOKEN, tokens.idToken);
          sessionStorage.setItem(TokenManager.STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
        }
        sessionStorage.setItem(TokenManager.STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString());
      }

      errorHandler.info('Tokens stored successfully');
    } catch (error) {
      errorHandler.error('Failed to store tokens', error as Error);
      throw error;
    }
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    // First check memory storage
    if (this.memoryStorage.accessToken && !this.isTokenExpired()) {
      return this.memoryStorage.accessToken;
    }

    // Fallback to sessionStorage in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const token = sessionStorage.getItem(TokenManager.STORAGE_KEYS.ACCESS_TOKEN);
      if (token && !this.isTokenExpired()) {
        return token;
      }
    }

    return null;
  }

  /**
   * Get ID token
   */
  getIdToken(): string | null {
    // First check memory storage
    if (this.memoryStorage.idToken && !this.isTokenExpired()) {
      return this.memoryStorage.idToken;
    }

    // Fallback to sessionStorage in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const token = sessionStorage.getItem(TokenManager.STORAGE_KEYS.ID_TOKEN);
      if (token && !this.isTokenExpired()) {
        return token;
      }
    }

    return null;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    // First check memory storage
    if (this.memoryStorage.refreshToken) {
      return this.memoryStorage.refreshToken;
    }

    // Fallback to sessionStorage in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      return sessionStorage.getItem(TokenManager.STORAGE_KEYS.REFRESH_TOKEN);
    }

    return null;
  }

  /**
   * Check if tokens are expired
   */
  isTokenExpired(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;
    
    // Add 30 second buffer to account for clock skew
    return Date.now() > (expiry - 30000);
  }

  /**
   * Get token expiry time
   */
  private getTokenExpiry(): number | null {
    // First check memory storage
    if (this.memoryStorage.tokenExpiry) {
      return this.memoryStorage.tokenExpiry;
    }

    // Fallback to sessionStorage
    if (typeof window !== 'undefined') {
      const expiry = sessionStorage.getItem(TokenManager.STORAGE_KEYS.TOKEN_EXPIRY);
      return expiry ? parseInt(expiry, 10) : null;
    }

    return null;
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    // Clear memory storage
    this.memoryStorage = {
      accessToken: null,
      idToken: null,
      refreshToken: null,
      tokenExpiry: null,
    };

    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      Object.values(TokenManager.STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
      });
    }

    errorHandler.info('Tokens cleared');
  }

  /**
   * Decode JWT token without verification
   * For production, consider using a proper JWT library
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = parts[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      
      return decoded;
    } catch (error) {
      errorHandler.warn('Failed to decode token', error as Error);
      return null;
    }
  }

  /**
   * Get user info from ID token
   */
  getUserInfo(): any | null {
    const idToken = this.getIdToken();
    if (!idToken) return null;

    const decoded = this.decodeToken(idToken);
    if (!decoded) return null;

    return {
      id: decoded.sub,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      name: decoded.name,
      vjHandle: decoded['custom:vj_handle'],
      tier: decoded['custom:tier'] || 'free',
      groups: decoded['cognito:groups'] || [],
    };
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const userInfo = this.getUserInfo();
    if (!userInfo) return false;

    return userInfo.groups?.includes(role) || userInfo.tier === role;
  }

  /**
   * Get time until token expires in seconds
   */
  getTimeUntilExpiry(): number {
    const expiry = this.getTokenExpiry();
    if (!expiry) return 0;

    const timeLeft = Math.max(0, expiry - Date.now());
    return Math.floor(timeLeft / 1000);
  }

  /**
   * Check if tokens need refresh (within 5 minutes of expiry)
   */
  needsRefresh(): boolean {
    const timeUntilExpiry = this.getTimeUntilExpiry();
    return timeUntilExpiry > 0 && timeUntilExpiry < 300; // 5 minutes
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Export types
export type { TokenStorage, DecodedToken };