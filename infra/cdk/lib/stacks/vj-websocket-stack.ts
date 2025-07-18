import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
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

export class VjWebSocketStack extends cdk.Stack {
  public readonly websocketApi: apigatewayv2.WebSocketApi;
  public readonly websocketStage: apigatewayv2.WebSocketStage;
  public readonly websocketUrl: string;

  constructor(scope: Construct, id: string, props: VjWebSocketStackProps) {
    super(scope, id, props);

    const { 
      stage, 
      sessionTable, 
      configTable, 
      presetTable,
      connectionFunction,
      messageFunction,
      healthFunction
    } = props;

    // Create WebSocket API
    this.websocketApi = new apigatewayv2.WebSocketApi(this, 'VjWebSocketApi', {
      apiName: `vj-websocket-${stage}`,
      description: `VJ Application WebSocket API - ${stage}`,
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          connectionFunction
        ),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          connectionFunction
        ),
      },
      defaultRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          messageFunction
        ),
      },
    });

    // Add custom routes
    this.websocketApi.addRoute('ping', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'PingIntegration',
        messageFunction
      ),
    });

    this.websocketApi.addRoute('sync', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'SyncIntegration',
        messageFunction
      ),
    });

    this.websocketApi.addRoute('preset', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'PresetIntegration',
        messageFunction
      ),
    });

    this.websocketApi.addRoute('performance', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'PerformanceIntegration',
        messageFunction
      ),
    });

    this.websocketApi.addRoute('chat', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'ChatIntegration',
        messageFunction
      ),
    });

    // Create deployment stage
    this.websocketStage = new apigatewayv2.WebSocketStage(this, 'VjWebSocketStage', {
      webSocketApi: this.websocketApi,
      stageName: stage,
      autoDeploy: true,
      throttle: {
        rateLimit: stage === 'prod' ? 1000 : 100,
        burstLimit: stage === 'prod' ? 2000 : 200,
      },
      defaultRouteThrottleSettings: {
        rateLimit: stage === 'prod' ? 100 : 10,
        burstLimit: stage === 'prod' ? 200 : 20,
      },
    });

    // Create CloudWatch Log Group for WebSocket API
    const logGroup = new logs.LogGroup(this, 'WebSocketLogGroup', {
      logGroupName: `/aws/apigateway/websocket/${this.websocketApi.apiId}/${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grant permissions to Lambda functions
    const websocketManagementPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/${stage}/*`,
      ],
    });

    connectionFunction.addToRolePolicy(websocketManagementPolicy);
    messageFunction.addToRolePolicy(websocketManagementPolicy);

    // Update Lambda environment variables with WebSocket endpoint
    const websocketEndpoint = `https://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`;
    
    connectionFunction.addEnvironment('WEBSOCKET_ENDPOINT', websocketEndpoint);
    messageFunction.addEnvironment('WEBSOCKET_ENDPOINT', websocketEndpoint);
    healthFunction.addEnvironment('WEBSOCKET_ENDPOINT', websocketEndpoint);

    // Grant table permissions
    sessionTable.grantReadWriteData(connectionFunction);
    sessionTable.grantReadWriteData(messageFunction);
    configTable.grantReadWriteData(connectionFunction);
    configTable.grantReadWriteData(messageFunction);
    configTable.grantReadWriteData(healthFunction);
    presetTable.grantReadData(messageFunction);

    // Store WebSocket URL
    this.websocketUrl = `wss://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`;

    // Outputs
    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.websocketApi.apiId,
      description: 'WebSocket API ID',
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: this.websocketUrl,
      description: 'WebSocket URL',
    });

    new cdk.CfnOutput(this, 'WebSocketEndpoint', {
      value: websocketEndpoint,
      description: 'WebSocket Management Endpoint',
    });

    // Tags
    cdk.Tags.of(this).add('Component', 'WebSocket');
    cdk.Tags.of(this).add('Stage', stage);
  }
}