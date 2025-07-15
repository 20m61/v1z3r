/**
 * Protected Dashboard Page
 * Main dashboard for authenticated users
 */

import React from 'react';
import Head from 'next/head';
import { withAuth } from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/router';

function DashboardPage() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>Dashboard - v1z3r</title>
        <meta name="description" content="v1z3r Dashboard" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Dashboard
                </h1>
                <span className="px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  {user?.tier?.toUpperCase()}
                </span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.fullName || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    @{user?.vjHandle}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome back, {user?.fullName || 'VJ'}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Ready to create amazing visuals? Here&apos;s your dashboard overview.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Saved Presets
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    12
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Sessions This Week
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    8
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Collaborations
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    3
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button
                variant="primary"
                onClick={() => router.push('/visualizer')}
                className="w-full"
              >
                Start VJ Session
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push('/presets')}
                className="w-full"
              >
                Manage Presets
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push('/collaborate')}
                className="w-full"
              >
                Join Session
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push('/settings')}
                className="w-full"
              >
                Settings
              </Button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Created new preset &ldquo;Neon Dreams&rdquo;
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    2 hours ago
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Collaborated with @vjmaster2000
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Yesterday
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
              
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Updated profile settings
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    3 days ago
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// Protect this page with authentication
export default withAuth(DashboardPage);