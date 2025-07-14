import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface VjApiStackProps extends cdk.StackProps {
    stage: string;
    config: {
        domainName: string;
        enableAuth: boolean;
        enableCloudFront: boolean;
        enableBackup: boolean;
    };
    sessionTable: dynamodb.Table;
    presetTable: dynamodb.Table;
    configTable: dynamodb.Table;
}
export declare class VjApiStack extends cdk.Stack {
    readonly restApi: apigateway.RestApi;
    readonly websocketApi: apigatewayv2.WebSocketApi;
    readonly apiUrl: string;
    readonly websocketUrl: string;
    readonly presetFunction: lambda.Function;
    readonly connectionFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: VjApiStackProps);
}
