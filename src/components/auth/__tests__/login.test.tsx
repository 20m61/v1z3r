/**
 * Tests for login page component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import LoginPage from '@/pages/auth/login';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock auth store
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    isAuthenticated: false,
  })),
}));

// Mock components
jest.mock('@/components/auth/LoginForm', () => ({
  LoginForm: ({ redirectUrl }: { redirectUrl?: string }) => (
    <div data-testid="login-form">Login Form (redirectUrl: {redirectUrl || '/dashboard'})</div>
  ),
}));

// No need to mock Logo since it's inline

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('LoginPage', () => {
  const mockRouter = {
    push: jest.fn(),
    query: {},
    pathname: '/auth/login',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('renders login page with all components', () => {
    render(<LoginPage />);

    expect(screen.getByText('v1z3r')).toBeInTheDocument(); // Logo text
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
  });

  it('passes default redirect URL to login form', () => {
    render(<LoginPage />);

    expect(screen.getByText(/redirectUrl: \/dashboard/)).toBeInTheDocument();
  });

  it('passes redirect prop to login form', () => {
    render(<LoginPage redirect="/visualizer" />);

    expect(screen.getByText(/redirectUrl: \/visualizer/)).toBeInTheDocument();
  });

  it('has correct page layout structure', () => {
    const { container } = render(<LoginPage />);

    // Check for centered layout
    const mainContainer = container.querySelector('.min-h-screen.flex');
    expect(mainContainer).toBeInTheDocument();

    // Check for auth card styling
    const authCard = container.querySelector('.bg-white.dark\\:bg-gray-800');
    expect(authCard).toBeInTheDocument();
  });

  it('applies dark mode classes', () => {
    const { container } = render(<LoginPage />);

    const darkModeElements = container.querySelectorAll('[class*="dark:"]');
    expect(darkModeElements.length).toBeGreaterThan(0);
  });
});
