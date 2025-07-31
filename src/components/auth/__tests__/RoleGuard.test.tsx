import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock dependencies before importing components
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    pathname: '/test-path',
    query: {},
    asPath: '/test-path',
  }),
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

// Import after mocks are set up
import { RoleGuard } from '../RoleGuard';
import { useAuthStore } from '@/store/authStore';
import { tokenManager } from '@/services/auth/tokenManager';

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>;

describe('RoleGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should exist and be testable', () => {
    expect(RoleGuard).toBeDefined();
  });

  it('should handle unauthenticated user', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as any);

    render(
      <RoleGuard>
        <div>Protected Content</div>
      </RoleGuard>
    );

    // Component should handle unauthenticated state
    expect(mockPush).toHaveBeenCalledWith('/auth/login?redirect=%2Ftest-path');
  });

  it('should render loading state for authenticated user', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
    } as any);

    mockTokenManager.getUserInfo.mockReturnValue({
      id: '1',
      email: 'test@example.com',
      roles: ['user'],
      tier: 'free',
    });

    const { container } = render(
      <RoleGuard>
        <div>Protected Content</div>
      </RoleGuard>
    );

    // Should render something (loading or content)
    expect(container.firstChild).toBeTruthy();
  });

  it('should handle role check with authenticated user', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
    } as any);

    mockTokenManager.getUserInfo.mockReturnValue({
      id: '1',
      email: 'test@example.com',
      roles: ['admin'],
      tier: 'admin',
    });
    mockTokenManager.hasRole.mockReturnValue(true);

    const { container } = render(
      <RoleGuard requiredRoles={['admin']}>
        <div data-testid="admin-content">Admin Content</div>
      </RoleGuard>
    );

    // Should render the component
    expect(container.firstChild).toBeTruthy();
  });

  it('should handle missing user info gracefully', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
    } as any);

    mockTokenManager.getUserInfo.mockReturnValue(null);

    const { container } = render(
      <RoleGuard>
        <div>Protected Content</div>
      </RoleGuard>
    );

    // Should handle gracefully without crashing
    expect(container.firstChild).toBeTruthy();
  });
});