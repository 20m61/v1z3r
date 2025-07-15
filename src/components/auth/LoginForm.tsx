/**
 * Login Form Component
 * Handles user authentication with AWS Cognito
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import { errorHandler } from '@/utils/errorHandler';

interface LoginFormProps {
  onSuccess?: () => void;
  redirectUrl?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onSuccess, 
  redirectUrl = '/dashboard' 
}) => {
  const router = useRouter();
  const { signIn, isLoading } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
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
      const result = await signIn(formData.email, formData.password);
      
      if (result.success) {
        errorHandler.info('Login successful', { email: formData.email });
        
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(redirectUrl);
        }
      } else if (result.challengeName) {
        // Handle MFA or other challenges
        switch (result.challengeName) {
          case 'SMS_MFA':
          case 'SOFTWARE_TOKEN_MFA':
            router.push(`/auth/mfa?session=${result.session}`);
            break;
          case 'NEW_PASSWORD_REQUIRED':
            router.push(`/auth/new-password?session=${result.session}`);
            break;
          default:
            setErrors({ form: 'Authentication challenge not supported' });
        }
      }
    } catch (error) {
      errorHandler.error('Login failed', error instanceof Error ? error : new Error(String(error)));
      
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      // Handle specific Cognito errors
      if (errorMessage.includes('UserNotFoundException')) {
        setErrors({ email: 'No account found with this email' });
      } else if (errorMessage.includes('NotAuthorizedException')) {
        setErrors({ password: 'Incorrect password' });
      } else if (errorMessage.includes('UserNotConfirmedException')) {
        router.push(`/auth/verify?email=${encodeURIComponent(formData.email)}`);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
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
          autoComplete="current-password"
          required
          value={formData.password}
          onChange={handleInputChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="••••••••"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
        )}
      </div>

      {errors.form && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{errors.form}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <a
          href="/auth/forgot-password"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Forgot password?
        </a>
        <a
          href="/auth/register"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Create account
        </a>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isSubmitting || isLoading}
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {/* TODO: Implement social login */}}
          disabled={isSubmitting}
        >
          Google
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {/* TODO: Implement social login */}}
          disabled={isSubmitting}
        >
          GitHub
        </Button>
      </div>
    </form>
  );
};