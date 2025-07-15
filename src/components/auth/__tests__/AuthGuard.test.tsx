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
        '/auth/login?returnUrl=%2Fdashboard'
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

  it('allows access to public routes', () => {
    mockRouter.pathname = '/';

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('checks role-based access', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isAuthenticated: true,
      user: { 
        id: 'user-123', 
        email: 'test@example.com',
        tier: 'free'
      },
      hasRole: jest.fn().mockReturnValue(false),
    });

    render(
      <AuthGuard requiredRole="premium">
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
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
        '/auth/login?returnUrl=%2Fdashboard'
      );
    });
  });

  it('waits for router to be ready', () => {
    mockRouter.isReady = false;

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
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
        '/home?returnUrl=%2Fdashboard'
      );
    });
  });

  it('preserves query parameters in return URL', async () => {
    mockRouter.pathname = '/dashboard';
    mockRouter.query = { tab: 'settings' };

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/auth/login?returnUrl=%2Fdashboard%3Ftab%3Dsettings'
      );
    });
  });

  it('skips auth check for auth pages', () => {
    mockRouter.pathname = '/auth/login';

    render(
      <AuthGuard>
        <TestChild />
      </AuthGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('handles multiple required roles', () => {
    const hasRoleMock = jest.fn()
      .mockReturnValueOnce(true)  // Has 'premium'
      .mockReturnValueOnce(false); // Doesn't have 'admin'
      
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
      <AuthGuard requiredRole={['premium', 'admin']}>
        <TestChild />
      </AuthGuard>
    );

    expect(hasRoleMock).toHaveBeenCalledWith('premium');
    expect(hasRoleMock).toHaveBeenCalledWith('admin');
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });
});