# Authentication Guide

## Overview

v1z3r uses AWS Cognito for authentication with JWT tokens, providing secure user management, multi-factor authentication (MFA), and role-based access control (RBAC).

## Features

- **JWT Token Management**: Secure token storage and automatic refresh
- **Multi-Factor Authentication (MFA)**: Optional TOTP-based 2FA
- **Role-Based Access Control (RBAC)**: Tier-based permissions (free, premium, admin)
- **Password Reset Flow**: Self-service password recovery
- **Secure Token Storage**: In-memory storage with session persistence
- **Auto Token Refresh**: Automatic token renewal before expiry

## Configuration

### Environment Variables

Add these to your `.env.local`:

```env
# AWS Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=your_cognito_user_pool_id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your_cognito_client_id
NEXT_PUBLIC_IDENTITY_POOL_ID=your_cognito_identity_pool_id

# API Configuration
NEXT_PUBLIC_API_URL=https://api.v1z3r.com
```

### AWS Cognito Setup

1. Create a User Pool in AWS Cognito
2. Configure app client settings
3. Set up user attributes:
   - email (required)
   - name
   - custom:vj_handle
   - custom:tier

## Usage

### Authentication Store

```typescript
import { useAuthStore } from '@/store/authStore';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuthStore();
  
  const handleLogin = async () => {
    try {
      await signIn(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
}
```

### Protected Routes

Use `AuthGuard` to protect pages:

```typescript
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function ProtectedPage() {
  return (
    <AuthGuard>
      <YourProtectedContent />
    </AuthGuard>
  );
}
```

### Role-Based Access

Use `RoleGuard` for role-specific content:

```typescript
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function AdminPage() {
  return (
    <RoleGuard requiredRoles={['admin']} requiredTier="admin">
      <AdminContent />
    </RoleGuard>
  );
}
```

### API Requests

Use the auth interceptor for authenticated API calls:

```typescript
import { apiClient } from '@/services/api/authInterceptor';

// Authenticated request
const response = await apiClient.get('/api/user/profile');

// Skip auth for public endpoints
const publicData = await apiClient.get('/api/public/data', {
  skipAuth: true
});
```

## Authentication Flow

### 1. Registration
1. User fills registration form
2. Account created in Cognito
3. Verification email sent
4. User enters verification code
5. Account activated

### 2. Login
1. User enters credentials
2. If MFA enabled, enter TOTP code
3. JWT tokens received and stored
4. Redirect to dashboard

### 3. Password Reset
1. User requests password reset
2. Reset code sent to email
3. User enters code and new password
4. Password updated in Cognito

### 4. MFA Setup
1. User enables 2FA in settings
2. QR code displayed for authenticator app
3. User enters verification code
4. MFA activated on account

## Security Best Practices

1. **Token Storage**: Tokens stored in memory, not localStorage
2. **HTTPS Only**: All auth requests over HTTPS in production
3. **Token Refresh**: Automatic refresh 5 minutes before expiry
4. **Session Management**: Clear tokens on logout
5. **RBAC**: Enforce permissions on both client and server

## Middleware Configuration

Protected routes are configured in `src/middleware/authMiddleware.ts`:

```typescript
const PROTECTED_ROUTES: Record<string, RouteConfig> = {
  '/dashboard': { requireAuth: true },
  '/admin': { 
    requireAuth: true, 
    requireRoles: ['admin'], 
    requireTier: 'admin' 
  },
  '/premium': { 
    requireAuth: true, 
    requireTier: 'premium' 
  },
};
```

## Testing

For development, use mock authentication:

```
Email: test@example.com
Password: Test123!@#
```

## Troubleshooting

### Token Expired
- Tokens auto-refresh, but if failed, user redirected to login
- Check browser console for refresh errors

### MFA Issues
- Ensure authenticator app time is synchronized
- Contact support if device lost

### Permission Denied
- Check user tier and roles in Cognito console
- Verify route configuration in middleware