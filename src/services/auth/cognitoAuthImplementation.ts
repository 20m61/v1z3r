/**
 * AWS Cognito Authentication Service Implementation
 * Real implementation using amazon-cognito-identity-js
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
  CognitoRefreshToken,
  ISignUpResult,
  ICognitoUserData,
  ChallengeName,
} from 'amazon-cognito-identity-js';
import { errorHandler } from '@/utils/errorHandler';
import type { AuthTokens, UserAttributes } from './cognitoAuth';

// Configuration
const COGNITO_CONFIG = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
  clientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '',
  identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID || '',
};

// Validation helper
const validateConfig = () => {
  if (!COGNITO_CONFIG.userPoolId || !COGNITO_CONFIG.clientId) {
    throw new Error('AWS Cognito configuration is missing. Please set NEXT_PUBLIC_USER_POOL_ID and NEXT_PUBLIC_USER_POOL_CLIENT_ID');
  }
};

/**
 * Real AWS Cognito Authentication Service Implementation
 */
export class CognitoAuthServiceImpl {
  private userPool: CognitoUserPool | null = null;

  constructor() {
    try {
      validateConfig();
      this.initializeUserPool();
    } catch (error) {
      errorHandler.error('Failed to initialize Cognito', error as Error);
    }
  }

  private initializeUserPool() {
    this.userPool = new CognitoUserPool({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      ClientId: COGNITO_CONFIG.clientId,
    });
  }

