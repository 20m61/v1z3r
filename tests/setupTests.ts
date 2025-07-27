/**
 * Enhanced test setup for comprehensive testing
 * Includes mocks for auth, WebGL, and other dependencies
 */

import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock fetch for tests
global.fetch = jest.fn();

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock crypto API for auth tests
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

// Mock Zustand store for auth
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    accessToken: null,
    idToken: null,
    refreshToken: null,
    tokenExpiry: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    setTokens: jest.fn(),
    clearAuth: jest.fn(),
    refreshSession: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationCode: jest.fn(),
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
    changePassword: jest.fn(),
    setupMFA: jest.fn(),
    verifyMFA: jest.fn(),
    isTokenExpired: jest.fn(),
    getUserAttribute: jest.fn(),
    hasRole: jest.fn(),
  })),
  cleanupAuthStore: jest.fn(),
}));

// Store original console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
};

// Suppress specific console errors during tests
beforeAll(() => {
  // Create a more robust console.error mock
  console.error = jest.fn((...args: any[]) => {
    const message = args[0]?.toString() || '';
    
    // List of errors to suppress
    const suppressedErrors = [
      'Warning: ReactDOM.render',
      'Not implemented: HTMLCanvasElement',
      'Error: Could not parse CSS stylesheet',
      'WebGPU is not supported',
      'WebGPU not available',
      'Failed to create WebGL context',
    ];
    
    // Check if this error should be suppressed
    const shouldSuppress = suppressedErrors.some(error => message.includes(error));
    
    if (!shouldSuppress) {
      // Call original error for non-suppressed errors
      originalConsole.error.apply(console, args);
    }
  });
  
  // Also mock warn to reduce noise
  console.warn = jest.fn((...args: any[]) => {
    const message = args[0]?.toString() || '';
    
    const suppressedWarnings = [
      'THREE.',
      'WebGL',
      'GPU',
    ];
    
    const shouldSuppress = suppressedWarnings.some(warning => message.includes(warning));
    
    if (!shouldSuppress) {
      originalConsole.warn.apply(console, args);
    }
  });
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.log = originalConsole.log;
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});