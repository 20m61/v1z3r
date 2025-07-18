import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
export interface VjWebSocketStackProps extends cdk.StackProps {
    stage: string;
    sessionTable: dynamodb.Table;
    configTable: dynamodb.Table;
    presetTable: dynamodb.Table;
    connectionFunction: lambda.Function;
    messageFunction: lambda.Function;
    healthFunction: lambda.Function;
}
export declare class VjWebSocketStack extends cdk.Stack {
    readonly websocketApi: apigatewayv2.WebSocketApi;
    readonly websocketStage: apigatewayv2.WebSocketStage;
    readonly websocketUrl: string;
    constructor(scope: Construct, id: string, props: VjWebSocketStackProps);
}
