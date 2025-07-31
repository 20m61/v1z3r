/**
 * Forgot Password Form Component
 * Handles password reset request flow
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@vj-app/ui-components';
import { errorHandler } from '@/utils/errorHandler';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onSuccess }) => {
  const router = useRouter();
  const { forgotPassword, isLoading } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const result = await forgotPassword(email);
      
      if (result) {
        setSuccess(true);
        errorHandler.info('Password reset code sent', { email });
        
        if (onSuccess) {
          onSuccess();
        } else {
          // Redirect to reset password page with email
          router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
        }
      } else {
        setError('Failed to send reset code. Please try again.');
      }
    } catch (error) {
      errorHandler.error('Password reset request failed', error as Error);
      
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      
      if (errorMessage.includes('UserNotFoundException')) {
        setError('No account found with this email address');
      } else if (errorMessage.includes('LimitExceededException')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Check Your Email
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We&apos;ve sent a password reset code to <strong>{email}</strong>
        </p>
        
        <p className="text-xs text-gray-500 dark:text-gray-500">
          If you don&apos;t see the email, check your spam folder.
        </p>
        
        <Link
          href={`/auth/reset-password?email=${encodeURIComponent(email)}`}
          className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline"
        >
          Enter reset code →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
          Forgot Your Password?
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
          Enter your email and we&apos;ll send you a reset code
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
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          disabled={isSubmitting || isLoading}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="your@email.com"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isSubmitting || isLoading}
      >
        {(isSubmitting || isLoading) ? 'Sending...' : 'Send Reset Code'}
      </Button>

      <div className="text-center space-y-2">
        <Link
          href="/auth/login"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to login
        </Link>
        <br />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{' '}
        </span>
        <Link
          href="/auth/register"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
};