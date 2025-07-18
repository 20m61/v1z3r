/**
 * API Authentication Interceptor
 * Automatically adds authentication headers to API requests
 */

import { tokenManager } from '@/services/auth/tokenManager';
import { useAuthStore } from '@/store/authStore';
import { errorHandler } from '@/utils/errorHandler';

export interface ApiRequestConfig extends RequestInit {
  skipAuth?: boolean;
  useIdToken?: boolean;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

class AuthInterceptor {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  }

  /**
   * Make authenticated API request
   */
  async request<T = any>(
    url: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Check if auth is required
      if (!config.skipAuth) {
        // Get token and check if it needs refresh
        const token = config.useIdToken 
          ? tokenManager.getIdToken() 
          : tokenManager.getAccessToken();

        if (!token) {
          errorHandler.warn('No authentication token available');
          // Attempt to refresh if we have a refresh token
          if (tokenManager.getRefreshToken()) {
            await this.refreshTokenIfNeeded();
          } else {
            throw new Error('Authentication required');
          }
        } else if (tokenManager.needsRefresh()) {
          await this.refreshTokenIfNeeded();
        }
      }

      // Make the request with auth headers
      const response = await this.executeRequest(url, config);
      
      // Handle 401 Unauthorized
      if (response.status === 401 && !config.skipAuth) {
        errorHandler.warn('Request returned 401, attempting token refresh');
        
        // Try to refresh token and retry request once
        const refreshed = await this.refreshTokenIfNeeded();
        if (refreshed) {
          const retryResponse = await this.executeRequest(url, config);
          return this.handleResponse<T>(retryResponse);
        }
        
        // If refresh failed, redirect to login
        this.handleAuthError();
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      errorHandler.error('API request failed', error as Error);
      return {
        error: error instanceof Error ? error.message : 'Request failed',
        status: 0,
        ok: false,
      };
    }
  }

  /**
   * Execute the actual request with headers
   */
  private async executeRequest(
    url: string,
    config: ApiRequestConfig
  ): Promise<Response> {
    const { skipAuth, useIdToken, headers = {}, ...restConfig } = config;

    // Build headers
    const requestHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add auth header if needed
    if (!skipAuth) {
      const token = useIdToken 
        ? tokenManager.getIdToken() 
        : tokenManager.getAccessToken();
      
      if (token) {
        (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    // Build full URL
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    return fetch(fullUrl, {
      ...restConfig,
      headers: requestHeaders,
    });
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: any;
    try {
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (error) {
      errorHandler.warn('Failed to parse response', error as Error);
      data = null;
    }

    if (!response.ok) {
      const error = data?.message || data?.error || response.statusText;
      errorHandler.warn(`API error: ${response.status} - ${error}`);
      
      return {
        error,
        status: response.status,
        ok: false,
        data: data,
      };
    }

    return {
      data,
      status: response.status,
      ok: true,
    };
  }

  /**
   * Refresh authentication token
   */
  private async refreshTokenIfNeeded(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = useAuthStore.getState().refreshSession();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(): void {
    errorHandler.error('Authentication failed, redirecting to login');
    
    // Clear auth state
    useAuthStore.getState().clearAuth();
    tokenManager.clearTokens();
    
    // Redirect to login if in browser
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const loginUrl = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
      window.location.href = loginUrl;
    }
  }

  /**
   * Convenience methods for common HTTP methods
   */
  async get<T = any>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new AuthInterceptor();

// Export types are already exported above with the interface declarations