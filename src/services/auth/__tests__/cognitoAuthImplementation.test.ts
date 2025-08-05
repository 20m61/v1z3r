/**
 * Tests for AWS Cognito Authentication Implementation
 */

import { CognitoAuthServiceImpl } from '../cognitoAuthImplementation';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
  CognitoRefreshToken,
} from 'amazon-cognito-identity-js';

// Mock amazon-cognito-identity-js
jest.mock('amazon-cognito-identity-js');

// Mock errorHandler to prevent console errors
jest.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

describe('CognitoAuthServiceImpl', () => {
  let authService: CognitoAuthServiceImpl;
  let mockUserPool: jest.Mocked<CognitoUserPool>;
  let mockCognitoUser: jest.Mocked<CognitoUser>;
  let mockSession: jest.Mocked<CognitoUserSession>;
  
  // Store original env vars
  const originalEnv = process.env;

  beforeAll(() => {
    // Set test environment variables
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_AWS_REGION: 'us-east-1',
      NEXT_PUBLIC_USER_POOL_ID: 'us-east-1_test123',
      NEXT_PUBLIC_USER_POOL_CLIENT_ID: 'test-client-id',
      NEXT_PUBLIC_IDENTITY_POOL_ID: 'us-east-1:test-identity-pool',
    };
  });

  afterAll(() => {
    // Restore original env vars
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    authService = new CognitoAuthServiceImpl();
    
    // Setup mocks
    mockSession = {
      getIdToken: jest.fn().mockReturnValue({
        getJwtToken: jest.fn().mockReturnValue('mock-id-token'),
      }),
      getAccessToken: jest.fn().mockReturnValue({
        getJwtToken: jest.fn().mockReturnValue('mock-access-token'),
      }),
      getRefreshToken: jest.fn().mockReturnValue({
        getToken: jest.fn().mockReturnValue('mock-refresh-token'),
      }),
      isValid: jest.fn().mockReturnValue(true),
    } as any;

    mockCognitoUser = {
      authenticateUser: jest.fn(),
      confirmRegistration: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      forgotPassword: jest.fn(),
      confirmPassword: jest.fn(),
      sendMFACode: jest.fn(),
      resendConfirmationCode: jest.fn(),
      refreshSession: jest.fn(),
      getUserAttributes: jest.fn(),
      updateAttributes: jest.fn(),
      getUsername: jest.fn().mockReturnValue('testuser'),
    } as any;

    mockUserPool = {
      signUp: jest.fn(),
      getCurrentUser: jest.fn().mockReturnValue(mockCognitoUser),
    } as any;

    (CognitoUserPool as jest.Mock).mockImplementation(() => mockUserPool);
    (CognitoUser as jest.Mock).mockImplementation(() => mockCognitoUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize user pool on construction', () => {
      expect(CognitoUserPool).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        ClientId: 'test-client-id',
      });
    });

    it('should handle missing configuration gracefully', () => {
      // Clear env vars temporarily
      const tempEnv = process.env;
      process.env = { ...tempEnv };
      delete process.env.NEXT_PUBLIC_USER_POOL_ID;
      delete process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID;
      
      const { errorHandler } = require('@/utils/errorHandler');
      
      // Create new instance without config
      new CognitoAuthServiceImpl();
      
      expect(errorHandler.error).toHaveBeenCalledWith(
        'Failed to initialize Cognito',
        expect.any(Error)
      );
      
      // Restore env vars
      process.env = tempEnv;
    });
  });

  describe('signUp', () => {

    it('should sign up a new user successfully', async () => {
      const mockResult = {
        user: mockCognitoUser,
        userConfirmed: false,
        userSub: 'user-sub-123',
      };

      mockUserPool.signUp.mockImplementation((username, password, attrs, validationData, callback) => {
        callback!(null, mockResult as any);
      });

      const result = await authService.signUp('test@example.com', 'Password123!', {
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.userSub).toBe('user-sub-123');
      expect(result.userConfirmed).toBe(false);
    });

    it('should handle sign up errors', async () => {
      const mockError = new Error('User already exists');

      mockUserPool.signUp.mockImplementation((username, password, attrs, validationData, callback) => {
        callback!(mockError, null as any);
      });

      const result = await authService.signUp('test@example.com', 'Password123!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
    });
  });

  describe('signIn', () => {

    it('should sign in user successfully', async () => {
      mockCognitoUser.authenticateUser.mockImplementation((authDetails, callbacks) => {
        callbacks.onSuccess!(mockSession);
      });

      const result = await authService.signIn('test@example.com', 'Password123!');

      expect(result.success).toBe(true);
      expect(result.tokens).toEqual({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should handle MFA challenge', async () => {
      mockCognitoUser.authenticateUser.mockImplementation((authDetails, callbacks) => {
        callbacks.mfaRequired!('SMS_MFA', {});
      });

      const result = await authService.signIn('test@example.com', 'Password123!');

      expect(result.success).toBe(false);
      expect(result.challengeName).toBe('SMS_MFA');
    });

    it('should handle sign in errors', async () => {
      mockCognitoUser.authenticateUser.mockImplementation((authDetails, callbacks) => {
        callbacks.onFailure!(new Error('Incorrect username or password'));
      });

      const result = await authService.signIn('test@example.com', 'WrongPassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Incorrect username or password');
    });
  });

  describe('confirmSignUp', () => {

    it('should confirm sign up successfully', async () => {
      mockCognitoUser.confirmRegistration.mockImplementation((code, forceAlias, callback) => {
        callback(null, 'SUCCESS');
      });

      const result = await authService.confirmSignUp('test@example.com', '123456');

      expect(result.success).toBe(true);
    });

    it('should handle confirmation errors', async () => {
      mockCognitoUser.confirmRegistration.mockImplementation((code, forceAlias, callback) => {
        callback(new Error('Invalid verification code'), null);
      });

      const result = await authService.confirmSignUp('test@example.com', 'wrong-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
    });
  });

  describe('signOut', () => {

    it('should sign out user successfully', async () => {
      mockCognitoUser.signOut.mockImplementation((callback) => {
        if (callback) callback();
      });

      const result = await authService.signOut();

      expect(result.success).toBe(true);
      expect(mockCognitoUser.signOut).toHaveBeenCalled();
    });

    it('should handle sign out when no user is signed in', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(null);

      const result = await authService.signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No user is currently signed in');
    });
  });

  describe('getCurrentUser', () => {

    it('should get current user successfully', async () => {
      mockCognitoUser.getSession.mockImplementation((callback: any) => {
        callback(null, mockSession);
      });

      const result = await authService.getCurrentUser();

      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe('testuser');
    });

    it('should return null when no user is signed in', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(null);

      const result = await authService.getCurrentUser();

      expect(result.user).toBeNull();
    });
  });

  describe('refreshToken', () => {

    it('should refresh token successfully', async () => {
      const mockRefreshToken = new CognitoRefreshToken({ RefreshToken: 'refresh-token' });
      
      mockCognitoUser.refreshSession.mockImplementation((token, callback) => {
        callback(null, mockSession);
      });

      const result = await authService.refreshToken('refresh-token');

      expect(result.success).toBe(true);
      expect(result.tokens).toEqual({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should handle refresh token errors', async () => {
      mockCognitoUser.refreshSession.mockImplementation((token, callback) => {
        callback(new Error('Token expired'), null);
      });

      const result = await authService.refreshToken('expired-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
    });
  });

  describe('forgotPassword', () => {

    it('should initiate forgot password successfully', async () => {
      mockCognitoUser.forgotPassword.mockImplementation((callbacks) => {
        callbacks.onSuccess!({ CodeDeliveryDetails: { DeliveryMedium: 'EMAIL' } } as any);
      });

      const result = await authService.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
    });

    it('should handle forgot password errors', async () => {
      mockCognitoUser.forgotPassword.mockImplementation((callbacks) => {
        callbacks.onFailure!(new Error('User not found'));
      });

      const result = await authService.forgotPassword('nonexistent@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('confirmForgotPassword', () => {

    it('should confirm forgot password successfully', async () => {
      mockCognitoUser.confirmPassword.mockImplementation((code, password, callbacks) => {
        callbacks.onSuccess!('SUCCESS');
      });

      const result = await authService.confirmForgotPassword(
        'test@example.com',
        '123456',
        'NewPassword123!'
      );

      expect(result.success).toBe(true);
    });

    it('should handle confirm password errors', async () => {
      mockCognitoUser.confirmPassword.mockImplementation((code, password, callbacks) => {
        callbacks.onFailure!(new Error('Invalid verification code'));
      });

      const result = await authService.confirmForgotPassword(
        'test@example.com',
        'wrong-code',
        'NewPassword123!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
    });
  });

  describe('sendMFACode', () => {

    it('should send MFA code successfully', async () => {
      mockCognitoUser.sendMFACode.mockImplementation((code, callbacks) => {
        callbacks.onSuccess!(mockSession);
      });

      const result = await authService.sendMFACode('123456');

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
    });

    it('should handle MFA code errors', async () => {
      mockCognitoUser.sendMFACode.mockImplementation((code, callbacks) => {
        callbacks.onFailure!(new Error('Invalid MFA code'));
      });

      const result = await authService.sendMFACode('wrong-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid MFA code');
    });
  });
});