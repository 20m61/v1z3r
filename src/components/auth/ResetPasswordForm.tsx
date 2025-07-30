/**
 * Reset Password Form Component
 * Handles password reset confirmation with code
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@vj-app/ui-components';
import { errorHandler } from '@/utils/errorHandler';

interface ResetPasswordFormProps {
  email?: string;
  onSuccess?: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ 
  email: propEmail, 
  onSuccess 
}) => {
  const router = useRouter();
  const { confirmForgotPassword, isLoading } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: propEmail || '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Get email from query params if not provided as prop
  useEffect(() => {
    if (!formData.email && router.query.email) {
      setFormData(prev => ({ ...prev, email: router.query.email as string }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.email]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    // Code validation
    if (!formData.code) {
      newErrors.code = 'Verification code is required';
    } else if (!/^\d{6}$/.test(formData.code)) {
      newErrors.code = 'Code must be 6 digits';
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
      newErrors.confirmPassword = 'Passwords do not match';
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
      const result = await confirmForgotPassword(
        formData.email,
        formData.code,
        formData.password
      );
      
      if (result) {
        setSuccess(true);
        errorHandler.info('Password reset successful', { email: formData.email });
        
        if (onSuccess) {
          onSuccess();
        } else {
          // Redirect to login after 2 seconds
          setTimeout(() => {
            router.push('/auth/login?reset=true');
          }, 2000);
        }
      } else {
        setErrors({ form: 'Failed to reset password. Please try again.' });
      }
    } catch (error) {
      errorHandler.error('Password reset failed', error as Error);
      
      const errorMessage = error instanceof Error ? error.message : 'Reset failed';
      
      if (errorMessage.includes('CodeMismatchException')) {
        setErrors({ code: 'Invalid or expired code' });
      } else if (errorMessage.includes('ExpiredCodeException')) {
        setErrors({ code: 'Code has expired. Please request a new one.' });
      } else if (errorMessage.includes('InvalidPasswordException')) {
        setErrors({ password: 'Password does not meet requirements' });
      } else if (errorMessage.includes('LimitExceededException')) {
        setErrors({ form: 'Too many attempts. Please try again later.' });
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

  const passwordStrength = getPasswordStrength(formData.password);

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Password Reset Successful!
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your password has been reset. Redirecting to login...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
          Reset Your Password
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
          Enter the code from your email and your new password
        </p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email Address
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
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Verification Code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          value={formData.code}
          onChange={handleInputChange}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.code 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="123456"
          maxLength={6}
        />
        {errors.code && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.code}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          New Password
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
        {errors.password && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Confirm New Password
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
        {(isSubmitting || isLoading) ? 'Resetting...' : 'Reset Password'}
      </Button>

      <div className="text-center">
        <Link
          href="/auth/forgot-password"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Request new code
        </Link>
      </div>
    </form>
  );
};