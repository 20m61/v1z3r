/**
 * Unit tests for RegisterForm component
 * Tests form validation, password strength, and registration flow
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import { RegisterForm } from '../RegisterForm';
import { useAuthStore } from '@/store/authStore';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Zustand store
jest.mock('@/store/authStore');

describe('RegisterForm', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockAuthStore = {
    signUp: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationCode: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthStore);
  });

  it('renders registration form with all fields', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vj handle/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const fullNameInput = screen.getByLabelText(/full name/i);
    const vjHandleInput = screen.getByLabelText(/vj handle/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByLabelText(/i agree to the/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Fill valid values for all fields except email
    await user.type(fullNameInput, 'Test User');
    await user.type(vjHandleInput, 'test_vj');
    await user.type(emailInput, 'invalid@email'); // Invalid email format
    await user.type(passwordInput, 'Test123!@#ABC');
    await user.type(confirmPasswordInput, 'Test123!@#ABC');
    await user.click(termsCheckbox);

    await user.click(submitButton);

    expect(await screen.findByText('Invalid email format')).toBeInTheDocument();
    expect(mockAuthStore.signUp).not.toHaveBeenCalled();
  });

  it('validates password strength requirements', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);

    // Test various password strengths
    await user.type(passwordInput, 'weak');
    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();

    await user.clear(passwordInput);
    await user.type(passwordInput, 'weak12345678');
    expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();

    await user.clear(passwordInput);
    await user.type(passwordInput, 'Weak12345678');
    expect(screen.getByText(/special character/i)).toBeInTheDocument();

    await user.clear(passwordInput);
    await user.type(passwordInput, 'StrongPass123!@#');
    expect(screen.queryByText(/at least 12 characters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/uppercase letter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/special character/i)).not.toBeInTheDocument();
  });

  it('validates password confirmation match', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    // Fill required fields
    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const vjHandleInput = screen.getByLabelText(/vj handle/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByRole('checkbox');
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(fullNameInput, 'Test User');
    await user.type(vjHandleInput, 'test_vj');
    await user.type(passwordInput, 'StrongPass123!@#');
    await user.type(confirmInput, 'DifferentPass123!@#');
    await user.click(termsCheckbox);
    await user.click(submitButton);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockAuthStore.signUp).not.toHaveBeenCalled();
  });

  it('validates VJ handle format', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    // Fill required fields except VJ handle
    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    const vjHandleInput = screen.getByLabelText(/vj handle/i);
    const termsCheckbox = screen.getByRole('checkbox');
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(fullNameInput, 'Test User');
    await user.type(passwordInput, 'StrongPass123!@#');
    await user.type(confirmInput, 'StrongPass123!@#');
    await user.click(termsCheckbox);

    // Invalid characters
    await user.type(vjHandleInput, 'invalid handle!');
    await user.click(submitButton);

    expect(
      await screen.findByText(/letters, numbers, underscores, and hyphens/i)
    ).toBeInTheDocument();

    // Too short
    await user.clear(vjHandleInput);
    await user.type(vjHandleInput, 'ab');
    await user.click(submitButton);

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
  });

  it('handles successful registration', async () => {
    const user = userEvent.setup();
    mockAuthStore.signUp.mockResolvedValueOnce({ success: true, userSub: 'user-123' });

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/vj handle/i), 'test_vj');
    await user.click(screen.getByRole('checkbox'));

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAuthStore.signUp).toHaveBeenCalledWith({
        username: 'newuser@example.com',
        password: 'StrongPass123!@#',
        attributes: {
          email: 'newuser@example.com',
          name: 'Test User',
          'custom:vj_handle': 'test_vj',
        },
      });
    });

    // Should show verification form
    expect(await screen.findByText(/verify your email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it('handles email verification', async () => {
    const user = userEvent.setup();
    mockAuthStore.signUp.mockResolvedValueOnce({ success: true, userSub: 'user-123' });
    mockAuthStore.verifyEmail.mockResolvedValueOnce(true);

    render(<RegisterForm />);

    // Complete registration
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/vj handle/i), 'test_vj');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Wait for verification form
    await screen.findByText(/verify your email/i);

    // Enter verification code
    const codeInput = screen.getByLabelText(/verification code/i);
    await user.type(codeInput, '123456');

    const verifyButton = screen.getByRole('button', { name: /verify email/i });
    await user.click(verifyButton);

    await waitFor(() => {
      expect(mockAuthStore.verifyEmail).toHaveBeenCalledWith('newuser@example.com', '123456');
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/login?verified=true');
    });
  });

  it('handles resend verification code', async () => {
    const user = userEvent.setup();
    mockAuthStore.signUp.mockResolvedValueOnce({ success: true, userSub: 'user-123' });
    mockAuthStore.resendVerificationCode.mockResolvedValueOnce(true);

    render(<RegisterForm />);

    // Complete registration to get to verification
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/vj handle/i), 'test_vj');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Wait for verification form
    await screen.findByText(/verify your email/i);

    const resendButton = screen.getByRole('button', { name: /resend code/i });
    await user.click(resendButton);

    await waitFor(() => {
      expect(mockAuthStore.resendVerificationCode).toHaveBeenCalledWith('newuser@example.com');
      expect(screen.getByText(/verification code sent/i)).toBeInTheDocument();
    });
  });

  it('handles registration errors', async () => {
    const user = userEvent.setup();
    mockAuthStore.signUp.mockRejectedValueOnce(new Error('UsernameExistsException'));

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/vj handle/i), 'test_vj');
    await user.click(screen.getByRole('checkbox'));

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    expect(await screen.findByText(/email already registered/i)).toBeInTheDocument();
  });

  it('disables form while loading', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      isLoading: true,
    });

    render(<RegisterForm />);

    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('shows password strength indicator', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);

    // Weak password
    await user.type(passwordInput, 'weak');
    expect(screen.getByText(/weak/i)).toHaveClass('text-red-500');

    // Medium password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'Medium123');
    expect(screen.getByText(/medium/i)).toHaveClass('text-yellow-500');

    // Strong password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'StrongPass123!@#');
    expect(screen.getByText(/strong/i)).toHaveClass('text-green-500');
  });

  it('validates verification code format', async () => {
    const user = userEvent.setup();
    mockAuthStore.signUp.mockResolvedValueOnce({ success: true, userSub: 'user-123' });

    render(<RegisterForm />);

    // Complete registration
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!@#');
    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/vj handle/i), 'test_vj');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Wait for verification form
    await screen.findByText(/verify your email/i);

    const codeInput = screen.getByLabelText(/verification code/i);
    const verifyButton = screen.getByRole('button', { name: /verify email/i });

    // Invalid code (non-numeric)
    await user.type(codeInput, 'abcdef');
    await user.click(verifyButton);

    expect(await screen.findByText(/verification code must be 6 digits/i)).toBeInTheDocument();
    expect(mockAuthStore.verifyEmail).not.toHaveBeenCalled();
  });
});
