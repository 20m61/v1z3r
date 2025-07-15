/**
 * AWS Cognito Authentication Stack for v1z3r
 * Provides user authentication, authorization, and session management
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface VjAuthStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  apiGateway?: apigateway.RestApi;
}

export class VjAuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
  
  constructor(scope: Construct, id: string, props: VjAuthStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'VjUserPool', {
      userPoolName: `vj-app-users-${environment}`,
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: 'Verify your v1z3r account',
        emailBody: 'Welcome to v1z3r! Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInAliases: {
        email: true,
        username: false,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        tier: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 20,
          mutable: true,
        }),
        vjHandle: new cognito.StringAttribute({
          minLen: 3,
          maxLen: 30,
          mutable: true,
        }),
        preferences: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 2048,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
    });

    // Create Lambda function for post-confirmation trigger
    const postConfirmationLambda = new lambda.Function(this, 'PostConfirmationTrigger', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
          console.log('Post confirmation trigger:', JSON.stringify(event, null, 2));
          
          if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
            const { userAttributes } = event.request;
            
            // Create user profile in DynamoDB
            const params = {
              TableName: process.env.USER_PROFILE_TABLE,
              Item: {
                userId: userAttributes.sub,
                email: userAttributes.email,
                createdAt: new Date().toISOString(),
                tier: 'free',
                presetCount: 0,
                storageUsed: 0,
              }
            };
            
            try {
              await dynamodb.put(params).promise();
              console.log('User profile created successfully');
            } catch (error) {
              console.error('Error creating user profile:', error);
              // Don't throw error to prevent sign-up failure
            }
          }
          
          return event;
        };
      `),
      environment: {
        USER_PROFILE_TABLE: `vj-user-profiles-${environment}`,
      },
      timeout: cdk.Duration.seconds(10),
    });

    // Grant permissions to Lambda
    postConfirmationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [`arn:aws:dynamodb:${this.region}:${this.account}:table/vj-user-profiles-${environment}`],
    }));

    // Add Lambda trigger to user pool
    this.userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationLambda
    );

    // Create Lambda function for pre-authentication trigger
    const preAuthenticationLambda = new lambda.Function(this, 'PreAuthenticationTrigger', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Pre authentication trigger:', JSON.stringify(event, null, 2));
          
          // Add custom authentication logic here
          // For example: check if user is blocked, enforce additional rules, etc.
          
          const { userAttributes } = event.request;
          
          // Example: Block users with specific email domains
          const blockedDomains = ['tempmail.com', 'throwaway.email'];
          const emailDomain = userAttributes.email.split('@')[1];
          
          if (blockedDomains.includes(emailDomain)) {
            throw new Error('Authentication blocked: Invalid email domain');
          }
          
          // Example: Check failed login attempts (would need DynamoDB integration)
          // const failedAttempts = await getFailedAttempts(userAttributes.sub);
          // if (failedAttempts > 5) {
          //   throw new Error('Account temporarily locked due to failed attempts');
          // }
          
          return event;
        };
      `),
      timeout: cdk.Duration.seconds(5),
    });

    // Add pre-authentication trigger
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_AUTHENTICATION,
      preAuthenticationLambda
    );

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'VjUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `vj-app-client-${environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      generateSecret: false, // For web clients
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: environment === 'prod'
          ? ['https://app.v1z3r.com/auth/callback']
          : [`http://localhost:3000/auth/callback`, `https://${environment}.v1z3r.com/auth/callback`],
        logoutUrls: environment === 'prod'
          ? ['https://app.v1z3r.com/']
          : [`http://localhost:3000/`, `https://${environment}.v1z3r.com/`],
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          fullname: true,
          email: true,
          emailVerified: true,
        })
        .withCustomAttributes('tier', 'vjHandle', 'preferences'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          fullname: true,
          email: true,
        })
        .withCustomAttributes('vjHandle', 'preferences'),
    });

    // Create API Gateway Authorizer
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'VjApiAuthorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: `vj-api-authorizer-${environment}`,
      identitySource: 'method.request.header.Authorization',
    });

    // Create User Pool Domain for hosted UI (optional)
    const userPoolDomain = new cognito.UserPoolDomain(this, 'VjUserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `vj-app-${environment}-${this.account}`,
      },
    });

    // Create User Pool Groups
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admins',
      description: 'Administrator users with full access',
      precedence: 1,
    });

    const premiumGroup = new cognito.CfnUserPoolGroup(this, 'PremiumGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'premium',
      description: 'Premium tier users with enhanced features',
      precedence: 10,
    });

    const standardGroup = new cognito.CfnUserPoolGroup(this, 'StandardGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'standard',
      description: 'Standard tier users',
      precedence: 20,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `vj-user-pool-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `vj-user-pool-client-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainName', {
      value: userPoolDomain.domainName,
      description: 'Cognito User Pool Domain',
      exportName: `vj-user-pool-domain-${environment}`,
    });

    new cdk.CfnOutput(this, 'AuthorizerRef', {
      value: this.authorizer.authorizerId,
      description: 'API Gateway Authorizer ID',
      exportName: `vj-api-authorizer-id-${environment}`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Project', 'vj-app');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Stack', 'auth');
  }
}