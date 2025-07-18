/**
 * Authentication Middleware Tests
 */

import { AuthMiddleware } from '../authMiddleware';
import { tokenManager } from '@/services/auth/tokenManager';

// Mock tokenManager
jest.mock('@/services/auth/tokenManager', () => ({
  tokenManager: {
    getUserInfo: jest.fn(),
    decodeToken: jest.fn(),
  },
}));

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(() => ({ status: 200 })),
    redirect: jest.fn((url) => ({ 
      status: 307, 
      headers: new Map([['location', url.toString()]]) 
    })),
    json: jest.fn((data, init) => ({ 
      status: init?.status || 200,
      json: () => Promise.resolve(data)
    })),
  },
}));

describe('AuthMiddleware', () => {
  const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isProtectedRoute', () => {
    it('should identify protected routes', () => {
      expect(AuthMiddleware.isProtectedRoute('/dashboard')).toBe(true);
      expect(AuthMiddleware.isProtectedRoute('/visualizer')).toBe(true);
      expect(AuthMiddleware.isProtectedRoute('/admin')).toBe(true);
      expect(AuthMiddleware.isProtectedRoute('/admin/users')).toBe(true);
    });

    it('should identify public routes', () => {
      expect(AuthMiddleware.isProtectedRoute('/')).toBe(false);
      expect(AuthMiddleware.isProtectedRoute('/auth/login')).toBe(false);
      expect(AuthMiddleware.isProtectedRoute('/about')).toBe(false);
    });
  });

  describe('isPublicRoute', () => {
    it('should identify public routes', () => {
      expect(AuthMiddleware.isPublicRoute('/')).toBe(true);
      expect(AuthMiddleware.isPublicRoute('/auth/login')).toBe(true);
      expect(AuthMiddleware.isPublicRoute('/auth/register')).toBe(true);
      expect(AuthMiddleware.isPublicRoute('/pricing')).toBe(true);
    });

    it('should identify protected routes as not public', () => {
      expect(AuthMiddleware.isPublicRoute('/dashboard')).toBe(false);
      expect(AuthMiddleware.isPublicRoute('/admin')).toBe(false);
    });
  });

  describe('getRouteConfig', () => {
    it('should return route configuration', () => {
      const dashboardConfig = AuthMiddleware.getRouteConfig('/dashboard');
      expect(dashboardConfig).toEqual({ requireAuth: true });

      const adminConfig = AuthMiddleware.getRouteConfig('/admin');
      expect(adminConfig).toEqual({
        requireAuth: true,
        requireRoles: ['admin'],
        requireTier: 'admin',
      });
    });

    it('should return null for unprotected routes', () => {
      expect(AuthMiddleware.getRouteConfig('/')).toBeNull();
      expect(AuthMiddleware.getRouteConfig('/auth/login')).toBeNull();
    });

    it('should match pattern routes', () => {
      const adminSubrouteConfig = AuthMiddleware.getRouteConfig('/admin/users');
      expect(adminSubrouteConfig).toEqual({
        requireAuth: true,
        requireRoles: ['admin'],
        requireTier: 'admin',
      });
    });
  });

  describe('validateAccess', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      tier: 'premium',
      groups: ['premium'],
    };

    it('should allow access to public routes', () => {
      const result = AuthMiddleware.validateAccess('/', null);
      expect(result).toEqual({ allowed: true });
    });

    it('should deny access when not authenticated', () => {
      const result = AuthMiddleware.validateAccess('/dashboard', null);
      expect(result).toEqual({
        allowed: false,
        reason: 'Authentication required',
      });
    });

    it('should allow authenticated user to basic protected routes', () => {
      const result = AuthMiddleware.validateAccess('/dashboard', mockUser);
      expect(result).toEqual({ allowed: true });
    });

    it('should check role requirements', () => {
      const adminUser = { ...mockUser, groups: ['admin'], tier: 'admin' };
      const regularUser = { ...mockUser, groups: ['user'], tier: 'free' };

      expect(AuthMiddleware.validateAccess('/admin', adminUser)).toEqual({
        allowed: true,
      });

      expect(AuthMiddleware.validateAccess('/admin', regularUser)).toEqual({
        allowed: false,
        reason: 'Requires one of these roles: admin',
      });
    });

    it('should check tier requirements', () => {
      const premiumUser = { ...mockUser, tier: 'premium' };
      const freeUser = { ...mockUser, tier: 'free' };

      expect(AuthMiddleware.validateAccess('/premium', premiumUser)).toEqual({
        allowed: true,
      });

      expect(AuthMiddleware.validateAccess('/premium', freeUser)).toEqual({
        allowed: false,
        reason: 'Requires premium tier or higher',
      });
    });

    it('should handle tier hierarchy correctly', () => {
      const adminUser = { ...mockUser, tier: 'admin' };
      
      // Admin should have access to premium content
      expect(AuthMiddleware.validateAccess('/premium', adminUser)).toEqual({
        allowed: true,
      });
    });
  });

  describe('handleUnauthorized', () => {
    it('should return 401 for API routes without auth', () => {
      const response = AuthMiddleware.handleUnauthorized(
        '/api/protected',
        'Authentication required'
      );
      
      expect(response.status).toBe(401);
    });

    it('should return 403 for API routes with insufficient permissions', () => {
      const response = AuthMiddleware.handleUnauthorized(
        '/api/admin',
        'Requires admin role'
      );
      
      expect(response.status).toBe(403);
    });

    it('should redirect to login for page routes', () => {
      const response = AuthMiddleware.handleUnauthorized('/dashboard');
      
      expect(response.status).toBe(307); // Redirect status
      expect(response.headers.get('location')).toContain('/auth/login?redirect=%2Fdashboard');
    });

    it('should include error message in redirect for permission issues', () => {
      const response = AuthMiddleware.handleUnauthorized(
        '/admin',
        'Requires admin tier or higher'
      );
      
      const location = response.headers.get('location');
      expect(location).toContain('redirect=%2Fadmin');
      expect(location).toContain('error=Requires+admin+tier+or+higher');
    });
  });
});