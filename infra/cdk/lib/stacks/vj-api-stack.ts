import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
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

export class VjApiStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly websocketApi: apigatewayv2.WebSocketApi;
  public readonly apiUrl: string;
  public readonly websocketUrl: string;

  constructor(scope: Construct, id: string, props: VjApiStackProps) {
    super(scope, id, props);

    const { stage, config, sessionTable, presetTable, configTable } = props;

    // Lambda layer for shared dependencies
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('lambda-layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared dependencies for VJ application Lambda functions',
    });

    // Common Lambda function environment variables
    const commonEnvironment = {
      SESSION_TABLE_NAME: sessionTable.tableName,
      PRESET_TABLE_NAME: presetTable.tableName,
      CONFIG_TABLE_NAME: configTable.tableName,
      STAGE: stage,
      CORS_ORIGIN: stage === 'prod' ? `https://${config.domainName}` : '*',
    };

    // REST API for preset management and configuration
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `vj-api-${stage}`,
      description: `VJ Application REST API - ${stage}`,
      defaultCorsPreflightOptions: {
        allowOrigins: stage === 'prod' 
          ? [`https://${config.domainName}`]
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
      deployOptions: {
        stageName: stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: stage !== 'prod',
        metricsEnabled: true,
      },
    });

    // Preset management Lambda function
    const presetFunction = new lambda.Function(this, 'PresetFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'preset.handler',
      code: lambda.Code.fromAsset('lambda/preset'),
      layers: [sharedLayer],
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions
    presetTable.grantReadWriteData(presetFunction);
    configTable.grantReadData(presetFunction);

    // Preset API endpoints
    const presetResource = this.restApi.root.addResource('presets');
    presetResource.addMethod('GET', new apigateway.LambdaIntegration(presetFunction));
    presetResource.addMethod('POST', new apigateway.LambdaIntegration(presetFunction));

    const presetItemResource = presetResource.addResource('{presetId}');
    presetItemResource.addMethod('GET', new apigateway.LambdaIntegration(presetFunction));
    presetItemResource.addMethod('PUT', new apigateway.LambdaIntegration(presetFunction));
    presetItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(presetFunction));

    // Health check endpoint
    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              stage: process.env.STAGE,
              version: '1.0.0',
            }),
          };
        };
      `),
      environment: { STAGE: stage },
      timeout: cdk.Duration.seconds(10),
    });

    const healthResource = this.restApi.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthFunction));

    // WebSocket API for real-time communication
    this.websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `vj-websocket-${stage}`,
      description: `VJ Application WebSocket API - ${stage}`,
    });

    // WebSocket connection handler
    const connectionFunction = new lambda.Function(this, 'ConnectionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'connection.handler',
      code: lambda.Code.fromAsset('lambda/websocket'),
      layers: [sharedLayer],
      environment: {
        ...commonEnvironment,
        WEBSOCKET_API_ID: this.websocketApi.apiId,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions for connection management
    sessionTable.grantReadWriteData(connectionFunction);
    configTable.grantReadData(connectionFunction);

    // Grant API Gateway management permissions
    connectionFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/*`
      ],
    }));

    // WebSocket message handler
    const messageFunction = new lambda.Function(this, 'MessageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'message.handler',
      code: lambda.Code.fromAsset('lambda/websocket'),
      layers: [sharedLayer],
      environment: {
        ...commonEnvironment,
        WEBSOCKET_API_ID: this.websocketApi.apiId,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions for message handling
    sessionTable.grantReadWriteData(messageFunction);
    configTable.grantReadData(messageFunction);
    messageFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/*`
      ],
    }));

    // WebSocket routes using WebSocketLambdaIntegration
    const connectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration(
      'ConnectIntegration',
      connectionFunction
    );

    const disconnectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration(
      'DisconnectIntegration', 
      connectionFunction
    );

    const messageIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration(
      'MessageIntegration',
      messageFunction
    );

    this.websocketApi.addRoute('$connect', { integration: connectIntegration });
    this.websocketApi.addRoute('$disconnect', { integration: disconnectIntegration });
    this.websocketApi.addRoute('$default', { integration: messageIntegration });
    this.websocketApi.addRoute('message', { integration: messageIntegration });

    // WebSocket deployment
    const websocketStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.websocketApi,
      stageName: stage,
      autoDeploy: true,
    });

    // Session cleanup function (runs periodically to clean expired sessions)
    const cleanupFunction = new lambda.Function(this, 'CleanupFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cleanup.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
        
        const dynamodbClient = new DynamoDBClient({});
        const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
        
        exports.handler = async (event) => {
          const tableName = process.env.SESSION_TABLE_NAME;
          const now = Math.floor(Date.now() / 1000);
          
          try {
            // Scan for expired sessions
            const result = await dynamodb.send(new ScanCommand({
              TableName: tableName,
              FilterExpression: 'attribute_exists(#ttl) AND #ttl < :now',
              ExpressionAttributeNames: { '#ttl': 'ttl' },
              ExpressionAttributeValues: { ':now': now },
            }));
            
            // Delete expired sessions
            for (const item of result.Items || []) {
              await dynamodb.send(new DeleteCommand({
                TableName: tableName,
                Key: { sessionId: item.sessionId },
              }));
            }
            
            console.log(\`Cleaned up \${result.Items?.length || 0} expired sessions\`);
            return { statusCode: 200, cleanedCount: result.Items?.length || 0 };
          } catch (error) {
            console.error('Cleanup failed:', error);
            throw error;
          }
        };
      `),
      environment: commonEnvironment,
      timeout: cdk.Duration.minutes(5),
    });

    sessionTable.grantReadWriteData(cleanupFunction);

    // Schedule cleanup function to run every hour
    const cleanupRule = new events.Rule(this, 'CleanupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Cleanup expired WebSocket sessions',
    });

    cleanupRule.addTarget(new targets.LambdaFunction(cleanupFunction));

    // Set API URLs
    this.apiUrl = this.restApi.url;
    this.websocketUrl = `wss://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`;

    // Outputs
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.apiUrl,
      description: 'REST API URL',
      exportName: `VjRestApiUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: this.websocketUrl,
      description: 'WebSocket API URL',
      exportName: `VjWebSocketUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.restApi.restApiId,
      description: 'REST API ID',
      exportName: `VjRestApiId-${stage}`,
    });

    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.websocketApi.apiId,
      description: 'WebSocket API ID',
      exportName: `VjWebSocketApiId-${stage}`,
    });
  }
}