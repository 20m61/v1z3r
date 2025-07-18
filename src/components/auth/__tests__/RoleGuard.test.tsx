/**
 * Role Guard Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { RoleGuard, useRoleCheck } from '../RoleGuard';
import { useAuthStore } from '@/store/authStore';
import { tokenManager } from '@/services/auth/tokenManager';
import { renderHook } from '@testing-library/react';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/services/auth/tokenManager', () => ({
  tokenManager: {
    getUserInfo: jest.fn(),
    hasRole: jest.fn(),
  },
}));

describe('RoleGuard', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
    pathname: '/test',
  };

  const mockAuthStore = {
    isAuthenticated: true,
    user: {
      id: 'user-123',
      email: 'test@example.com',
      tier: 'premium',
    },
    hasRole: jest.fn(),
  };

  const mockUserInfo = {
    id: 'user-123',
    email: 'test@example.com',
    tier: 'premium',
    groups: ['premium'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthStore);
    (tokenManager.getUserInfo as jest.Mock).mockReturnValue(mockUserInfo);
    (tokenManager.hasRole as jest.Mock).mockImplementation((role) => 
      mockUserInfo.groups.includes(role) || mockUserInfo.tier === role
    );
  });

  describe('Authentication Check', () => {
    it('should redirect to login when not authenticated', async () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
        user: null,
      });

      render(
        <RoleGuard>
          <div>Protected Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          '/auth/login?redirect=%2Ftest'
        );
      });
    });

    it('should show loading state initially', () => {
      // Set user info to null to trigger loading state
      (tokenManager.getUserInfo as jest.Mock).mockReturnValue(null);
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: null, // null indicates loading
        user: null,
      });
      
      const { container } = render(
        <RoleGuard>
          <div>Protected Content</div>
        </RoleGuard>
      );

      // Look for spinner by class name
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should render children when authenticated', async () => {
      render(
        <RoleGuard>
          <div>Protected Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });

  describe('Role Requirements', () => {
    it('should allow access with required role', async () => {
      (tokenManager.hasRole as jest.Mock).mockReturnValue(true);

      render(
        <RoleGuard requiredRoles={['premium']}>
          <div>Premium Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Premium Content')).toBeInTheDocument();
      });
    });

    it('should deny access without required role', async () => {
      (tokenManager.hasRole as jest.Mock).mockReturnValue(false);

      render(
        <RoleGuard requiredRoles={['admin']}>
          <div>Admin Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      });
    });

    it('should check multiple roles (OR logic)', async () => {
      (tokenManager.hasRole as jest.Mock).mockImplementation((role) => 
        role === 'premium'
      );

      render(
        <RoleGuard requiredRoles={['admin', 'premium']}>
          <div>Admin or Premium Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin or Premium Content')).toBeInTheDocument();
      });
    });
  });

  describe('Tier Requirements', () => {
    it('should allow access with sufficient tier', async () => {
      render(
        <RoleGuard requiredTier="premium">
          <div>Premium Tier Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Premium Tier Content')).toBeInTheDocument();
      });
    });

    it('should deny access with insufficient tier', async () => {
      (tokenManager.getUserInfo as jest.Mock).mockReturnValue({
        ...mockUserInfo,
        tier: 'free',
      });

      render(
        <RoleGuard requiredTier="premium">
          <div>Premium Tier Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.getByText(/requires premium tier or higher/i)).toBeInTheDocument();
      });
    });

    it('should handle tier hierarchy correctly', async () => {
      (tokenManager.getUserInfo as jest.Mock).mockReturnValue({
        ...mockUserInfo,
        tier: 'admin',
      });

      render(
        <RoleGuard requiredTier="premium">
          <div>Premium Tier Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Premium Tier Content')).toBeInTheDocument();
      });
    });
  });

  describe('Fallback and Redirect', () => {
    it('should render custom fallback when provided', async () => {
      (tokenManager.hasRole as jest.Mock).mockReturnValue(false);

      render(
        <RoleGuard 
          requiredRoles={['admin']}
          fallback={<div>Custom Fallback</div>}
        >
          <div>Admin Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
        expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      });
    });

    it('should redirect to custom path when specified', async () => {
      (tokenManager.hasRole as jest.Mock).mockReturnValue(false);

      render(
        <RoleGuard 
          requiredRoles={['admin']}
          redirectTo="/upgrade"
        >
          <div>Admin Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/upgrade');
      });
    });

    it('should handle back navigation', async () => {
      (tokenManager.hasRole as jest.Mock).mockReturnValue(false);

      render(
        <RoleGuard requiredRoles={['admin']}>
          <div>Admin Content</div>
        </RoleGuard>
      );

      await waitFor(() => {
        const backButton = screen.getByText('Go Back');
        expect(backButton).toBeInTheDocument();
      });

      const backButton = screen.getByText('Go Back');
      backButton.click();

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });
});

describe('useRoleCheck', () => {
  const mockAuthStore = {
    isAuthenticated: true,
    hasRole: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthStore);
  });

  it('should check single role', () => {
    mockAuthStore.hasRole.mockReturnValue(true);
    
    const { result } = renderHook(() => useRoleCheck());
    
    expect(result.current.checkRole('admin')).toBe(true);
    expect(mockAuthStore.hasRole).toHaveBeenCalledWith('admin');
  });

  it('should return false when not authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: false,
    });
    
    const { result } = renderHook(() => useRoleCheck());
    
    expect(result.current.checkRole('admin')).toBe(false);
    expect(mockAuthStore.hasRole).not.toHaveBeenCalled();
  });

  it('should check multiple roles', () => {
    mockAuthStore.hasRole.mockImplementation((role) => role === 'premium');
    
    const { result } = renderHook(() => useRoleCheck());
    
    expect(result.current.checkRoles(['admin', 'premium'])).toBe(true);
    expect(result.current.checkRoles(['admin', 'moderator'])).toBe(false);
  });

  it('should check tier requirements', () => {
    (tokenManager.getUserInfo as jest.Mock).mockReturnValue({
      tier: 'premium',
    });
    
    const { result } = renderHook(() => useRoleCheck());
    
    expect(result.current.checkTier('free')).toBe(true);
    expect(result.current.checkTier('premium')).toBe(true);
    expect(result.current.checkTier('admin')).toBe(false);
  });

  it('should provide convenience properties', () => {
    mockAuthStore.hasRole.mockImplementation((role) => role === 'admin');
    (tokenManager.getUserInfo as jest.Mock).mockReturnValue({
      tier: 'admin',
    });
    
    const { result } = renderHook(() => useRoleCheck());
    
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isPremium).toBe(true);
  });
});