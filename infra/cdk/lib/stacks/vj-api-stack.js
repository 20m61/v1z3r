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
        presetResource.addMethod('GET', new apigateway.LambdaIntegration(this.presetFunction));
        presetResource.addMethod('POST', new apigateway.LambdaIntegration(this.presetFunction));
        const presetItemResource = presetResource.addResource('{presetId}');
        presetItemResource.addMethod('GET', new apigateway.LambdaIntegration(this.presetFunction));
        presetItemResource.addMethod('PUT', new apigateway.LambdaIntegration(this.presetFunction));
        presetItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.presetFunction));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwyRUFBNkQ7QUFDN0Qsb0dBQXNGO0FBQ3RGLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFnQjFELE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZCLE9BQU8sQ0FBcUI7SUFDNUIsWUFBWSxDQUE0QjtJQUN4QyxNQUFNLENBQVM7SUFDZixZQUFZLENBQVM7SUFDckIsY0FBYyxDQUFrQjtJQUNoQyxrQkFBa0IsQ0FBa0I7SUFFcEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV4RSx1Q0FBdUM7UUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDL0QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDO1lBQ25ELGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLHlEQUF5RDtTQUN2RSxDQUFDLENBQUM7UUFFSCwrQ0FBK0M7UUFDL0MsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixrQkFBa0IsRUFBRSxZQUFZLENBQUMsU0FBUztZQUMxQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxpQkFBaUIs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QUM7Q0FDRjtBQS9RRCxnQ0ErUUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mi1pbnRlZ3JhdGlvbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpBcGlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgc2Vzc2lvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHJlc2V0VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBjb25maWdUYWJsZTogZHluYW1vZGIuVGFibGU7XG59XG5cbmV4cG9ydCBjbGFzcyBWakFwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlc3RBcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldEFwaTogYXBpZ2F0ZXdheXYyLldlYlNvY2tldEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGFwaVVybDogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0VXJsOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBwcmVzZXRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgY29ubmVjdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqQXBpU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnLCBzZXNzaW9uVGFibGUsIHByZXNldFRhYmxlLCBjb25maWdUYWJsZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBMYW1iZGEgbGF5ZXIgZm9yIHNoYXJlZCBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBzaGFyZWRMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTaGFyZWRMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhLWxheWVycy9zaGFyZWQnKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2hhcmVkIGRlcGVuZGVuY2llcyBmb3IgVkogYXBwbGljYXRpb24gTGFtYmRhIGZ1bmN0aW9ucycsXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGZ1bmN0aW9uIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgIGNvbnN0IGNvbW1vbkVudmlyb25tZW50ID0ge1xuICAgICAgU0VTU0lPTl9UQUJMRV9OQU1FOiBzZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgUFJFU0VUX1RBQkxFX05BTUU6IHByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIENPTkZJR19UQUJMRV9OQU1FOiBjb25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICBTVEFHRTogc3RhZ2UsXG4gICAgICBDT1JTX09SSUdJTjogc3RhZ2UgPT09ICdwcm9kJyA/IGBodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YCA6ICcqJyxcbiAgICB9O1xuXG4gICAgLy8gUkVTVCBBUEkgZm9yIHByZXNldCBtYW5hZ2VtZW50IGFuZCBjb25maWd1cmF0aW9uXG4gICAgdGhpcy5yZXN0QXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUmVzdEFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gUkVTVCBBUEkgLSAke3N0YWdlfWAsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBzdGFnZSA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gW2BodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YF1cbiAgICAgICAgICA6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleScsICdYLUFtei1TZWN1cml0eS1Ub2tlbiddLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBzdGFnZSxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBQcmVzZXQgbWFuYWdlbWVudCBMYW1iZGEgZnVuY3Rpb25cbiAgICB0aGlzLnByZXNldEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJlc2V0RnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdwcmVzZXQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9wcmVzZXQnKSxcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnNcbiAgICBwcmVzZXRUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5wcmVzZXRGdW5jdGlvbik7XG4gICAgY29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzLnByZXNldEZ1bmN0aW9uKTtcblxuICAgIC8vIFByZXNldCBBUEkgZW5kcG9pbnRzXG4gICAgY29uc3QgcHJlc2V0UmVzb3VyY2UgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgncHJlc2V0cycpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucHJlc2V0RnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHByZXNldEl0ZW1SZXNvdXJjZSA9IHByZXNldFJlc291cmNlLmFkZFJlc291cmNlKCd7cHJlc2V0SWR9Jyk7XG4gICAgcHJlc2V0SXRlbVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldEl0ZW1SZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucHJlc2V0RnVuY3Rpb24pKTtcbiAgICBwcmVzZXRJdGVtUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBIZWFsdGggY2hlY2sgZW5kcG9pbnRcbiAgICBjb25zdCBoZWFsdGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0hlYWx0aEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHN0YXR1czogJ2hlYWx0aHknLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgc3RhZ2U6IHByb2Nlc3MuZW52LlNUQUdFLFxuICAgICAgICAgICAgICB2ZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgU1RBR0U6IHN0YWdlIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG5cbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMucmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGhlYWx0aEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgQVBJIGZvciByZWFsLXRpbWUgY29tbXVuaWNhdGlvblxuICAgIHRoaXMud2Vic29ja2V0QXBpID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGkodGhpcywgJ1dlYlNvY2tldEFwaScsIHtcbiAgICAgIGFwaU5hbWU6IGB2ai13ZWJzb2NrZXQtJHtzdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246IGBWSiBBcHBsaWNhdGlvbiBXZWJTb2NrZXQgQVBJIC0gJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IGNvbm5lY3Rpb24gaGFuZGxlclxuICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29ubmVjdGlvbkZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnY29ubmVjdGlvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3dlYnNvY2tldCcpLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICAgIFdFQlNPQ0tFVF9BUElfSUQ6IHRoaXMud2Vic29ja2V0QXBpLmFwaUlkLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnMgZm9yIGNvbm5lY3Rpb24gbWFuYWdlbWVudFxuICAgIHNlc3Npb25UYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5jb25uZWN0aW9uRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZERhdGEodGhpcy5jb25uZWN0aW9uRnVuY3Rpb24pO1xuXG4gICAgLy8gR3JhbnQgQVBJIEdhdGV3YXkgbWFuYWdlbWVudCBwZXJtaXNzaW9uc1xuICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zJ10sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OiR7dGhpcy53ZWJzb2NrZXRBcGkuYXBpSWR9LypgXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIFdlYlNvY2tldCBtZXNzYWdlIGhhbmRsZXJcbiAgICBjb25zdCBtZXNzYWdlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNZXNzYWdlRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdtZXNzYWdlLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvd2Vic29ja2V0JyksXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcbiAgICAgICAgV0VCU09DS0VUX0FQSV9JRDogdGhpcy53ZWJzb2NrZXRBcGkuYXBpSWQsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyBmb3IgbWVzc2FnZSBoYW5kbGluZ1xuICAgIHNlc3Npb25UYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobWVzc2FnZUZ1bmN0aW9uKTtcbiAgICBjb25maWdUYWJsZS5ncmFudFJlYWREYXRhKG1lc3NhZ2VGdW5jdGlvbik7XG4gICAgbWVzc2FnZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zJ10sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OiR7dGhpcy53ZWJzb2NrZXRBcGkuYXBpSWR9LypgXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIFdlYlNvY2tldCByb3V0ZXMgdXNpbmcgV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb25cbiAgICBjb25zdCBjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxuICAgICAgJ0Nvbm5lY3RJbnRlZ3JhdGlvbicsXG4gICAgICB0aGlzLmNvbm5lY3Rpb25GdW5jdGlvblxuICAgICk7XG5cbiAgICBjb25zdCBkaXNjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxuICAgICAgJ0Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbicsIFxuICAgICAgdGhpcy5jb25uZWN0aW9uRnVuY3Rpb25cbiAgICApO1xuXG4gICAgY29uc3QgbWVzc2FnZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICdNZXNzYWdlSW50ZWdyYXRpb24nLFxuICAgICAgbWVzc2FnZUZ1bmN0aW9uXG4gICAgKTtcblxuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCckY29ubmVjdCcsIHsgaW50ZWdyYXRpb246IGNvbm5lY3RJbnRlZ3JhdGlvbiB9KTtcbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnJGRpc2Nvbm5lY3QnLCB7IGludGVncmF0aW9uOiBkaXNjb25uZWN0SW50ZWdyYXRpb24gfSk7XG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJyRkZWZhdWx0JywgeyBpbnRlZ3JhdGlvbjogbWVzc2FnZUludGVncmF0aW9uIH0pO1xuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCdtZXNzYWdlJywgeyBpbnRlZ3JhdGlvbjogbWVzc2FnZUludGVncmF0aW9uIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IGRlcGxveW1lbnRcbiAgICBjb25zdCB3ZWJzb2NrZXRTdGFnZSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0U3RhZ2UodGhpcywgJ1dlYlNvY2tldFN0YWdlJywge1xuICAgICAgd2ViU29ja2V0QXBpOiB0aGlzLndlYnNvY2tldEFwaSxcbiAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gU2Vzc2lvbiBjbGVhbnVwIGZ1bmN0aW9uIChydW5zIHBlcmlvZGljYWxseSB0byBjbGVhbiBleHBpcmVkIHNlc3Npb25zKVxuICAgIGNvbnN0IGNsZWFudXBGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NsZWFudXBGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2NsZWFudXAuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgU2NhbkNvbW1hbmQsIERlbGV0ZUNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYicpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgZHluYW1vZGJDbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9kYkNsaWVudCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCB0YWJsZU5hbWUgPSBwcm9jZXNzLmVudi5TRVNTSU9OX1RBQkxFX05BTUU7XG4gICAgICAgICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFNjYW4gZm9yIGV4cGlyZWQgc2Vzc2lvbnNcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnNlbmQobmV3IFNjYW5Db21tYW5kKHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgIEZpbHRlckV4cHJlc3Npb246ICdhdHRyaWJ1dGVfZXhpc3RzKCN0dGwpIEFORCAjdHRsIDwgOm5vdycsXG4gICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczogeyAnI3R0bCc6ICd0dGwnIH0sXG4gICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHsgJzpub3cnOiBub3cgfSxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRGVsZXRlIGV4cGlyZWQgc2Vzc2lvbnNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiByZXN1bHQuSXRlbXMgfHwgW10pIHtcbiAgICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIuc2VuZChuZXcgRGVsZXRlQ29tbWFuZCh7XG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgS2V5OiB7IHNlc3Npb25JZDogaXRlbS5zZXNzaW9uSWQgfSxcbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcXGBDbGVhbmVkIHVwIFxcJHtyZXN1bHQuSXRlbXM/Lmxlbmd0aCB8fCAwfSBleHBpcmVkIHNlc3Npb25zXFxgKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDIwMCwgY2xlYW5lZENvdW50OiByZXN1bHQuSXRlbXM/Lmxlbmd0aCB8fCAwIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NsZWFudXAgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNsZWFudXBGdW5jdGlvbik7XG5cbiAgICAvLyBTY2hlZHVsZSBjbGVhbnVwIGZ1bmN0aW9uIHRvIHJ1biBldmVyeSBob3VyXG4gICAgY29uc3QgY2xlYW51cFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0NsZWFudXBTY2hlZHVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24uaG91cnMoMSkpLFxuICAgICAgZGVzY3JpcHRpb246ICdDbGVhbnVwIGV4cGlyZWQgV2ViU29ja2V0IHNlc3Npb25zJyxcbiAgICB9KTtcblxuICAgIGNsZWFudXBSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihjbGVhbnVwRnVuY3Rpb24pKTtcblxuICAgIC8vIFNldCBBUEkgVVJMc1xuICAgIHRoaXMuYXBpVXJsID0gdGhpcy5yZXN0QXBpLnVybDtcbiAgICB0aGlzLndlYnNvY2tldFVybCA9IGB3c3M6Ly8ke3RoaXMud2Vic29ja2V0QXBpLmFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tLyR7c3RhZ2V9YDtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmVzdEFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalJlc3RBcGlVcmwtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYlNvY2tldFVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldFVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqV2ViU29ja2V0VXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc3RBcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdSRVNUIEFQSSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpSZXN0QXBpSWQtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYlNvY2tldEFwaUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMud2Vic29ja2V0QXBpLmFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgQVBJIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWaldlYlNvY2tldEFwaUlkLSR7c3RhZ2V9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==