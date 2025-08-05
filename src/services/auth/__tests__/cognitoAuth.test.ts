/**
 * CognitoAuthService Tests
 */

import { CognitoAuthService, cognitoAuth } from '../cognitoAuth';
import { cognitoAuthImpl } from '../cognitoAuthImplementation';

// Mock the implementation
jest.mock('../cognitoAuthImplementation', () => ({
  cognitoAuthImpl: {
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationCode: jest.fn(),
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
    changePassword: jest.fn(),
  },
}));

// Mock error handler
jest.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('CognitoAuthService', () => {
  let service: CognitoAuthService;
  const mockCognitoImpl = cognitoAuthImpl as jest.Mocked<typeof cognitoAuthImpl>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new service instance
    service = new CognitoAuthService();
    
    // Reset environment variables
    process.env.NODE_ENV = 'test';
    process.env.NEXT_PUBLIC_USE_MOCK_AUTH = 'false';
  });

  describe('signIn', () => {
    it('should call real implementation when not in mock mode', async () => {
      const mockResponse = {
        success: true,
        user: { id: 'user-123', email: 'test@example.com' },
        tokens: {
          accessToken: 'access-token',
          idToken: 'id-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      };

      mockCognitoImpl.signIn.mockResolvedValue(mockResponse);

      const result = await service.signIn('test@example.com', 'password123');

      expect(mockCognitoImpl.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toEqual(mockResponse);
    });

    it('should use mock implementation when in development with mock flag', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_USE_MOCK_AUTH = 'true';

      const result = await service.signIn('test@example.com', 'Test123!@#');

      expect(mockCognitoImpl.signIn).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
    });

    it('should handle MFA challenge response', async () => {
      const mockResponse = {
        success: false,
        challengeName: 'MFA_REQUIRED',
        session: JSON.stringify({ challengeName: 'MFA_REQUIRED', challengeParameters: {} }),
      };

      mockCognitoImpl.signIn.mockResolvedValue(mockResponse);

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.challengeName).toBe('MFA_REQUIRED');
      expect(result.session).toBeDefined();
    });

    it('should handle sign in errors', async () => {
      const error = new Error('Invalid credentials');
      mockCognitoImpl.signIn.mockRejectedValue(error);

      await expect(service.signIn('test@example.com', 'wrong-password')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Mock Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_USE_MOCK_AUTH = 'true';
    });

    it('should return mock data for valid credentials', async () => {
      const result = await service.signIn('test@example.com', 'Test123!@#');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 'mock-user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        vjHandle: 'test_vj',
        tier: 'premium',
        emailVerified: true,
        groups: ['premium'],
      });
      expect(result.tokens).toBeDefined();
    });

    it('should throw error for invalid mock credentials', async () => {
      await expect(service.signIn('test@example.com', 'wrong-password')).rejects.toThrow('Invalid credentials');
    });

    it('should return mock sign up response', async () => {
      const result = await service.signUp({
        username: 'new@example.com',
        password: 'Password123!',
        attributes: { email: 'new@example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.userSub).toMatch(/^mock-user-sub-/);
    });

    it('should validate mock verification code', async () => {
      const validResult = await service.verifyEmail('test@example.com', '123456');
      expect(validResult).toBe(true);

      const invalidResult = await service.verifyEmail('test@example.com', '999999');
      expect(invalidResult).toBe(false);
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(cognitoAuth).toBeDefined();
      expect(cognitoAuth).toBeInstanceOf(CognitoAuthService);
    });
  });
});