  /**
   * Sign in user with email and password
   */
  async signIn(email: string, password: string): Promise<{
    success: boolean;
    user?: any;
    tokens?: AuthTokens;
    challengeName?: string;
    session?: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const userData: ICognitoUserData = {
        Username: email,
        Pool: this.userPool,
      };

      const cognitoUser = new CognitoUser(userData);

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          // Get user attributes
          cognitoUser.getUserAttributes((err, attributes) => {
            if (err) {
              errorHandler.error('Failed to get user attributes', err);
            }

            const userAttributes = this.parseUserAttributes(attributes || []);
            
            resolve({
              success: true,
              user: {
                id: session.getIdToken().payload.sub,
                email: userAttributes.email,
                fullName: userAttributes.name,
                vjHandle: userAttributes['custom:vj_handle'],
                tier: userAttributes['custom:tier'],
                emailVerified: userAttributes.email_verified === 'true',
                groups: session.getAccessToken().payload['cognito:groups'] || [],
              },
              tokens: {
                accessToken: session.getAccessToken().getJwtToken(),
                idToken: session.getIdToken().getJwtToken(),
                refreshToken: session.getRefreshToken().getToken(),
                expiresIn: 3600, // Default to 1 hour
              },
            });
          });
        },
        onFailure: (err) => {
          errorHandler.error('Sign in failed', err);
          reject(err);
        },
        mfaRequired: (challengeName, challengeParameters) => {
          resolve({
            success: false,
            challengeName: 'MFA_REQUIRED',
            session: JSON.stringify({ challengeName, challengeParameters }),
          });
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          resolve({
            success: false,
            challengeName: 'NEW_PASSWORD_REQUIRED',
            session: JSON.stringify({ userAttributes, requiredAttributes }),
          });
        },
      });
    });
  }

  /**
   * Sign up new user
   */
  async signUp(params: {
    username: string;
    password: string;
    attributes: UserAttributes;
  }): Promise<{ success: boolean; userSub?: string; codeDeliveryDetails?: any }> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const attributeList: CognitoUserAttribute[] = [];

      // Add email attribute
      attributeList.push(
        new CognitoUserAttribute({
          Name: 'email',
          Value: params.attributes.email,
        })
      );

      // Add optional attributes
      if (params.attributes.name) {
        attributeList.push(
          new CognitoUserAttribute({
            Name: 'name',
            Value: params.attributes.name,
          })
        );
      }

      if (params.attributes['custom:vj_handle']) {
        attributeList.push(
          new CognitoUserAttribute({
            Name: 'custom:vj_handle',
            Value: params.attributes['custom:vj_handle'],
          })
        );
      }

      if (params.attributes['custom:tier']) {
        attributeList.push(
          new CognitoUserAttribute({
            Name: 'custom:tier',
            Value: params.attributes['custom:tier'],
          })
        );
      }

      this.userPool.signUp(
        params.username,
        params.password,
        attributeList,
        [],
        (err: Error | undefined, result?: ISignUpResult) => {
          if (err) {
            errorHandler.error('Sign up failed', err);
            reject(err);
            return;
          }

          if (result) {
            resolve({
              success: true,
              userSub: result.userSub,
              codeDeliveryDetails: result.codeDeliveryDetails,
            });
          } else {
            reject(new Error('Sign up failed: No result returned'));
          }
        }
      );
    });
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.userPool) {
        resolve();
        return;
      }

      const cognitoUser = this.userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
      
      resolve();
    });
  }

  /**
   * Refresh authentication tokens
   */
  async refreshSession(refreshToken: string): Promise<AuthTokens | null> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const cognitoUser = this.userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      const token = new CognitoRefreshToken({ RefreshToken: refreshToken });

      cognitoUser.refreshSession(token, (err, session) => {
        if (err) {
          errorHandler.error('Session refresh failed', err);
          resolve(null);
          return;
        }

        if (session) {
          resolve({
            accessToken: session.getAccessToken().getJwtToken(),
            idToken: session.getIdToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
            expiresIn: 3600, // Default to 1 hour
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Verify email with confirmation code
   */
  async verifyEmail(email: string, code: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const userData: ICognitoUserData = {
        Username: email,
        Pool: this.userPool,
      };

      const cognitoUser = new CognitoUser(userData);

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          errorHandler.error('Email verification failed', err);
          resolve(false);
          return;
        }

        resolve(result === 'SUCCESS');
      });
    });
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const userData: ICognitoUserData = {
        Username: email,
        Pool: this.userPool,
      };

      const cognitoUser = new CognitoUser(userData);

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          errorHandler.error('Resend verification code failed', err);
          resolve(false);
          return;
        }

        resolve(true);
      });
    });
  }

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(email: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const userData: ICognitoUserData = {
        Username: email,
        Pool: this.userPool,
      };

      const cognitoUser = new CognitoUser(userData);

      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve(true);
        },
        onFailure: (err) => {
          errorHandler.error('Forgot password request failed', err);
          resolve(false);
        },
      });
    });
  }

  /**
   * Confirm forgot password with code
   */
  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const userData: ICognitoUserData = {
        Username: email,
        Pool: this.userPool,
      };

      const cognitoUser = new CognitoUser(userData);

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve(true);
        },
        onFailure: (err) => {
          errorHandler.error('Password reset failed', err);
          resolve(false);
        },
      });
    });
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.userPool) {
        reject(new Error('User pool not initialized'));
        return;
      }

      const cognitoUser = this.userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(false);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          errorHandler.error('Failed to get session', err || new Error('No session'));
          resolve(false);
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
          if (err) {
            errorHandler.error('Password change failed', err);
            resolve(false);
            return;
          }

          resolve(result === 'SUCCESS');
        });
      });
    });
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<CognitoUser | null> {
    if (!this.userPool) {
      return null;
    }

    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) {
      return null;
    }

    return new Promise((resolve) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        resolve(cognitoUser);
      });
    });
  }

  /**
   * Get current session
   */
  async getSession(): Promise<CognitoUserSession | null> {
    const user = await this.getCurrentUser();
    if (!user) {
      return null;
    }

    return new Promise((resolve) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        resolve(session);
      });
    });
  }

  /**
   * Parse user attributes from Cognito format
   */
  private parseUserAttributes(attributes: CognitoUserAttribute[]): Record<string, any> {
    const parsed: Record<string, any> = {};
    
    attributes.forEach((attr) => {
      parsed[attr.getName()] = attr.getValue();
    });

    return parsed;
  }
}

// Export singleton instance
export const cognitoAuthImpl = new CognitoAuthServiceImpl();