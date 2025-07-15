"use strict";
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
exports.VjApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayv2Integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
class VjApiStack extends cdk.Stack {
    restApi;
    websocketApi;
    apiUrl;
    websocketUrl;
    presetFunction;
    connectionFunction;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, config, sessionTable, presetTable, configTable, userPool, authorizer } = props;
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
            USER_POOL_ID: userPool?.userPoolId || '',
            ENABLE_AUTH: config.enableAuth ? 'true' : 'false',
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
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-User-Id'],
                allowCredentials: true,
            },
            deployOptions: {
                stageName: stage,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: stage !== 'prod',
                metricsEnabled: true,
            },
        });
        // Preset management Lambda function
        this.presetFunction = new lambda.Function(this, 'PresetFunction', {
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
        presetTable.grantReadWriteData(this.presetFunction);
        configTable.grantReadData(this.presetFunction);
        // Preset API endpoints
        const presetResource = this.restApi.root.addResource('presets');
        // Public endpoints (no auth required)
        presetResource.addMethod('GET', new apigateway.LambdaIntegration(this.presetFunction));
        // Protected endpoints (auth required)
        const methodOptions = config.enableAuth && authorizer ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        } : undefined;
        presetResource.addMethod('POST', new apigateway.LambdaIntegration(this.presetFunction), methodOptions);
        const presetItemResource = presetResource.addResource('{presetId}');
        presetItemResource.addMethod('GET', new apigateway.LambdaIntegration(this.presetFunction));
        presetItemResource.addMethod('PUT', new apigateway.LambdaIntegration(this.presetFunction), methodOptions);
        presetItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.presetFunction), methodOptions);
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
        this.connectionFunction = new lambda.Function(this, 'ConnectionFunction', {
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
        sessionTable.grantReadWriteData(this.connectionFunction);
        configTable.grantReadData(this.connectionFunction);
        // Grant API Gateway management permissions
        this.connectionFunction.addToRolePolicy(new iam.PolicyStatement({
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
        const connectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration('ConnectIntegration', this.connectionFunction);
        const disconnectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration('DisconnectIntegration', this.connectionFunction);
        const messageIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration('MessageIntegration', messageFunction);
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
exports.VjApiStack = VjApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwyRUFBNkQ7QUFDN0Qsb0dBQXNGO0FBQ3RGLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFtQjFELE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZCLE9BQU8sQ0FBcUI7SUFDNUIsWUFBWSxDQUE0QjtJQUN4QyxNQUFNLENBQVM7SUFDZixZQUFZLENBQVM7SUFDckIsY0FBYyxDQUFrQjtJQUNoQyxrQkFBa0IsQ0FBa0I7SUFFcEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTlGLHVDQUF1QztRQUN2QyxNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMvRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsc0JBQXNCLENBQUM7WUFDbkQsa0JBQWtCLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztZQUNoRCxXQUFXLEVBQUUseURBQXlEO1NBQ3ZFLENBQUMsQ0FBQztRQUVILCtDQUErQztRQUMvQyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLGtCQUFrQixFQUFFLFlBQVksQ0FBQyxTQUFTO1lBQzFDLGlCQUFpQixFQUFFLFdBQVcsQ0FB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QUFFLGtCQUFrQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDL0IsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUztZQUM3QixXQUFXLEVBQUUsYUFBYTtZQUMxQixVQUFVLEVBQUUsZUFBZSxLQUFLLEVBQUU7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLO1lBQzlCLFdBQVcsRUFBRSxrQkFBa0I7WUFDL0IsVUFBVSxFQUFFLG9CQUFvQixLQUFLLEVBQUU7U0FDeEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBM1JELGdDQTJSQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MkludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqQXBpU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgY29uZmlnOiB7XG4gICAgZG9tYWluTmFtZTogc3RyaW5nO1xuICAgIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gICAgZW5hYmxlQ2xvdWRGcm9udDogYm9vbGVhbjtcbiAgICBlbmFibGVCYWNrdXA6IGJvb2xlYW47XG4gIH07XG4gIHNlc3Npb25UYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHByZXNldFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICB1c2VyUG9vbD86IGNvZ25pdG8uVXNlclBvb2w7XG4gIGF1dGhvcml6ZXI/OiBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyO1xufVxuXG5leHBvcnQgY2xhc3MgVmpBcGlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSByZXN0QXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRBcGk6IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGk7XG4gIHB1YmxpYyByZWFkb25seSBhcGlVcmw6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldFVybDogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgcHJlc2V0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGNvbm5lY3Rpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWakFwaVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZywgc2Vzc2lvblRhYmxlLCBwcmVzZXRUYWJsZSwgY29uZmlnVGFibGUsIHVzZXJQb29sLCBhdXRob3JpemVyIH0gPSBwcm9wcztcblxuICAgIC8vIExhbWJkYSBsYXllciBmb3Igc2hhcmVkIGRlcGVuZGVuY2llc1xuICAgIGNvbnN0IHNoYXJlZExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ1NoYXJlZExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEtbGF5ZXJzL3NoYXJlZCcpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdTaGFyZWQgZGVwZW5kZW5jaWVzIGZvciBWSiBhcHBsaWNhdGlvbiBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIENvbW1vbiBMYW1iZGEgZnVuY3Rpb24gZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgY29uc3QgY29tbW9uRW52aXJvbm1lbnQgPSB7XG4gICAgICBTRVNTSU9OX1RBQkxFX05BTUU6IHNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICBQUkVTRVRfVEFCTEVfTkFNRTogcHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgQ09ORklHX1RBQkxFX05BTUU6IGNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFNUQUdFOiBzdGFnZSxcbiAgICAgIENPUlNfT1JJR0lOOiBzdGFnZSA9PT0gJ3Byb2QnID8gYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gIDogJyonLFxuICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbD8udXNlclBvb2xJZCB8fCAnJyxcbiAgICAgIEVOQUJMRV9BVVRIOiBjb25maWcuZW5hYmxlQXV0aCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfTtcblxuICAgIC8vIFJFU1QgQVBJIGZvciBwcmVzZXQgbWFuYWdlbWVudCBhbmQgY29uZmlndXJhdGlvblxuICAgIHRoaXMucmVzdEFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1Jlc3RBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogYFZKIEFwcGxpY2F0aW9uIFJFU1QgQVBJIC0gJHtzdGFnZX1gLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IFtgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWBdXG4gICAgICAgICAgOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknLCAnWC1BbXotU2VjdXJpdHktVG9rZW4nLCAnWC1Vc2VyLUlkJ10sXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IHN0YWdlLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFByZXNldCBtYW5hZ2VtZW50IExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMucHJlc2V0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcmVzZXRGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3ByZXNldC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3ByZXNldCcpLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIHByZXNldFRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLnByZXNldEZ1bmN0aW9uKTtcbiAgICBjb25maWdUYWJsZS5ncmFudFJlYWREYXRhKHRoaXMucHJlc2V0RnVuY3Rpb24pO1xuXG4gICAgLy8gUHJlc2V0IEFQSSBlbmRwb2ludHNcbiAgICBjb25zdCBwcmVzZXRSZXNvdXJjZSA9IHRoaXMucmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdwcmVzZXRzJyk7XG4gICAgXG4gICAgLy8gUHVibGljIGVuZHBvaW50cyAobm8gYXV0aCByZXF1aXJlZClcbiAgICBwcmVzZXRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucHJlc2V0RnVuY3Rpb24pKTtcbiAgICBcbiAgICAvLyBQcm90ZWN0ZWQgZW5kcG9pbnRzIChhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IG1ldGhvZE9wdGlvbnMgPSBjb25maWcuZW5hYmxlQXV0aCAmJiBhdXRob3JpemVyID8ge1xuICAgICAgYXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgfSA6IHVuZGVmaW5lZDtcbiAgICBcbiAgICBwcmVzZXRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSwgbWV0aG9kT3B0aW9ucyk7XG5cbiAgICBjb25zdCBwcmVzZXRJdGVtUmVzb3VyY2UgPSBwcmVzZXRSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3ByZXNldElkfScpO1xuICAgIHByZXNldEl0ZW1SZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucHJlc2V0RnVuY3Rpb24pKTtcbiAgICBwcmVzZXRJdGVtUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSwgbWV0aG9kT3B0aW9ucyk7XG4gICAgcHJlc2V0SXRlbVJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbiksIG1ldGhvZE9wdGlvbnMpO1xuXG4gICAgLy8gSGVhbHRoIGNoZWNrIGVuZHBvaW50XG4gICAgY29uc3QgaGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdIZWFsdGhGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBzdGF0dXM6ICdoZWFsdGh5JyxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgIHN0YWdlOiBwcm9jZXNzLmVudi5TVEFHRSxcbiAgICAgICAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFNUQUdFOiBzdGFnZSB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihoZWFsdGhGdW5jdGlvbikpO1xuXG4gICAgLy8gV2ViU29ja2V0IEFQSSBmb3IgcmVhbC10aW1lIGNvbW11bmljYXRpb25cbiAgICB0aGlzLndlYnNvY2tldEFwaSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0QXBpKHRoaXMsICdXZWJTb2NrZXRBcGknLCB7XG4gICAgICBhcGlOYW1lOiBgdmotd2Vic29ja2V0LSR7c3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gV2ViU29ja2V0IEFQSSAtICR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBjb25uZWN0aW9uIGhhbmRsZXJcbiAgICB0aGlzLmNvbm5lY3Rpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Nvbm5lY3Rpb25GdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2Nvbm5lY3Rpb24uaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93ZWJzb2NrZXQnKSxcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgICBXRUJTT0NLRVRfQVBJX0lEOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIGZvciBjb25uZWN0aW9uIG1hbmFnZW1lbnRcbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uKTtcbiAgICBjb25maWdUYWJsZS5ncmFudFJlYWREYXRhKHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uKTtcblxuICAgIC8vIEdyYW50IEFQSSBHYXRld2F5IG1hbmFnZW1lbnQgcGVybWlzc2lvbnNcbiAgICB0aGlzLmNvbm5lY3Rpb25GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToke3RoaXMud2Vic29ja2V0QXBpLmFwaUlkfS8qYFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgbWVzc2FnZSBoYW5kbGVyXG4gICAgY29uc3QgbWVzc2FnZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWVzc2FnZUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnbWVzc2FnZS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3dlYnNvY2tldCcpLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICAgIFdFQlNPQ0tFVF9BUElfSUQ6IHRoaXMud2Vic29ja2V0QXBpLmFwaUlkLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIG1lc3NhZ2UgaGFuZGxpbmdcbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG1lc3NhZ2VGdW5jdGlvbik7XG4gICAgY29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuICAgIG1lc3NhZ2VGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToke3RoaXMud2Vic29ja2V0QXBpLmFwaUlkfS8qYFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgcm91dGVzIHVzaW5nIFdlYlNvY2tldExhbWJkYUludGVncmF0aW9uXG4gICAgY29uc3QgY29ubmVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICdDb25uZWN0SW50ZWdyYXRpb24nLFxuICAgICAgdGhpcy5jb25uZWN0aW9uRnVuY3Rpb25cbiAgICApO1xuXG4gICAgY29uc3QgZGlzY29ubmVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICdEaXNjb25uZWN0SW50ZWdyYXRpb24nLCBcbiAgICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uXG4gICAgKTtcblxuICAgIGNvbnN0IG1lc3NhZ2VJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnTWVzc2FnZUludGVncmF0aW9uJyxcbiAgICAgIG1lc3NhZ2VGdW5jdGlvblxuICAgICk7XG5cbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnJGNvbm5lY3QnLCB7IGludGVncmF0aW9uOiBjb25uZWN0SW50ZWdyYXRpb24gfSk7XG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJyRkaXNjb25uZWN0JywgeyBpbnRlZ3JhdGlvbjogZGlzY29ubmVjdEludGVncmF0aW9uIH0pO1xuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCckZGVmYXVsdCcsIHsgaW50ZWdyYXRpb246IG1lc3NhZ2VJbnRlZ3JhdGlvbiB9KTtcbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnbWVzc2FnZScsIHsgaW50ZWdyYXRpb246IG1lc3NhZ2VJbnRlZ3JhdGlvbiB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBkZXBsb3ltZW50XG4gICAgY29uc3Qgd2Vic29ja2V0U3RhZ2UgPSBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldFN0YWdlKHRoaXMsICdXZWJTb2NrZXRTdGFnZScsIHtcbiAgICAgIHdlYlNvY2tldEFwaTogdGhpcy53ZWJzb2NrZXRBcGksXG4gICAgICBzdGFnZU5hbWU6IHN0YWdlLFxuICAgICAgYXV0b0RlcGxveTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFNlc3Npb24gY2xlYW51cCBmdW5jdGlvbiAocnVucyBwZXJpb2RpY2FsbHkgdG8gY2xlYW4gZXhwaXJlZCBzZXNzaW9ucylcbiAgICBjb25zdCBjbGVhbnVwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDbGVhbnVwRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjbGVhbnVwLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJDbGllbnQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYicpO1xuICAgICAgICBjb25zdCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFNjYW5Db21tYW5kLCBEZWxldGVDb21tYW5kIH0gPSByZXF1aXJlKCdAYXdzLXNkay9saWItZHluYW1vZGInKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGR5bmFtb2RiQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oZHluYW1vZGJDbGllbnQpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGFibGVOYW1lID0gcHJvY2Vzcy5lbnYuU0VTU0lPTl9UQUJMRV9OQU1FO1xuICAgICAgICAgIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBTY2FuIGZvciBleHBpcmVkIHNlc3Npb25zXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5zZW5kKG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICBGaWx0ZXJFeHByZXNzaW9uOiAnYXR0cmlidXRlX2V4aXN0cygjdHRsKSBBTkQgI3R0bCA8IDpub3cnLFxuICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHsgJyN0dGwnOiAndHRsJyB9LFxuICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7ICc6bm93Jzogbm93IH0sXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIERlbGV0ZSBleHBpcmVkIHNlc3Npb25zXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVzdWx0Lkl0ZW1zIHx8IFtdKSB7XG4gICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnNlbmQobmV3IERlbGV0ZUNvbW1hbmQoe1xuICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICAgIEtleTogeyBzZXNzaW9uSWQ6IGl0ZW0uc2Vzc2lvbklkIH0sXG4gICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXFxgQ2xlYW5lZCB1cCBcXCR7cmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMH0gZXhwaXJlZCBzZXNzaW9uc1xcYCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAsIGNsZWFuZWRDb3VudDogcmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMCB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDbGVhbnVwIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjbGVhbnVwRnVuY3Rpb24pO1xuXG4gICAgLy8gU2NoZWR1bGUgY2xlYW51cCBmdW5jdGlvbiB0byBydW4gZXZlcnkgaG91clxuICAgIGNvbnN0IGNsZWFudXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdDbGVhbnVwU2NoZWR1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xlYW51cCBleHBpcmVkIFdlYlNvY2tldCBzZXNzaW9ucycsXG4gICAgfSk7XG5cbiAgICBjbGVhbnVwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oY2xlYW51cEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBTZXQgQVBJIFVSTHNcbiAgICB0aGlzLmFwaVVybCA9IHRoaXMucmVzdEFwaS51cmw7XG4gICAgdGhpcy53ZWJzb2NrZXRVcmwgPSBgd3NzOi8vJHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0uZXhlY3V0ZS1hcGkuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke3N0YWdlfWA7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3RBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JFU1QgQVBJIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpSZXN0QXBpVXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJzb2NrZXRVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWaldlYlNvY2tldFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXN0QXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqUmVzdEFwaUlkLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpXZWJTb2NrZXRBcGlJZC0ke3N0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=