/**
 * Next.js Edge Runtime Middleware
 * Handles authentication and route protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from './middleware/authMiddleware';

export function middleware(request: NextRequest) {
  // Run auth middleware
  const authResponse = authMiddleware(request);
  if (authResponse) {
    return authResponse;
  }

  // Continue with request
  return NextResponse.next();
}

// Configure which routes use middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};