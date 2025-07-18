/**
 * MFA Setup Component
 * Handles Multi-Factor Authentication setup flow
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import { errorHandler } from '@/utils/errorHandler';

interface MFASetupProps {
  onSuccess?: () => void;
  onSkip?: () => void;
}

export const MFASetup: React.FC<MFASetupProps> = ({ onSuccess, onSkip }) => {
  const router = useRouter();
  const { setupMFA, verifyMFA, isLoading } = useAuthStore();
  
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initializeMFA();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeMFA = async () => {
    try {
      const { secret, qrCode } = await setupMFA();
      setSecret(secret);
      setQrCode(qrCode);
    } catch (error) {
      errorHandler.error('Failed to initialize MFA', error as Error);
      setError('Failed to load MFA setup. Please try again.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const result = await verifyMFA(verificationCode);
      
      if (result) {
        errorHandler.info('MFA enabled successfully');
        
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/dashboard');
        }
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (error) {
      errorHandler.error('MFA verification failed', error as Error);
      setError('Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      router.push('/dashboard');
    }
  };

  if (step === 'setup') {
    return (
      <div className="space-y-6 w-full max-w-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Secure Your Account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Set up two-factor authentication for enhanced security
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Steps to enable 2FA:
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
            <li>Scan the QR code below or enter the secret key manually</li>
            <li>Enter the 6-digit code from your app to verify</li>
          </ol>
        </div>

        {qrCode ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={qrCode} 
                alt="MFA QR Code" 
                className="mx-auto"
                style={{ maxWidth: '200px' }}
              />
            </div>
            
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Can&apos;t scan? Enter this code manually:
              </p>
              <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                {secret}
              </code>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setStep('verify')}
            >
              Continue to Verification
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Loading MFA setup...
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:underline"
        >
          Skip for now
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-6 w-full max-w-md">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Verify Your Setup
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Verification Code
        </label>
        <input
          id="code"
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
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl font-mono tracking-widest ${
            error 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          placeholder="000000"
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
          {(isSubmitting || isLoading) ? 'Verifying...' : 'Enable 2FA'}
        </Button>

        <button
          type="button"
          onClick={() => setStep('setup')}
          className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to QR code
        </button>
      </div>
    </form>
  );
};