/**
 * MFA Verification Component
 * Handles Multi-Factor Authentication during login
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@vj-app/ui-components';
import { errorHandler } from '@/utils/errorHandler';

interface MFAVerificationProps {
  session: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectUrl?: string;
}

export const MFAVerification: React.FC<MFAVerificationProps> = ({ 
  session, 
  onSuccess, 
  onCancel,
  redirectUrl = '/dashboard'
}) => {
  const router = useRouter();
  const { verifyMFA, isLoading } = useAuthStore();
  
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const result = await verifyMFA(verificationCode, session);
      
      if (result) {
        errorHandler.info('MFA verification successful');
        
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(redirectUrl);
        }
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (error) {
      errorHandler.error('MFA verification failed', error as Error);
      
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      
      if (errorMessage.includes('CodeMismatchException')) {
        setError('Invalid code. Please check and try again.');
      } else if (errorMessage.includes('NotAuthorizedException')) {
        setError('Session expired. Please sign in again.');
        setTimeout(() => {
          if (onCancel) onCancel();
        }, 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <form onSubmit={handleVerify} className="space-y-6 w-full max-w-md">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Two-Factor Authentication
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Enter the code from your authenticator app
        </p>
      </div>

      <div>
        <label htmlFor="mfa-code" className="sr-only">
          Verification Code
        </label>
        <input
          id="mfa-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={verificationCode}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            setVerificationCode(value);
            setError('');
          }}
          disabled={isSubmitting || isLoading}
          className={`block w-full px-4 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-3xl font-mono tracking-widest ${
            error 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="000000"
          autoFocus
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting || isLoading || verificationCode.length !== 6}
        >
          {(isSubmitting || isLoading) ? 'Verifying...' : 'Verify'}
        </Button>

        <button
          type="button"
          onClick={handleCancel}
          className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:underline"
        >
          Cancel
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Lost your device?{' '}
          <a href="/support" className="text-blue-600 dark:text-blue-400 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </form>
  );
};