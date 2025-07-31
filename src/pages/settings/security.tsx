/**
 * Security Settings Page
 * Manage account security settings including MFA
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { MFASetup } from '@/components/auth/MFASetup';
import { Button } from '@vj-app/ui-components';
import { errorHandler } from '@/utils/errorHandler';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { user, changePassword } = useAuthStore();
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const errors: Record<string, string> = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 12) {
      errors.newPassword = 'Password must be at least 12 characters';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    setPasswordErrors({});
    
    try {
      const result = await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      
      if (result) {
        errorHandler.info('Password changed successfully');
        setShowPasswordChange(false);
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        setPasswordErrors({ form: 'Failed to change password' });
      }
    } catch (error) {
      errorHandler.error('Password change failed', error as Error);
      setPasswordErrors({ form: 'Failed to change password' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <Head>
        <title>Security Settings - v1z3r</title>
        <meta name="description" content="Manage your account security settings" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Security Settings
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your account security and authentication methods
            </p>
          </div>

          <div className="space-y-6">
            {/* Two-Factor Authentication */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Two-Factor Authentication
              </h2>
              
              {user?.mfaEnabled ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Two-factor authentication is enabled
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {/* TODO: Implement disable MFA */}}
                  >
                    Disable 2FA
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                  </p>
                  {showMFASetup ? (
                    <MFASetup
                      onSuccess={() => {
                        setShowMFASetup(false);
                        window.location.reload(); // Refresh to show updated status
                      }}
                      onSkip={() => setShowMFASetup(false)}
                    />
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowMFASetup(true)}
                    >
                      Enable 2FA
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Password */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Password
              </h2>
              
              {showPasswordChange ? (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    {passwordErrors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    {passwordErrors.newPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  {passwordErrors.form && (
                    <p className="text-sm text-red-600">{passwordErrors.form}</p>
                  )}
                  
                  <div className="flex space-x-3">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Changing...' : 'Change Password'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setPasswordForm({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        });
                        setPasswordErrors({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last changed: {user?.passwordLastChanged || 'Never'}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowPasswordChange(true)}
                  >
                    Change Password
                  </Button>
                </div>
              )}
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Active Sessions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Manage your active sessions across devices
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Current Session
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Browser · Active now
                    </p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400">Active</span>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => {/* TODO: Implement revoke all sessions */}}
              >
                Sign Out All Other Sessions
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}