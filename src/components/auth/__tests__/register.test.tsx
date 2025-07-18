/**
 * Tests for register page component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import RegisterPage from '@/pages/auth/register';

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
jest.mock('@/components/auth/RegisterForm', () => ({
  RegisterForm: () => <div data-testid="register-form">Register Form</div>,
}));

describe('RegisterPage', () => {
  const mockRouter = {
    push: jest.fn(),
    pathname: '/auth/register',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('renders register page with all components', () => {
    render(<RegisterPage />);
    
    expect(screen.getByText('v1z3r')).toBeInTheDocument(); // Logo text
    expect(screen.getByTestId('register-form')).toBeInTheDocument();
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
  });

  it('has correct page layout structure', () => {
    const { container } = render(<RegisterPage />);
    
    // Check for centered layout
    const mainContainer = container.querySelector('.min-h-screen.flex');
    expect(mainContainer).toBeInTheDocument();
    
    // Check for auth card styling
    const authCard = container.querySelector('.bg-white.dark\\:bg-gray-800');
    expect(authCard).toBeInTheDocument();
  });

  it('includes registration benefits section', () => {
    render(<RegisterPage />);
    
    // Check for benefits text
    expect(screen.getByText(/join the vj community/i)).toBeInTheDocument();
    expect(screen.getByText(/collaborate with other vjs/i)).toBeInTheDocument();
    expect(screen.getByText(/save and sync your visual presets/i)).toBeInTheDocument();
  });

  it('applies responsive design classes', () => {
    const { container } = render(<RegisterPage />);
    
    // Check for responsive padding
    const responsiveElements = container.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
    expect(responsiveElements.length).toBeGreaterThan(0);
  });

  it('has proper semantic HTML structure', () => {
    const { container } = render(<RegisterPage />);
    
    // Should have proper heading hierarchy
    const h2 = container.querySelector('h2');
    expect(h2).toBeInTheDocument();
    expect(h2?.textContent).toMatch(/create your account/i);
  });
});