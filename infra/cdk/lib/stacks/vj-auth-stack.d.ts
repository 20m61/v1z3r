/**
 * AWS Cognito Authentication Stack for v1z3r
 * Provides user authentication, authorization, and session management
 */
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
export interface VjAuthStackProps extends cdk.StackProps {
    environment: 'dev' | 'staging' | 'prod';
    apiGateway?: apigateway.RestApi;
}
export declare class VjAuthStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
    constructor(scope: Construct, id: string, props: VjAuthStackProps);
}
