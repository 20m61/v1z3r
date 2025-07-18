/**
 * Role Guard Component
 * Enforces role-based access control for components
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { tokenManager } from '@/services/auth/tokenManager';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredTier?: 'free' | 'premium' | 'admin';
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRoles = [],
  requiredTier,
  fallback,
  redirectTo = '/dashboard',
}) => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    checkAuthorization();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, requiredRoles, requiredTier]);

  const checkAuthorization = () => {
    // Not authenticated
    if (!isAuthenticated || !user) {
      setIsAuthorized(false);
      router.push(`/auth/login?redirect=${encodeURIComponent(router.pathname)}`);
      return;
    }

    // Get user info from token
    const userInfo = tokenManager.getUserInfo();
    if (!userInfo) {
      setIsAuthorized(false);
      return;
    }

    // Check role requirements
    if (requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some(role => 
        tokenManager.hasRole(role)
      );
      
      if (!hasRequiredRole) {
        setIsAuthorized(false);
        if (redirectTo) {
          router.push(redirectTo);
        }
        return;
      }
    }

    // Check tier requirements
    if (requiredTier) {
      const tierHierarchy: Record<string, number> = {
        free: 0,
        premium: 1,
        admin: 2,
      };
      
      const userTierLevel = tierHierarchy[userInfo.tier || 'free'];
      const requiredTierLevel = tierHierarchy[requiredTier];

      if (userTierLevel < requiredTierLevel) {
        setIsAuthorized(false);
        if (redirectTo) {
          router.push(redirectTo);
        }
        return;
      }
    }

    setIsAuthorized(true);
  };

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Not authorized
  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don&apos;t have permission to access this resource
          </p>
          {requiredTier && requiredTier !== 'free' && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              This feature requires {requiredTier} tier or higher
            </p>
          )}
          <button
            onClick={() => router.back()}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Authorized
  return <>{children}</>;
};

/**
 * Hook for checking role-based permissions
 */
export const useRoleCheck = () => {
  const { isAuthenticated, hasRole } = useAuthStore();

  const checkRole = (role: string): boolean => {
    if (!isAuthenticated) return false;
    return hasRole(role);
  };

  const checkRoles = (roles: string[]): boolean => {
    if (!isAuthenticated) return false;
    return roles.some(role => hasRole(role));
  };

  const checkTier = (requiredTier: 'free' | 'premium' | 'admin'): boolean => {
    if (!isAuthenticated) return false;
    
    const userInfo = tokenManager.getUserInfo();
    if (!userInfo) return false;

    const tierHierarchy: Record<string, number> = {
      free: 0,
      premium: 1,
      admin: 2,
    };
    
    const userTierLevel = tierHierarchy[userInfo.tier || 'free'];
    const requiredTierLevel = tierHierarchy[requiredTier];

    return userTierLevel >= requiredTierLevel;
  };

  return {
    checkRole,
    checkRoles,
    checkTier,
    isAdmin: checkRole('admin'),
    isPremium: checkTier('premium'),
  };
};