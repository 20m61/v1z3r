/**
 * Enhanced test setup for comprehensive testing
 * Uses shared test utilities for consistency
 */

import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';
import { 
  setupConsoleMocks, 
  restoreConsoleMocks, 
  setupBrowserMocks, 
  setupCanvasMocks, 
  setupAudioMocks 
} from '@vj-app/test-utils';

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Setup browser mocks using shared utilities
const localStorageMock = setupBrowserMocks();
setupCanvasMocks();
setupAudioMocks();

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

// Setup console mocks using shared utilities
beforeAll(() => {
  setupConsoleMocks();
});

afterAll(() => {
  restoreConsoleMocks();
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});