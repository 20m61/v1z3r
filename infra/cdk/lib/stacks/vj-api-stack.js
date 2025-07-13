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
    constructor(scope, id, props) {
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
        const connectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration('ConnectIntegration', connectionFunction);
        const disconnectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration('DisconnectIntegration', connectionFunction);
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
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
          const tableName = process.env.SESSION_TABLE_NAME;
          const now = Math.floor(Date.now() / 1000);
          
          try {
            // Scan for expired sessions
            const result = await dynamodb.scan({
              TableName: tableName,
              FilterExpression: 'attribute_exists(#ttl) AND #ttl < :now',
              ExpressionAttributeNames: { '#ttl': 'ttl' },
              ExpressionAttributeValues: { ':now': now },
            }).promise();
            
            // Delete expired sessions
            for (const item of result.Items || []) {
              await dynamodb.delete({
                TableName: tableName,
                Key: { sessionId: item.sessionId },
              }).promise();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwyRUFBNkQ7QUFDN0Qsb0dBQXNGO0FBQ3RGLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFnQjFELE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZCLE9BQU8sQ0FBcUI7SUFDNUIsWUFBWSxDQUE0QjtJQUN4QyxNQUFNLENBQVM7SUFDZixZQUFZLENBQVM7SUFFckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV4RSx1Q0FBdUM7UUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDL0QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDO1lBQ25ELGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLHlEQUF5RDtTQUN2RSxDQUFDLENBQUM7UUFFSCwrQ0FBK0M7UUFDL0MsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixrQkFBa0IsRUFBRSxZQUFZLENBQUMsU0FBUztZQUMxQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxLQUFLLEVBQUUs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LFlBQVksR0FBRyxTQUFTLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxnQkFBZ0IsSUFBSSxDQUFDLE1BQU0sa0JBQWtCLEtBQUssRUFBRSxDQUFDO1FBRXpHLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbEIsV0FBVyxFQUFFLGNBQWM7WUFDM0IsVUFBVSxFQUFFLGdCQUFnQixLQUFLLEVBQUU7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZO1lBQ3hCLFdBQVcsRUFBRSxtQkFBbUI7WUFDaEMsVUFBVSxFQUFFLGtCQUFrQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDL0IsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUztZQUM3QixXQUFXLEVBQUUsYUFBYTtZQUMxQixVQUFVLEVBQUUsZUFBZSxLQUFLLEVBQUU7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLO1lBQzlCLFdBQVcsRUFBRSxrQkFBa0I7WUFDL0IsVUFBVSxFQUFFLG9CQUFvQixLQUFLLEVBQUU7U0FDeEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBMVFELGdDQTBRQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MkludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWakFwaVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgICBlbmFibGVBdXRoOiBib29sZWFuO1xuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gICAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xuICB9O1xuICBzZXNzaW9uVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwcmVzZXRUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIGNvbmZpZ1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbn1cblxuZXhwb3J0IGNsYXNzIFZqQXBpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgcmVzdEFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0QXBpOiBhcGlnYXRld2F5djIuV2ViU29ja2V0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpVXJsOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpBcGlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBjb25maWcsIHNlc3Npb25UYWJsZSwgcHJlc2V0VGFibGUsIGNvbmZpZ1RhYmxlIH0gPSBwcm9wcztcblxuICAgIC8vIExhbWJkYSBsYXllciBmb3Igc2hhcmVkIGRlcGVuZGVuY2llc1xuICAgIGNvbnN0IHNoYXJlZExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ1NoYXJlZExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEtbGF5ZXJzL3NoYXJlZCcpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdTaGFyZWQgZGVwZW5kZW5jaWVzIGZvciBWSiBhcHBsaWNhdGlvbiBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIENvbW1vbiBMYW1iZGEgZnVuY3Rpb24gZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgY29uc3QgY29tbW9uRW52aXJvbm1lbnQgPSB7XG4gICAgICBTRVNTSU9OX1RBQkxFX05BTUU6IHNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICBQUkVTRVRfVEFCTEVfTkFNRTogcHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgQ09ORklHX1RBQkxFX05BTUU6IGNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFNUQUdFOiBzdGFnZSxcbiAgICAgIENPUlNfT1JJR0lOOiBzdGFnZSA9PT0gJ3Byb2QnID8gYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gIDogJyonLFxuICAgIH07XG5cbiAgICAvLyBSRVNUIEFQSSBmb3IgcHJlc2V0IG1hbmFnZW1lbnQgYW5kIGNvbmZpZ3VyYXRpb25cbiAgICB0aGlzLnJlc3RBcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdSZXN0QXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGB2ai1hcGktJHtzdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246IGBWSiBBcHBsaWNhdGlvbiBSRVNUIEFQSSAtICR7c3RhZ2V9YCxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IHN0YWdlID09PSAncHJvZCcgXG4gICAgICAgICAgPyBbYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gXVxuICAgICAgICAgIDogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdYLUFtei1EYXRlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5JywgJ1gtQW16LVNlY3VyaXR5LVRva2VuJ10sXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IHN0YWdlLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFByZXNldCBtYW5hZ2VtZW50IExhbWJkYSBmdW5jdGlvblxuICAgIGNvbnN0IHByZXNldEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJlc2V0RnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdwcmVzZXQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9wcmVzZXQnKSxcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnNcbiAgICBwcmVzZXRUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocHJlc2V0RnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZERhdGEocHJlc2V0RnVuY3Rpb24pO1xuXG4gICAgLy8gUHJlc2V0IEFQSSBlbmRwb2ludHNcbiAgICBjb25zdCBwcmVzZXRSZXNvdXJjZSA9IHRoaXMucmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdwcmVzZXRzJyk7XG4gICAgcHJlc2V0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByZXNldEZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBwcmVzZXRJdGVtUmVzb3VyY2UgPSBwcmVzZXRSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3ByZXNldElkfScpO1xuICAgIHByZXNldEl0ZW1SZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByZXNldEZ1bmN0aW9uKSk7XG4gICAgcHJlc2V0SXRlbVJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJlc2V0RnVuY3Rpb24pKTtcbiAgICBwcmVzZXRJdGVtUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcmVzZXRGdW5jdGlvbikpO1xuXG4gICAgLy8gSGVhbHRoIGNoZWNrIGVuZHBvaW50XG4gICAgY29uc3QgaGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdIZWFsdGhGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBzdGF0dXM6ICdoZWFsdGh5JyxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgIHN0YWdlOiBwcm9jZXNzLmVudi5TVEFHRSxcbiAgICAgICAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFNUQUdFOiBzdGFnZSB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihoZWFsdGhGdW5jdGlvbikpO1xuXG4gICAgLy8gV2ViU29ja2V0IEFQSSBmb3IgcmVhbC10aW1lIGNvbW11bmljYXRpb25cbiAgICB0aGlzLndlYnNvY2tldEFwaSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0QXBpKHRoaXMsICdXZWJTb2NrZXRBcGknLCB7XG4gICAgICBhcGlOYW1lOiBgdmotd2Vic29ja2V0LSR7c3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gV2ViU29ja2V0IEFQSSAtICR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBjb25uZWN0aW9uIGhhbmRsZXJcbiAgICBjb25zdCBjb25uZWN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDb25uZWN0aW9uRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjb25uZWN0aW9uLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvd2Vic29ja2V0JyksXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcbiAgICAgICAgV0VCU09DS0VUX0FQSV9JRDogdGhpcy53ZWJzb2NrZXRBcGkuYXBpSWQsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9ucyBmb3IgY29ubmVjdGlvbiBtYW5hZ2VtZW50XG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb25uZWN0aW9uRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZERhdGEoY29ubmVjdGlvbkZ1bmN0aW9uKTtcblxuICAgIC8vIEdyYW50IEFQSSBHYXRld2F5IG1hbmFnZW1lbnQgcGVybWlzc2lvbnNcbiAgICBjb25uZWN0aW9uRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0vKmBcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gV2ViU29ja2V0IG1lc3NhZ2UgaGFuZGxlclxuICAgIGNvbnN0IG1lc3NhZ2VGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01lc3NhZ2VGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ21lc3NhZ2UuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93ZWJzb2NrZXQnKSxcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgICBXRUJTT0NLRVRfQVBJX0lEOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciBtZXNzYWdlIGhhbmRsaW5nXG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZERhdGEobWVzc2FnZUZ1bmN0aW9uKTtcbiAgICBtZXNzYWdlRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0vKmBcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gV2ViU29ja2V0IHJvdXRlcyB1c2luZyBXZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGNvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnQ29ubmVjdEludGVncmF0aW9uJyxcbiAgICAgIGNvbm5lY3Rpb25GdW5jdGlvblxuICAgICk7XG5cbiAgICBjb25zdCBkaXNjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxuICAgICAgJ0Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbicsIFxuICAgICAgY29ubmVjdGlvbkZ1bmN0aW9uXG4gICAgKTtcblxuICAgIGNvbnN0IG1lc3NhZ2VJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnTWVzc2FnZUludGVncmF0aW9uJyxcbiAgICAgIG1lc3NhZ2VGdW5jdGlvblxuICAgICk7XG5cbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnJGNvbm5lY3QnLCB7IGludGVncmF0aW9uOiBjb25uZWN0SW50ZWdyYXRpb24gfSk7XG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJyRkaXNjb25uZWN0JywgeyBpbnRlZ3JhdGlvbjogZGlzY29ubmVjdEludGVncmF0aW9uIH0pO1xuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCckZGVmYXVsdCcsIHsgaW50ZWdyYXRpb246IG1lc3NhZ2VJbnRlZ3JhdGlvbiB9KTtcbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnbWVzc2FnZScsIHsgaW50ZWdyYXRpb246IG1lc3NhZ2VJbnRlZ3JhdGlvbiB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBkZXBsb3ltZW50XG4gICAgY29uc3Qgd2Vic29ja2V0U3RhZ2UgPSBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldFN0YWdlKHRoaXMsICdXZWJTb2NrZXRTdGFnZScsIHtcbiAgICAgIHdlYlNvY2tldEFwaTogdGhpcy53ZWJzb2NrZXRBcGksXG4gICAgICBzdGFnZU5hbWU6IHN0YWdlLFxuICAgICAgYXV0b0RlcGxveTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFNlc3Npb24gY2xlYW51cCBmdW5jdGlvbiAocnVucyBwZXJpb2RpY2FsbHkgdG8gY2xlYW4gZXhwaXJlZCBzZXNzaW9ucylcbiAgICBjb25zdCBjbGVhbnVwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDbGVhbnVwRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjbGVhbnVwLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCB0YWJsZU5hbWUgPSBwcm9jZXNzLmVudi5TRVNTSU9OX1RBQkxFX05BTUU7XG4gICAgICAgICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFNjYW4gZm9yIGV4cGlyZWQgc2Vzc2lvbnNcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnNjYW4oe1xuICAgICAgICAgICAgICBUYWJsZU5hbWU6IHRhYmxlTmFtZSxcbiAgICAgICAgICAgICAgRmlsdGVyRXhwcmVzc2lvbjogJ2F0dHJpYnV0ZV9leGlzdHMoI3R0bCkgQU5EICN0dGwgPCA6bm93JyxcbiAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7ICcjdHRsJzogJ3R0bCcgfSxcbiAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczogeyAnOm5vdyc6IG5vdyB9LFxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBEZWxldGUgZXhwaXJlZCBzZXNzaW9uc1xuICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJlc3VsdC5JdGVtcyB8fCBbXSkge1xuICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5kZWxldGUoe1xuICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICAgIEtleTogeyBzZXNzaW9uSWQ6IGl0ZW0uc2Vzc2lvbklkIH0sXG4gICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXFxgQ2xlYW5lZCB1cCBcXCR7cmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMH0gZXhwaXJlZCBzZXNzaW9uc1xcYCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAsIGNsZWFuZWRDb3VudDogcmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMCB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDbGVhbnVwIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjbGVhbnVwRnVuY3Rpb24pO1xuXG4gICAgLy8gU2NoZWR1bGUgY2xlYW51cCBmdW5jdGlvbiB0byBydW4gZXZlcnkgaG91clxuICAgIGNvbnN0IGNsZWFudXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdDbGVhbnVwU2NoZWR1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xlYW51cCBleHBpcmVkIFdlYlNvY2tldCBzZXNzaW9ucycsXG4gICAgfSk7XG5cbiAgICBjbGVhbnVwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oY2xlYW51cEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBTZXQgQVBJIFVSTHNcbiAgICB0aGlzLmFwaVVybCA9IHRoaXMucmVzdEFwaS51cmw7XG4gICAgdGhpcy53ZWJzb2NrZXRVcmwgPSBgd3NzOi8vJHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0uZXhlY3V0ZS1hcGkuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke3N0YWdlfWA7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3RBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JFU1QgQVBJIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpSZXN0QXBpVXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJzb2NrZXRVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWaldlYlNvY2tldFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXN0QXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqUmVzdEFwaUlkLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpXZWJTb2NrZXRBcGlJZC0ke3N0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=