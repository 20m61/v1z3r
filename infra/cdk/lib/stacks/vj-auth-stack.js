"use strict";
/**
 * AWS Cognito Authentication Stack for v1z3r
 * Provides user authentication, authorization, and session management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VjAuthStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
class VjAuthStack extends cdk.Stack {
    userPool;
    userPoolClient;
    authorizer;
    constructor(scope, id, props) {
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
        this.userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationLambda);
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
        this.userPool.addTrigger(cognito.UserPoolOperation.PRE_AUTHENTICATION, preAuthenticationLambda);
        // Create User Pool Client
        this.userPoolClient = new cognito.UserPoolClient(this, 'VjUserPoolClient', {
            userPool: this.userPool,
            userPoolClientName: `vj-app-client-${environment}`,
            authFlows: {
                userPassword: true,
                userSrp: true,
                custom: true,
            },
            generateSecret: false,
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
exports.VjAuthStack = VjAuthStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXV0aC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLWF1dGgtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsdUVBQXlEO0FBUXpELE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3hCLFFBQVEsQ0FBbUI7SUFDM0IsY0FBYyxDQUF5QjtJQUN2QyxVQUFVLENBQXdDO0lBRWxFLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDL0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUU5QiwyQkFBMkI7UUFDM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN2RCxZQUFZLEVBQUUsZ0JBQWdCLFdBQVcsRUFBRTtZQUMzQyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGdCQUFnQixFQUFFO2dCQUNoQixZQUFZLEVBQUUsMkJBQTJCO2dCQUN6QyxTQUFTLEVBQUUsb0RBQW9EO2dCQUMvRCxVQUFVLEVBQUUsT0FBTyxDQUFDLHNCQUFzQixDQUFDLElBQUk7YUFDaEQ7WUFDRCxhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLElBQUk7Z0JBQ1gsUUFBUSxFQUFFLEtBQUs7YUFDaEI7WUFDRCxrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFO29CQUNMLFFBQVEsRUFBRSxJQUFJO29CQUNkLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2dCQUNELFFBQVEsRUFBRTtvQkFDUixRQUFRLEVBQUUsS0FBSztvQkFDZixPQUFPLEVBQUUsSUFBSTtpQkFDZDthQUNGO1lB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VUFBVSxFQUFFLDBCQUEwQixXQUFXLEVBQUU7U0FDcEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7WUFDaEMsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsdUJBQXVCLFdBQVcsRUFBRTtTQUNqRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZO1lBQ25DLFdBQVcsRUFBRSwyQkFBMkI7WUFDeEMsVUFBVSxFQUFFLHdCQUF3QixXQUFXLEVBQUU7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsb0JBQW9CO1FBQ3BCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDM0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQXhSRCxrQ0F3UkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFXUyBDb2duaXRvIEF1dGhlbnRpY2F0aW9uIFN0YWNrIGZvciB2MXozclxuICogUHJvdmlkZXMgdXNlciBhdXRoZW50aWNhdGlvbiwgYXV0aG9yaXphdGlvbiwgYW5kIHNlc3Npb24gbWFuYWdlbWVudFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpBdXRoU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6ICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnO1xuICBhcGlHYXRld2F5PzogYXBpZ2F0ZXdheS5SZXN0QXBpO1xufVxuXG5leHBvcnQgY2xhc3MgVmpBdXRoU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXI7XG4gIFxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpBdXRoU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCB9ID0gcHJvcHM7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2xcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1ZqVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGB2ai1hcHAtdXNlcnMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICB1c2VyVmVyaWZpY2F0aW9uOiB7XG4gICAgICAgIGVtYWlsU3ViamVjdDogJ1ZlcmlmeSB5b3VyIHYxejNyIGFjY291bnQnLFxuICAgICAgICBlbWFpbEJvZHk6ICdXZWxjb21lIHRvIHYxejNyISBZb3VyIHZlcmlmaWNhdGlvbiBjb2RlIGlzIHsjIyMjfScsXG4gICAgICAgIGVtYWlsU3R5bGU6IGNvZ25pdG8uVmVyaWZpY2F0aW9uRW1haWxTdHlsZS5DT0RFLFxuICAgICAgfSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIHVzZXJuYW1lOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmdWxsbmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgdGllcjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgdmpIYW5kbGU6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAzLFxuICAgICAgICAgIG1heExlbjogMzAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIHByZWZlcmVuY2VzOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG1pbkxlbjogMCxcbiAgICAgICAgICBtYXhMZW46IDIwNDgsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiAxMixcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXG4gICAgICAgIHRlbXBQYXNzd29yZFZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzKSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgbWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcbiAgICAgIG1mYVNlY29uZEZhY3Rvcjoge1xuICAgICAgICBzbXM6IHRydWUsXG4gICAgICAgIG90cDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhZHZhbmNlZFNlY3VyaXR5TW9kZTogY29nbml0by5BZHZhbmNlZFNlY3VyaXR5TW9kZS5FTkZPUkNFRCxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gZm9yIHBvc3QtY29uZmlybWF0aW9uIHRyaWdnZXJcbiAgICBjb25zdCBwb3N0Q29uZmlybWF0aW9uTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUG9zdENvbmZpcm1hdGlvblRyaWdnZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1Bvc3QgY29uZmlybWF0aW9uIHRyaWdnZXI6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZXZlbnQudHJpZ2dlclNvdXJjZSA9PT0gJ1Bvc3RDb25maXJtYXRpb25fQ29uZmlybVNpZ25VcCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgdXNlckF0dHJpYnV0ZXMgfSA9IGV2ZW50LnJlcXVlc3Q7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSB1c2VyIHByb2ZpbGUgaW4gRHluYW1vREJcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5VU0VSX1BST0ZJTEVfVEFCTEUsXG4gICAgICAgICAgICAgIEl0ZW06IHtcbiAgICAgICAgICAgICAgICB1c2VySWQ6IHVzZXJBdHRyaWJ1dGVzLnN1YixcbiAgICAgICAgICAgICAgICBlbWFpbDogdXNlckF0dHJpYnV0ZXMuZW1haWwsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgdGllcjogJ2ZyZWUnLFxuICAgICAgICAgICAgICAgIHByZXNldENvdW50OiAwLFxuICAgICAgICAgICAgICAgIHN0b3JhZ2VVc2VkOiAwLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5wdXQocGFyYW1zKS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdVc2VyIHByb2ZpbGUgY3JlYXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIHVzZXIgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICAgIC8vIERvbid0IHRocm93IGVycm9yIHRvIHByZXZlbnQgc2lnbi11cCBmYWlsdXJlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBldmVudDtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUl9QUk9GSUxFX1RBQkxFOiBgdmotdXNlci1wcm9maWxlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhXG4gICAgcG9zdENvbmZpcm1hdGlvbkxhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG4gICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvdmotdXNlci1wcm9maWxlcy0ke2Vudmlyb25tZW50fWBdLFxuICAgIH0pKTtcblxuICAgIC8vIEFkZCBMYW1iZGEgdHJpZ2dlciB0byB1c2VyIHBvb2xcbiAgICB0aGlzLnVzZXJQb29sLmFkZFRyaWdnZXIoXG4gICAgICBjb2duaXRvLlVzZXJQb29sT3BlcmF0aW9uLlBPU1RfQ09ORklSTUFUSU9OLFxuICAgICAgcG9zdENvbmZpcm1hdGlvbkxhbWJkYVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uIGZvciBwcmUtYXV0aGVudGljYXRpb24gdHJpZ2dlclxuICAgIGNvbnN0IHByZUF1dGhlbnRpY2F0aW9uTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJlQXV0aGVudGljYXRpb25UcmlnZ2VyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1ByZSBhdXRoZW50aWNhdGlvbiB0cmlnZ2VyOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQWRkIGN1c3RvbSBhdXRoZW50aWNhdGlvbiBsb2dpYyBoZXJlXG4gICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGNoZWNrIGlmIHVzZXIgaXMgYmxvY2tlZCwgZW5mb3JjZSBhZGRpdGlvbmFsIHJ1bGVzLCBldGMuXG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyB1c2VyQXR0cmlidXRlcyB9ID0gZXZlbnQucmVxdWVzdDtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBFeGFtcGxlOiBCbG9jayB1c2VycyB3aXRoIHNwZWNpZmljIGVtYWlsIGRvbWFpbnNcbiAgICAgICAgICBjb25zdCBibG9ja2VkRG9tYWlucyA9IFsndGVtcG1haWwuY29tJywgJ3Rocm93YXdheS5lbWFpbCddO1xuICAgICAgICAgIGNvbnN0IGVtYWlsRG9tYWluID0gdXNlckF0dHJpYnV0ZXMuZW1haWwuc3BsaXQoJ0AnKVsxXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoYmxvY2tlZERvbWFpbnMuaW5jbHVkZXMoZW1haWxEb21haW4pKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0F1dGhlbnRpY2F0aW9uIGJsb2NrZWQ6IEludmFsaWQgZW1haWwgZG9tYWluJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEV4YW1wbGU6IENoZWNrIGZhaWxlZCBsb2dpbiBhdHRlbXB0cyAod291bGQgbmVlZCBEeW5hbW9EQiBpbnRlZ3JhdGlvbilcbiAgICAgICAgICAvLyBjb25zdCBmYWlsZWRBdHRlbXB0cyA9IGF3YWl0IGdldEZhaWxlZEF0dGVtcHRzKHVzZXJBdHRyaWJ1dGVzLnN1Yik7XG4gICAgICAgICAgLy8gaWYgKGZhaWxlZEF0dGVtcHRzID4gNSkge1xuICAgICAgICAgIC8vICAgdGhyb3cgbmV3IEVycm9yKCdBY2NvdW50IHRlbXBvcmFyaWx5IGxvY2tlZCBkdWUgdG8gZmFpbGVkIGF0dGVtcHRzJyk7XG4gICAgICAgICAgLy8gfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBldmVudDtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgcHJlLWF1dGhlbnRpY2F0aW9uIHRyaWdnZXJcbiAgICB0aGlzLnVzZXJQb29sLmFkZFRyaWdnZXIoXG4gICAgICBjb2duaXRvLlVzZXJQb29sT3BlcmF0aW9uLlBSRV9BVVRIRU5USUNBVElPTixcbiAgICAgIHByZUF1dGhlbnRpY2F0aW9uTGFtYmRhXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIFBvb2wgQ2xpZW50XG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdWalVzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGB2ai1hcHAtY2xpZW50LSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgIGN1c3RvbTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIEZvciB3ZWIgY2xpZW50c1xuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICAgIGltcGxpY2l0Q29kZUdyYW50OiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgIF0sXG4gICAgICAgIGNhbGxiYWNrVXJsczogZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gWydodHRwczovL2FwcC52MXozci5jb20vYXV0aC9jYWxsYmFjayddXG4gICAgICAgICAgOiBbYGh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrYCwgYGh0dHBzOi8vJHtlbnZpcm9ubWVudH0udjF6M3IuY29tL2F1dGgvY2FsbGJhY2tgXSxcbiAgICAgICAgbG9nb3V0VXJsczogZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gWydodHRwczovL2FwcC52MXozci5jb20vJ11cbiAgICAgICAgICA6IFtgaHR0cDovL2xvY2FsaG9zdDozMDAwL2AsIGBodHRwczovLyR7ZW52aXJvbm1lbnR9LnYxejNyLmNvbS9gXSxcbiAgICAgIH0sXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICAgIGVuYWJsZVRva2VuUmV2b2NhdGlvbjogdHJ1ZSxcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5taW51dGVzKDYwKSxcbiAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNjApLFxuICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgIHJlYWRBdHRyaWJ1dGVzOiBuZXcgY29nbml0by5DbGllbnRBdHRyaWJ1dGVzKClcbiAgICAgICAgLndpdGhTdGFuZGFyZEF0dHJpYnV0ZXMoe1xuICAgICAgICAgIGZ1bGxuYW1lOiB0cnVlLFxuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICAgIC53aXRoQ3VzdG9tQXR0cmlidXRlcygndGllcicsICd2akhhbmRsZScsICdwcmVmZXJlbmNlcycpLFxuICAgICAgd3JpdGVBdHRyaWJ1dGVzOiBuZXcgY29nbml0by5DbGllbnRBdHRyaWJ1dGVzKClcbiAgICAgICAgLndpdGhTdGFuZGFyZEF0dHJpYnV0ZXMoe1xuICAgICAgICAgIGZ1bGxuYW1lOiB0cnVlLFxuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgICAud2l0aEN1c3RvbUF0dHJpYnV0ZXMoJ3ZqSGFuZGxlJywgJ3ByZWZlcmVuY2VzJyksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXkgQXV0aG9yaXplclxuICAgIHRoaXMuYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdWakFwaUF1dGhvcml6ZXInLCB7XG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdGhpcy51c2VyUG9vbF0sXG4gICAgICBhdXRob3JpemVyTmFtZTogYHZqLWFwaS1hdXRob3JpemVyLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgUG9vbCBEb21haW4gZm9yIGhvc3RlZCBVSSAob3B0aW9uYWwpXG4gICAgY29uc3QgdXNlclBvb2xEb21haW4gPSBuZXcgY29nbml0by5Vc2VyUG9vbERvbWFpbih0aGlzLCAnVmpVc2VyUG9vbERvbWFpbicsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6IGB2ai1hcHAtJHtlbnZpcm9ubWVudH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIEdyb3Vwc1xuICAgIGNvbnN0IGFkbWluR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdBZG1pbkdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnYWRtaW5zJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW5pc3RyYXRvciB1c2VycyB3aXRoIGZ1bGwgYWNjZXNzJyxcbiAgICAgIHByZWNlZGVuY2U6IDEsXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcmVtaXVtR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdQcmVtaXVtR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdwcmVtaXVtJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJlbWl1bSB0aWVyIHVzZXJzIHdpdGggZW5oYW5jZWQgZmVhdHVyZXMnLFxuICAgICAgcHJlY2VkZW5jZTogMTAsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdGFuZGFyZEdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnU3RhbmRhcmRHcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ3N0YW5kYXJkJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RhbmRhcmQgdGllciB1c2VycycsXG4gICAgICBwcmVjZWRlbmNlOiAyMCxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGB2ai11c2VyLXBvb2wtaWQtJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYHZqLXVzZXItcG9vbC1jbGllbnQtaWQtJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sRG9tYWluTmFtZScsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbERvbWFpbi5kb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBEb21haW4nLFxuICAgICAgZXhwb3J0TmFtZTogYHZqLXVzZXItcG9vbC1kb21haW4tJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1dGhvcml6ZXJSZWYnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdXRob3JpemVyLmF1dGhvcml6ZXJJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgQXV0aG9yaXplciBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgdmotYXBpLWF1dGhvcml6ZXItaWQtJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgLy8gVGFnIGFsbCByZXNvdXJjZXNcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAndmotYXBwJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrJywgJ2F1dGgnKTtcbiAgfVxufSJdfQ==