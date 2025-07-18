/**
 * Reset Password Page
 * Complete password reset with verification code
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { useAuthStore } from '@/store/authStore';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const email = router.query.email as string;

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <>
      <Head>
        <title>Reset Password - v1z3r</title>
        <meta name="description" content="Reset your v1z3r account password" />
      </Head>

      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo */}
          <Link href="/" className="flex justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">v1z3r</span>
            </div>
          </Link>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <ResetPasswordForm email={email} />
          </div>
        </div>
      </div>
    </>
  );
}