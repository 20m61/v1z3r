/**
 * Unit tests for AuthGuard component
 * Tests authentication checks, redirects, and loading states
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { AuthGuard } from '../AuthGuard';
import { useAuthStore } from '@/store/authStore';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Zustand store
jest.mock('@/store/authStore');

describe('AuthGuard', () => {
  const mockRouter = {
    push: jest.fn(),
    pathname: '/dashboard',
    asPath: '/dashboard',
    isReady: true,
  };

  const mockAuthStore = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    refreshSession: jest.fn(),
    isTokenExpired: jest.fn(),
  };

  const TestChild = () => <div>Protected Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthStore);
  });

  it('shows loading state while checking authentication', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isLoading: true,
    });

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/auth/login?redirect=%2Fdashboard'
      );
    });
    
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: true,
      user: { id: 'user-123', email: 'test@example.com' },
    });

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  // Note: Current AuthGuard implementation doesn't handle public routes

  it('checks role-based access', async () => {
    const hasRoleMock = jest.fn().mockReturnValue(false);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: true,
      user: { 
        id: 'user-123', 
        email: 'test@example.com',
        tier: 'free'
      },
      hasRole: hasRoleMock,
    });

    render(
      <AuthGuard requiredRole="premium">
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/unauthorized');
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows access with correct role', () => {
    const hasRoleMock = jest.fn().mockReturnValue(true);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: true,
      user: { 
        id: 'user-123', 
        email: 'test@example.com',
        tier: 'premium'
      },
      hasRole: hasRoleMock,
    });

    render(
      <AuthGuard requiredRole="premium">
        <TestChild />
      </AuthGuard>
    );

    expect(hasRoleMock).toHaveBeenCalledWith('premium');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('refreshes expired token', async () => {
    mockAuthStore.isTokenExpired.mockReturnValue(true);
    mockAuthStore.refreshSession.mockResolvedValue(true);
    
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: true,
      user: { id: 'user-123', email: 'test@example.com' },
    });

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockAuthStore.refreshSession).toHaveBeenCalled();
    });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects if token refresh fails', async () => {
    mockAuthStore.isTokenExpired.mockReturnValue(true);
    mockAuthStore.refreshSession.mockResolvedValue(false);
    
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: true,
      user: { id: 'user-123', email: 'test@example.com' },
    });

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockAuthStore.refreshSession).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/auth/login?redirect=%2Fdashboard'
      );
    });
  });

  it('shows loading state during auth check', () => {
    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles custom loading component', () => {
    const CustomLoader = () => <div>Custom Loading...</div>;
    
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isLoading: true,
    });

    render(
      <AuthGuard loadingComponent={<CustomLoader />}>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
  });

  it('handles fallback URL', async () => {
    render(
      <AuthGuard fallbackUrl="/home">
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/home?redirect=%2Fdashboard'
      );
    });
  });

  it('preserves query parameters in return URL', async () => {
    mockRouter.asPath = '/dashboard?tab=settings';

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/auth/login?redirect=%2Fdashboard%3Ftab%3Dsettings'
      );
    });
  });

  // Note: Current AuthGuard implementation doesn't skip auth pages

  // Note: Current AuthGuard implementation doesn't support multiple roles
});