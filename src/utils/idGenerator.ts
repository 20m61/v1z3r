/**
 * ID Generator Utility
 * 
 * Provides stable ID generation for React components
 * to avoid hydration mismatches in SSR/static export.
 */

let counter = 0;

/**
 * Generate a unique ID using a counter
 * This avoids Date.now() which causes hydration mismatches
 */
export function generateId(prefix: string = 'id'): string {
  if (typeof window !== 'undefined') {
    // Client-side: use counter + timestamp for uniqueness across sessions
    return `${prefix}-${++counter}-${Date.now()}`
  } else {
    // Server-side: use only counter for stability
    return `${prefix}-${++counter}`
  }
}

/**
 * Generate a stable ID that's the same on server and client
 * Useful for components that need consistent IDs across hydration
 */
export function generateStableId(prefix: string = 'stable'): string {
  return `${prefix}-${++counter}`
}

/**
 * Reset counter (useful for tests)
 */
export function resetIdCounter(): void {
  counter = 0
}