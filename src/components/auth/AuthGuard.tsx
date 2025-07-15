/**
 * Auth Guard Component
 * Protects routes that require authentication
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
  fallbackUrl?: string;
  loadingComponent?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requiredRole,
  fallbackUrl = '/auth/login',
  loadingComponent = <DefaultLoadingComponent />,
}) => {
  const router = useRouter();
  const { isAuthenticated, user, isTokenExpired, refreshSession, hasRole } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      setIsChecking(true);

      try {
        // If not authenticated, redirect to login
        if (!isAuthenticated || !user) {
          router.push(`${fallbackUrl}?redirect=${encodeURIComponent(router.asPath)}`);
          return;
        }

        // Check if token is expired and try to refresh
        if (isTokenExpired()) {
          const refreshed = await refreshSession();
          if (!refreshed) {
            router.push(`${fallbackUrl}?redirect=${encodeURIComponent(router.asPath)}`);
            return;
          }
        }

        // Check role-based access if required
        if (requiredRole && !hasRole(requiredRole)) {
          router.push('/unauthorized');
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push(fallbackUrl);
      }
    };

    checkAuth();
  }, [isAuthenticated, user, requiredRole, router.asPath, fallbackUrl, hasRole, isTokenExpired, refreshSession, router]);

  if (isChecking) {
    return <>{loadingComponent}</>;
  }

  return <>{children}</>;
};

// Default loading component
function DefaultLoadingComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// HOC version for easier page protection
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AuthGuardProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}