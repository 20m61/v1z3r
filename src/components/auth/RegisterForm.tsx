/**
 * Registration Form Component
 * Handles new user registration with AWS Cognito
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import { errorHandler } from '@/utils/errorHandler';

interface RegisterFormProps {
  onSuccess?: () => void;
  redirectUrl?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ 
  onSuccess, 
  redirectUrl = '/auth/verify' 
}) => {
  const router = useRouter();
  const { signUp, verifyEmail, resendVerificationCode, isLoading } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    vjHandle: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'passwords do not match';
    }
    
    // Full name validation
    if (!formData.fullName) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }
    
    // VJ Handle validation
    if (!formData.vjHandle) {
      newErrors.vjHandle = 'VJ handle is required';
    } else if (formData.vjHandle.length < 3) {
      newErrors.vjHandle = 'must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.vjHandle)) {
      newErrors.vjHandle = 'can only contain letters, numbers, underscores, and hyphens';
    }
    
    // Terms agreement validation
    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const result = await signUp({
        username: formData.email,
        password: formData.password,
        attributes: {
          email: formData.email,
          name: formData.fullName,
          'custom:vj_handle': formData.vjHandle,
        },
      });
      
      if (result.success) {
        errorHandler.info('Registration successful', { email: formData.email });
        setShowVerification(true);
      }
    } catch (error) {
      errorHandler.error('Registration failed', error instanceof Error ? error : new Error(String(error)));
      
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      // Handle specific Cognito errors
      if (errorMessage.includes('UsernameExistsException')) {
        setErrors({ email: 'Email already registered' });
      } else if (errorMessage.includes('InvalidPasswordException')) {
        setErrors({ password: 'Password does not meet requirements' });
      } else if (errorMessage.includes('InvalidParameterException')) {
        if (errorMessage.includes('email')) {
          setErrors({ email: 'Invalid email format' });
        } else {
          setErrors({ form: 'Invalid input provided' });
        }
      } else {
        setErrors({ form: errorMessage });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate verification code
    if (!verificationCode) {
      setErrors({ verificationCode: 'Verification code is required' });
      return;
    }
    
    if (!/^\d{6}$/.test(verificationCode)) {
      setErrors({ verificationCode: 'Verification code must be 6 digits' });
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const result = await verifyEmail(formData.email, verificationCode);
      
      if (result) {
        errorHandler.info('Email verified successfully', { email: formData.email });
        
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/auth/login?verified=true');
        }
      }
    } catch (error) {
      errorHandler.error('Email verification failed', error instanceof Error ? error : new Error(String(error)));
      setErrors({ verificationCode: 'Invalid verification code' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await resendVerificationCode(formData.email);
      errorHandler.info('Verification code resent', { email: formData.email });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000); // Hide message after 3 seconds
    } catch (error) {
      errorHandler.error('Failed to resend verification code', error instanceof Error ? error : new Error(String(error)));
      setErrors({ form: 'Failed to resend verification code' });
    }
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;
    
    if (strength <= 1) return { strength: 20, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength: 40, label: 'Medium', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength: 60, label: 'Good', color: 'bg-blue-500' };
    if (strength <= 5) return { strength: 80, label: 'Strong', color: 'bg-green-500' };
    return { strength: 100, label: 'Very Strong', color: 'bg-green-600' };
  };

  const getPasswordValidationMessages = (password: string): string[] => {
    const messages: string[] = [];
    
    if (password.length > 0 && password.length < 12) {
      messages.push('Must be at least 12 characters');
    }
    
    if (password.length > 0 && !/[A-Z]/.test(password)) {
      messages.push('Must contain an uppercase letter');
    }
    
    if (password.length > 0 && !/[@$!%*?&]/.test(password)) {
      messages.push('Must contain a special character');
    }
    
    return messages;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const passwordValidationMessages = getPasswordValidationMessages(formData.password);

  if (showVerification) {
    return (
      <form onSubmit={handleVerification} className="space-y-6 w-full max-w-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Your Email</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We&apos;ve sent a verification code to {formData.email}
          </p>
        </div>
        
        <div>
          <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Verification Code
          </label>
          <input
            id="verificationCode"
            name="verificationCode"
            type="text"
            required
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.verificationCode 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
            placeholder="123456"
            maxLength={6}
          />
          {errors.verificationCode && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.verificationCode}</p>
          )}
        </div>

        {errors.form && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>
        )}

        {resendSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">Verification code sent</p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Verifying...' : 'Verify Email'}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendCode}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Full Name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          value={formData.fullName}
          onChange={handleInputChange}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.fullName 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="John Doe"
        />
        {errors.fullName && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.fullName}</p>
        )}
      </div>

      <div>
        <label htmlFor="vjHandle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          VJ Handle
        </label>
        <input
          id="vjHandle"
          name="vjHandle"
          type="text"
          autoComplete="username"
          required
          value={formData.vjHandle}
          onChange={handleInputChange}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.vjHandle 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="vj_master"
        />
        {errors.vjHandle && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vjHandle}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={handleInputChange}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="your@email.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={formData.password}
          onChange={handleInputChange}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="••••••••"
        />
        {formData.password && (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Password strength</span>
              <span className={`text-xs font-medium ${
                passwordStrength.color.replace('bg-', 'text-')
              }`}>{passwordStrength.label}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                style={{ width: `${passwordStrength.strength}%` }}
              />
            </div>
          </div>
        )}
        {passwordValidationMessages.map((message, index) => (
          <p key={index} className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
        ))}
        {errors.password && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={formData.confirmPassword}
          onChange={handleInputChange}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.confirmPassword 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="••••••••"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="flex items-start">
        <input
          id="terms"
          name="terms"
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          disabled={isSubmitting || isLoading}
          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="terms" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
          I agree to the{' '}
          <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
            Terms and Conditions
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
            Privacy Policy
          </a>
        </label>
      </div>
      {errors.terms && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>
      )}

      {errors.form && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{errors.form}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isSubmitting || isLoading}
      >
        {(isSubmitting || isLoading) ? 'Creating account' : 'Create Account'}
      </Button>

      <div className="text-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
        </span>
        <Link
          href="/auth/login"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Sign in
        </Link>
      </div>
    </form>
  );
};