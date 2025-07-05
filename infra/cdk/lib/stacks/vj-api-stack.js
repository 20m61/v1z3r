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
            handler: 'health.handler',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwyRUFBNkQ7QUFDN0Qsb0dBQXNGO0FBQ3RGLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFnQjFELE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZCLE9BQU8sQ0FBcUI7SUFDNUIsWUFBWSxDQUE0QjtJQUN4QyxNQUFNLENBQVM7SUFDZixZQUFZLENBQVM7SUFFckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV4RSx1Q0FBdUM7UUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDL0QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDO1lBQ25ELGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLHlEQUF5RDtTQUN2RSxDQUFDLENBQUM7UUFFSCwrQ0FBK0M7UUFDL0MsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixrQkFBa0IsRUFBRSxZQUFZLENBQUMsU0FBUztZQUMxQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxLQUFLLEVBQUUs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QUMsWUFBWSxHQUFHLFNBQVMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLGdCQUFnQixJQUFJLENBQUMsTUFBTSxrQkFBa0IsS0FBSyxFQUFFLENBQUM7UUFFekcsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNsQixXQUFXLEVBQUUsY0FBYztZQUMzQixVQUFVLEVBQUUsZ0JBQWdCLEtBQUssRUFBRTtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVk7WUFDeEIsV0FBVyxFQUFFLG1CQUFtQjtZQUNoQyxVQUFVLEVBQUUsa0JBQWtCLEtBQUssRUFBRTtTQUN0QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtZQUMvQixLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTO1lBQzdCLFdBQVcsRUFBRSxhQUFhO1lBQzFCLFVBQVUsRUFBRSxlQUFlLEtBQUssRUFBRTtTQUNuQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUs7WUFDOUIsV0FBVyxFQUFFLGtCQUFrQjtZQUMvQixVQUFVLEVBQUUsb0JBQW9CLEtBQUssRUFBRTtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUExUUQsZ0NBMFFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqQXBpU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgY29uZmlnOiB7XG4gICAgZG9tYWluTmFtZTogc3RyaW5nO1xuICAgIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gICAgZW5hYmxlQ2xvdWRGcm9udDogYm9vbGVhbjtcbiAgICBlbmFibGVCYWNrdXA6IGJvb2xlYW47XG4gIH07XG4gIHNlc3Npb25UYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHByZXNldFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgVmpBcGlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSByZXN0QXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRBcGk6IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGk7XG4gIHB1YmxpYyByZWFkb25seSBhcGlVcmw6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldFVybDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWakFwaVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZywgc2Vzc2lvblRhYmxlLCBwcmVzZXRUYWJsZSwgY29uZmlnVGFibGUgfSA9IHByb3BzO1xuXG4gICAgLy8gTGFtYmRhIGxheWVyIGZvciBzaGFyZWQgZGVwZW5kZW5jaWVzXG4gICAgY29uc3Qgc2hhcmVkTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnU2hhcmVkTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS1sYXllcnMvc2hhcmVkJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWF0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NoYXJlZCBkZXBlbmRlbmNpZXMgZm9yIFZKIGFwcGxpY2F0aW9uIExhbWJkYSBmdW5jdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBmdW5jdGlvbiBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBjb25zdCBjb21tb25FbnZpcm9ubWVudCA9IHtcbiAgICAgIFNFU1NJT05fVEFCTEVfTkFNRTogc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFBSRVNFVF9UQUJMRV9OQU1FOiBwcmVzZXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICBDT05GSUdfVEFCTEVfTkFNRTogY29uZmlnVGFibGUudGFibGVOYW1lLFxuICAgICAgU1RBR0U6IHN0YWdlLFxuICAgICAgQ09SU19PUklHSU46IHN0YWdlID09PSAncHJvZCcgPyBgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWAgOiAnKicsXG4gICAgfTtcblxuICAgIC8vIFJFU1QgQVBJIGZvciBwcmVzZXQgbWFuYWdlbWVudCBhbmQgY29uZmlndXJhdGlvblxuICAgIHRoaXMucmVzdEFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1Jlc3RBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogYFZKIEFwcGxpY2F0aW9uIFJFU1QgQVBJIC0gJHtzdGFnZX1gLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IFtgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWBdXG4gICAgICAgICAgOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknLCAnWC1BbXotU2VjdXJpdHktVG9rZW4nXSxcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgICAgbWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUHJlc2V0IG1hbmFnZW1lbnQgTGFtYmRhIGZ1bmN0aW9uXG4gICAgY29uc3QgcHJlc2V0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcmVzZXRGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3ByZXNldC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3ByZXNldCcpLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIHByZXNldFRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwcmVzZXRGdW5jdGlvbik7XG4gICAgY29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YShwcmVzZXRGdW5jdGlvbik7XG5cbiAgICAvLyBQcmVzZXQgQVBJIGVuZHBvaW50c1xuICAgIGNvbnN0IHByZXNldFJlc291cmNlID0gdGhpcy5yZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3ByZXNldHMnKTtcbiAgICBwcmVzZXRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByZXNldEZ1bmN0aW9uKSk7XG4gICAgcHJlc2V0UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJlc2V0RnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHByZXNldEl0ZW1SZXNvdXJjZSA9IHByZXNldFJlc291cmNlLmFkZFJlc291cmNlKCd7cHJlc2V0SWR9Jyk7XG4gICAgcHJlc2V0SXRlbVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJlc2V0RnVuY3Rpb24pKTtcbiAgICBwcmVzZXRJdGVtUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldEl0ZW1SZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByZXNldEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBIZWFsdGggY2hlY2sgZW5kcG9pbnRcbiAgICBjb25zdCBoZWFsdGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0hlYWx0aEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaGVhbHRoLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBzdGF0dXM6ICdoZWFsdGh5JyxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgIHN0YWdlOiBwcm9jZXNzLmVudi5TVEFHRSxcbiAgICAgICAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFNUQUdFOiBzdGFnZSB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihoZWFsdGhGdW5jdGlvbikpO1xuXG4gICAgLy8gV2ViU29ja2V0IEFQSSBmb3IgcmVhbC10aW1lIGNvbW11bmljYXRpb25cbiAgICB0aGlzLndlYnNvY2tldEFwaSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0QXBpKHRoaXMsICdXZWJTb2NrZXRBcGknLCB7XG4gICAgICBhcGlOYW1lOiBgdmotd2Vic29ja2V0LSR7c3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gV2ViU29ja2V0IEFQSSAtICR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBjb25uZWN0aW9uIGhhbmRsZXJcbiAgICBjb25zdCBjb25uZWN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDb25uZWN0aW9uRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjb25uZWN0aW9uLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvd2Vic29ja2V0JyksXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcbiAgICAgICAgV0VCU09DS0VUX0FQSV9JRDogdGhpcy53ZWJzb2NrZXRBcGkuYXBpSWQsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9ucyBmb3IgY29ubmVjdGlvbiBtYW5hZ2VtZW50XG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb25uZWN0aW9uRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZERhdGEoY29ubmVjdGlvbkZ1bmN0aW9uKTtcblxuICAgIC8vIEdyYW50IEFQSSBHYXRld2F5IG1hbmFnZW1lbnQgcGVybWlzc2lvbnNcbiAgICBjb25uZWN0aW9uRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0vKmBcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gV2ViU29ja2V0IG1lc3NhZ2UgaGFuZGxlclxuICAgIGNvbnN0IG1lc3NhZ2VGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01lc3NhZ2VGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ21lc3NhZ2UuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93ZWJzb2NrZXQnKSxcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgICBXRUJTT0NLRVRfQVBJX0lEOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciBtZXNzYWdlIGhhbmRsaW5nXG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZERhdGEobWVzc2FnZUZ1bmN0aW9uKTtcbiAgICBtZXNzYWdlRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0vKmBcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gV2ViU29ja2V0IHJvdXRlcyB1c2luZyBXZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGNvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnQ29ubmVjdEludGVncmF0aW9uJyxcbiAgICAgIGNvbm5lY3Rpb25GdW5jdGlvblxuICAgICk7XG5cbiAgICBjb25zdCBkaXNjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxuICAgICAgJ0Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbicsIFxuICAgICAgY29ubmVjdGlvbkZ1bmN0aW9uXG4gICAgKTtcblxuICAgIGNvbnN0IG1lc3NhZ2VJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnTWVzc2FnZUludGVncmF0aW9uJyxcbiAgICAgIG1lc3NhZ2VGdW5jdGlvblxuICAgICk7XG5cbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnJGNvbm5lY3QnLCB7IGludGVncmF0aW9uOiBjb25uZWN0SW50ZWdyYXRpb24gfSk7XG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJyRkaXNjb25uZWN0JywgeyBpbnRlZ3JhdGlvbjogZGlzY29ubmVjdEludGVncmF0aW9uIH0pO1xuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCckZGVmYXVsdCcsIHsgaW50ZWdyYXRpb246IG1lc3NhZ2VJbnRlZ3JhdGlvbiB9KTtcbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnbWVzc2FnZScsIHsgaW50ZWdyYXRpb246IG1lc3NhZ2VJbnRlZ3JhdGlvbiB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBkZXBsb3ltZW50XG4gICAgY29uc3Qgd2Vic29ja2V0U3RhZ2UgPSBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldFN0YWdlKHRoaXMsICdXZWJTb2NrZXRTdGFnZScsIHtcbiAgICAgIHdlYlNvY2tldEFwaTogdGhpcy53ZWJzb2NrZXRBcGksXG4gICAgICBzdGFnZU5hbWU6IHN0YWdlLFxuICAgICAgYXV0b0RlcGxveTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFNlc3Npb24gY2xlYW51cCBmdW5jdGlvbiAocnVucyBwZXJpb2RpY2FsbHkgdG8gY2xlYW4gZXhwaXJlZCBzZXNzaW9ucylcbiAgICBjb25zdCBjbGVhbnVwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDbGVhbnVwRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjbGVhbnVwLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCB0YWJsZU5hbWUgPSBwcm9jZXNzLmVudi5TRVNTSU9OX1RBQkxFX05BTUU7XG4gICAgICAgICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFNjYW4gZm9yIGV4cGlyZWQgc2Vzc2lvbnNcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnNjYW4oe1xuICAgICAgICAgICAgICBUYWJsZU5hbWU6IHRhYmxlTmFtZSxcbiAgICAgICAgICAgICAgRmlsdGVyRXhwcmVzc2lvbjogJ2F0dHJpYnV0ZV9leGlzdHMoI3R0bCkgQU5EICN0dGwgPCA6bm93JyxcbiAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7ICcjdHRsJzogJ3R0bCcgfSxcbiAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczogeyAnOm5vdyc6IG5vdyB9LFxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBEZWxldGUgZXhwaXJlZCBzZXNzaW9uc1xuICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJlc3VsdC5JdGVtcyB8fCBbXSkge1xuICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5kZWxldGUoe1xuICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICAgIEtleTogeyBzZXNzaW9uSWQ6IGl0ZW0uc2Vzc2lvbklkIH0sXG4gICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXFxgQ2xlYW5lZCB1cCBcXCR7cmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMH0gZXhwaXJlZCBzZXNzaW9uc1xcYCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAsIGNsZWFuZWRDb3VudDogcmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMCB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDbGVhbnVwIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjbGVhbnVwRnVuY3Rpb24pO1xuXG4gICAgLy8gU2NoZWR1bGUgY2xlYW51cCBmdW5jdGlvbiB0byBydW4gZXZlcnkgaG91clxuICAgIGNvbnN0IGNsZWFudXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdDbGVhbnVwU2NoZWR1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xlYW51cCBleHBpcmVkIFdlYlNvY2tldCBzZXNzaW9ucycsXG4gICAgfSk7XG5cbiAgICBjbGVhbnVwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oY2xlYW51cEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBTZXQgQVBJIFVSTHNcbiAgICB0aGlzLmFwaVVybCA9IHRoaXMucmVzdEFwaS51cmw7XG4gICAgdGhpcy53ZWJzb2NrZXRVcmwgPSBgd3NzOi8vJHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0uZXhlY3V0ZS1hcGkuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke3N0YWdlfWA7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3RBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JFU1QgQVBJIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpSZXN0QXBpVXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJzb2NrZXRVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWaldlYlNvY2tldFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXN0QXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqUmVzdEFwaUlkLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpXZWJTb2NrZXRBcGlJZC0ke3N0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=