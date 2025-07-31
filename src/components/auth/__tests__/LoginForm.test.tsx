/**
 * Unit tests for LoginForm component
 * Tests form validation, error handling, MFA, and success flows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import { LoginForm } from '../LoginForm';
import { useAuthStore } from '@/store/authStore';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Zustand store
jest.mock('@/store/authStore');

describe('LoginForm', () => {
  const mockRouter = {
    push: jest.fn(),
    query: {},
  };

  const mockAuthStore = {
    signIn: jest.fn(),
    verifyMFA: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthStore);
  });

  it('renders login form with all fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Invalid email - use a format that passes HTML5 validation but fails our custom validation
    await user.type(emailInput, 'invalid@email'); // Missing .com makes it invalid for our regex
    await user.type(passwordInput, 'password123'); // Valid password to isolate email validation

    // Submit the form
    await user.click(submitButton);

    // Wait for validation to run and check for error display
    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });

    expect(mockAuthStore.signIn).not.toHaveBeenCalled();
  });

  it('validates password requirements', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, '123'); // Too short
    await user.click(submitButton);

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(mockAuthStore.signIn).not.toHaveBeenCalled();
  });

  it('handles successful login', async () => {
    const user = userEvent.setup();
    mockAuthStore.signIn.mockResolvedValueOnce({ success: true });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Test123!@#');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAuthStore.signIn).toHaveBeenCalledWith('test@example.com', 'Test123!@#');
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });
  });

  it.skip('handles MFA challenge', async () => {
    const user = userEvent.setup();
    mockAuthStore.signIn.mockResolvedValueOnce({
      success: false,
      challengeName: 'SOFTWARE_TOKEN_MFA',
      session: 'test-session',
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Test123!@#');
    await user.click(submitButton);

    // Should redirect to MFA page
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/mfa?session=test-session');
    });
  });

  it('handles login errors', async () => {
    const user = userEvent.setup();
    mockAuthStore.signIn.mockRejectedValueOnce(new Error('NotAuthorizedException'));

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'WrongPassword');
    await user.click(submitButton);

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  });

  it('disables form while loading', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isLoading: true,
    });

    render(<LoginForm />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('redirects to custom URL after login', async () => {
    const user = userEvent.setup();
    mockAuthStore.signIn.mockResolvedValueOnce({ success: true });

    render(<LoginForm redirectUrl="/visualizer" />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Test123!@#');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/visualizer');
    });
  });

  it('handles user not confirmed error', async () => {
    const user = userEvent.setup();
    mockAuthStore.signIn.mockRejectedValueOnce(new Error('UserNotConfirmedException'));

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'unconfirmed@example.com');
    await user.type(passwordInput, 'Test123!@#');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/verify?email=unconfirmed%40example.com');
    });
  });

  it('shows social login buttons', () => {
    render(<LoginForm />);

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
  });
});
