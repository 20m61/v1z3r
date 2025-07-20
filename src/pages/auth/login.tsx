/**
 * Login Page
 * User authentication entry point
 */

import React from 'react';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuthStore } from '@/store/authStore';

interface LoginPageProps {
  redirect?: string | null;
}

export default function LoginPage({ redirect }: LoginPageProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push(redirect || '/dashboard');
    }
  }, [isAuthenticated, redirect, router]);

  return (
    <>
      <Head>
        <title>Sign In - v1z3r</title>
        <meta name="description" content="Sign in to your v1z3r account" />
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

          {/* Title */}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              create a new account
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <LoginForm redirectUrl={redirect || undefined} />
          </div>
        </div>

        {/* Demo credentials notice */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Demo credentials:</strong><br />
                Email: test@example.com<br />
                Password: Test123!@#
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<LoginPageProps> = async () => {
  return {
    props: {
      redirect: null,
    },
  };
};