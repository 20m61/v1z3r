/**
 * Authentication Middleware
 * Protects routes and enforces role-based access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenManager } from '@/services/auth/tokenManager';

export interface RouteConfig {
  requireAuth: boolean;
  requireRoles?: string[];
  requireTier?: 'free' | 'premium' | 'admin';
  redirectTo?: string;
}

// Route protection configuration
const PROTECTED_ROUTES: Record<string, RouteConfig> = {
  '/dashboard': { requireAuth: true },
  '/visualizer': { requireAuth: true },
  '/presets': { requireAuth: true },
  '/settings': { requireAuth: true },
  '/admin': { requireAuth: true, requireRoles: ['admin'], requireTier: 'admin' },
  '/premium': { requireAuth: true, requireTier: 'premium' },
};

// Public routes that don't require auth
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify',
  '/about',
  '/pricing',
  '/docs',
];

export class AuthMiddleware {
  /**
   * Check if route requires authentication
   */
  static isProtectedRoute(pathname: string): boolean {
    // Check exact match
    if (PROTECTED_ROUTES[pathname]) {
      return true;
    }

    // Check pattern match (e.g., /admin/*)
    return Object.keys(PROTECTED_ROUTES).some(route => 
      pathname.startsWith(route + '/')
    );
  }

  /**
   * Check if route is public
   */
  static isPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    );
  }

  /**
   * Get route configuration
   */
  static getRouteConfig(pathname: string): RouteConfig | null {
    // Check exact match
    if (PROTECTED_ROUTES[pathname]) {
      return PROTECTED_ROUTES[pathname];
    }

    // Check pattern match
    const matchedRoute = Object.entries(PROTECTED_ROUTES).find(([route]) => 
      pathname.startsWith(route + '/')
    );

    return matchedRoute ? matchedRoute[1] : null;
  }

  /**
   * Validate access to route
   */
  static validateAccess(pathname: string, userInfo: any): {
    allowed: boolean;
    reason?: string;
  } {
    const config = this.getRouteConfig(pathname);
    
    // Public route - always allowed
    if (!config || !config.requireAuth) {
      return { allowed: true };
    }

    // Check if user is authenticated
    if (!userInfo) {
      return { allowed: false, reason: 'Authentication required' };
    }

    // Check role requirements
    if (config.requireRoles && config.requireRoles.length > 0) {
      const hasRequiredRole = config.requireRoles.some(role => 
        userInfo.groups?.includes(role) || userInfo.tier === role
      );
      
      if (!hasRequiredRole) {
        return { 
          allowed: false, 
          reason: `Requires one of these roles: ${config.requireRoles.join(', ')}` 
        };
      }
    }

    // Check tier requirements
    if (config.requireTier) {
      const tierHierarchy = { free: 0, premium: 1, admin: 2 };
      const userTierLevel = tierHierarchy[userInfo.tier || 'free'];
      const requiredTierLevel = tierHierarchy[config.requireTier];

      if (userTierLevel < requiredTierLevel) {
        return { 
          allowed: false, 
          reason: `Requires ${config.requireTier} tier or higher` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Handle unauthorized access
   */
  static handleUnauthorized(
    pathname: string,
    reason: string = 'Authentication required'
  ): NextResponse {
    // For API routes, return 401/403
    if (pathname.startsWith('/api/')) {
      const status = reason === 'Authentication required' ? 401 : 403;
      return NextResponse.json(
        { error: reason },
        { status }
      );
    }

    // For pages, redirect to login
    const url = new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    url.searchParams.set('redirect', pathname);
    
    if (reason !== 'Authentication required') {
      url.searchParams.set('error', reason);
    }

    return NextResponse.redirect(url);
  }
}

/**
 * Next.js middleware function
 */
export function authMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for static assets and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return null;
  }

  // Check if route is protected
  if (!AuthMiddleware.isProtectedRoute(pathname)) {
    return null;
  }

  // Get user info from token (client-side check)
  // Note: For production, validate JWT server-side
  let userInfo = null;
  
  if (typeof window !== 'undefined') {
    userInfo = tokenManager.getUserInfo();
  } else {
    // Server-side: extract token from cookies or headers
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      // In production, verify JWT signature here
      const decoded = tokenManager.decodeToken(token);
      if (decoded) {
        userInfo = {
          id: decoded.sub,
          email: decoded.email,
          tier: decoded['custom:tier'] || 'free',
          groups: decoded['cognito:groups'] || [],
        };
      }
    }
  }

  // Validate access
  const { allowed, reason } = AuthMiddleware.validateAccess(pathname, userInfo);

  if (!allowed) {
    return AuthMiddleware.handleUnauthorized(pathname, reason);
  }

  return null;
}

// Export types
export type { RouteConfig };