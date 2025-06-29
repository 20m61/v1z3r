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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VjApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
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
        // WebSocket routes using WebSocketIntegration
        const connectIntegration = new apigatewayv2.WebSocketLambdaIntegration('ConnectIntegration', connectionFunction);
        const disconnectIntegration = new apigatewayv2.WebSocketLambdaIntegration('DisconnectIntegration', connectionFunction);
        const messageIntegration = new apigatewayv2.WebSocketLambdaIntegration('MessageIntegration', messageFunction);
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
        const cleanupRule = new cdk.aws_events.Rule(this, 'CleanupSchedule', {
            schedule: cdk.aws_events.Schedule.rate(cdk.Duration.hours(1)),
            description: 'Cleanup expired WebSocket sessions',
        });
        cleanupRule.addTarget(new cdk.aws_events_targets.LambdaFunction(cleanupFunction));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1RUFBeUQ7QUFDekQsMkVBQTZEO0FBQzdELCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBZ0I3QyxNQUFhLFVBQVcsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN2QixPQUFPLENBQXFCO0lBQzVCLFlBQVksQ0FBNEI7SUFDeEMsTUFBTSxDQUFTO0lBQ2YsWUFBWSxDQUFTO0lBRXJDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFeEUsdUNBQXVDO1FBQ3ZDLE1BQU0sV0FBVyxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQy9ELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQztZQUNuRCxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQ2hELFdBQVcsRUFBRSx5REFBeUQ7U0FDdkUsQ0FBQyxDQUFDO1FBRUgsK0NBQStDO1FBQy9DLE1BQU0saUJBQWlCLEdBQUc7WUFDeEIsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLFNBQVM7WUFDMUMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLFNBQVM7WUFDeEMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLFNBQVM7WUFDeEMsS0FBSyxFQUFFLEtBQUs7WUFDWixXQUFXLEVBQUUsS0FBSyxLQUFL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WUFBWSxHQUFHLFNBQVMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLGdCQUFnQixJQUFJLENBQUMsTUFBTSxrQkFBa0IsS0FBSyxFQUFFLENBQUM7UUFFekcsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNsQixXQUFXLEVBQUUsY0FBYztZQUMzQixVQUFVLEVBQUUsZ0JBQWdCLEtBQUssRUFBRTtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVk7WUFDeEIsV0FBVyxFQUFFLG1CQUFtQjtZQUNoQyxVQUFVLEVBQUUsa0JBQWtCLEtBQUssRUFBRTtTQUN0QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtZQUMvQixLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTO1lBQzdCLFdBQVcsRUFBRSxhQUFhO1lBQzFCLFVBQVUsRUFBRSxlQUFlLEtBQUssRUFBRTtTQUNuQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUs7WUFDOUIsV0FBVyxFQUFFLGtCQUFrQjtZQUMvQixVQUFVLEVBQUUsb0JBQW9CLEtBQUssRUFBRTtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUExUUQsZ0NBMFFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpBcGlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgc2Vzc2lvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHJlc2V0VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBjb25maWdUYWJsZTogZHluYW1vZGIuVGFibGU7XG59XG5cbmV4cG9ydCBjbGFzcyBWakFwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlc3RBcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldEFwaTogYXBpZ2F0ZXdheXYyLldlYlNvY2tldEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGFwaVVybDogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0VXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqQXBpU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnLCBzZXNzaW9uVGFibGUsIHByZXNldFRhYmxlLCBjb25maWdUYWJsZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBMYW1iZGEgbGF5ZXIgZm9yIHNoYXJlZCBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBzaGFyZWRMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTaGFyZWRMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhLWxheWVycy9zaGFyZWQnKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2hhcmVkIGRlcGVuZGVuY2llcyBmb3IgVkogYXBwbGljYXRpb24gTGFtYmRhIGZ1bmN0aW9ucycsXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGZ1bmN0aW9uIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgIGNvbnN0IGNvbW1vbkVudmlyb25tZW50ID0ge1xuICAgICAgU0VTU0lPTl9UQUJMRV9OQU1FOiBzZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgUFJFU0VUX1RBQkxFX05BTUU6IHByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIENPTkZJR19UQUJMRV9OQU1FOiBjb25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICBTVEFHRTogc3RhZ2UsXG4gICAgICBDT1JTX09SSUdJTjogc3RhZ2UgPT09ICdwcm9kJyA/IGBodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YCA6ICcqJyxcbiAgICB9O1xuXG4gICAgLy8gUkVTVCBBUEkgZm9yIHByZXNldCBtYW5hZ2VtZW50IGFuZCBjb25maWd1cmF0aW9uXG4gICAgdGhpcy5yZXN0QXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUmVzdEFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gUkVTVCBBUEkgLSAke3N0YWdlfWAsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBzdGFnZSA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gW2BodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YF1cbiAgICAgICAgICA6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleScsICdYLUFtei1TZWN1cml0eS1Ub2tlbiddLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBzdGFnZSxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBQcmVzZXQgbWFuYWdlbWVudCBMYW1iZGEgZnVuY3Rpb25cbiAgICBjb25zdCBwcmVzZXRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1ByZXNldEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAncHJlc2V0LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvcHJlc2V0JyksXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgcHJlc2V0VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHByZXNldEZ1bmN0aW9uKTtcbiAgICBjb25maWdUYWJsZS5ncmFudFJlYWREYXRhKHByZXNldEZ1bmN0aW9uKTtcblxuICAgIC8vIFByZXNldCBBUEkgZW5kcG9pbnRzXG4gICAgY29uc3QgcHJlc2V0UmVzb3VyY2UgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgncHJlc2V0cycpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJlc2V0RnVuY3Rpb24pKTtcbiAgICBwcmVzZXRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcmVzZXRGdW5jdGlvbikpO1xuXG4gICAgY29uc3QgcHJlc2V0SXRlbVJlc291cmNlID0gcHJlc2V0UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3twcmVzZXRJZH0nKTtcbiAgICBwcmVzZXRJdGVtUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldEl0ZW1SZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByZXNldEZ1bmN0aW9uKSk7XG4gICAgcHJlc2V0SXRlbVJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJlc2V0RnVuY3Rpb24pKTtcblxuICAgIC8vIEhlYWx0aCBjaGVjayBlbmRwb2ludFxuICAgIGNvbnN0IGhlYWx0aEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSGVhbHRoRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdoZWFsdGguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHN0YXR1czogJ2hlYWx0aHknLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgc3RhZ2U6IHByb2Nlc3MuZW52LlNUQUdFLFxuICAgICAgICAgICAgICB2ZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgU1RBR0U6IHN0YWdlIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG5cbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMucmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGhlYWx0aEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgQVBJIGZvciByZWFsLXRpbWUgY29tbXVuaWNhdGlvblxuICAgIHRoaXMud2Vic29ja2V0QXBpID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGkodGhpcywgJ1dlYlNvY2tldEFwaScsIHtcbiAgICAgIGFwaU5hbWU6IGB2ai13ZWJzb2NrZXQtJHtzdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246IGBWSiBBcHBsaWNhdGlvbiBXZWJTb2NrZXQgQVBJIC0gJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IGNvbm5lY3Rpb24gaGFuZGxlclxuICAgIGNvbnN0IGNvbm5lY3Rpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Nvbm5lY3Rpb25GdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2Nvbm5lY3Rpb24uaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93ZWJzb2NrZXQnKSxcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgICBXRUJTT0NLRVRfQVBJX0lEOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIGZvciBjb25uZWN0aW9uIG1hbmFnZW1lbnRcbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNvbm5lY3Rpb25GdW5jdGlvbik7XG4gICAgY29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YShjb25uZWN0aW9uRnVuY3Rpb24pO1xuXG4gICAgLy8gR3JhbnQgQVBJIEdhdGV3YXkgbWFuYWdlbWVudCBwZXJtaXNzaW9uc1xuICAgIGNvbm5lY3Rpb25GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToke3RoaXMud2Vic29ja2V0QXBpLmFwaUlkfS8qYFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgbWVzc2FnZSBoYW5kbGVyXG4gICAgY29uc3QgbWVzc2FnZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWVzc2FnZUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnbWVzc2FnZS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3dlYnNvY2tldCcpLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICAgIFdFQlNPQ0tFVF9BUElfSUQ6IHRoaXMud2Vic29ja2V0QXBpLmFwaUlkLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIG1lc3NhZ2UgaGFuZGxpbmdcbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG1lc3NhZ2VGdW5jdGlvbik7XG4gICAgY29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuICAgIG1lc3NhZ2VGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToke3RoaXMud2Vic29ja2V0QXBpLmFwaUlkfS8qYFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgcm91dGVzIHVzaW5nIFdlYlNvY2tldEludGVncmF0aW9uXG4gICAgY29uc3QgY29ubmVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICdDb25uZWN0SW50ZWdyYXRpb24nLFxuICAgICAgY29ubmVjdGlvbkZ1bmN0aW9uXG4gICAgKTtcblxuICAgIGNvbnN0IGRpc2Nvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnRGlzY29ubmVjdEludGVncmF0aW9uJywgXG4gICAgICBjb25uZWN0aW9uRnVuY3Rpb25cbiAgICApO1xuXG4gICAgY29uc3QgbWVzc2FnZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICdNZXNzYWdlSW50ZWdyYXRpb24nLFxuICAgICAgbWVzc2FnZUZ1bmN0aW9uXG4gICAgKTtcblxuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCckY29ubmVjdCcsIHsgaW50ZWdyYXRpb246IGNvbm5lY3RJbnRlZ3JhdGlvbiB9KTtcbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgnJGRpc2Nvbm5lY3QnLCB7IGludGVncmF0aW9uOiBkaXNjb25uZWN0SW50ZWdyYXRpb24gfSk7XG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJyRkZWZhdWx0JywgeyBpbnRlZ3JhdGlvbjogbWVzc2FnZUludGVncmF0aW9uIH0pO1xuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCdtZXNzYWdlJywgeyBpbnRlZ3JhdGlvbjogbWVzc2FnZUludGVncmF0aW9uIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IGRlcGxveW1lbnRcbiAgICBjb25zdCB3ZWJzb2NrZXRTdGFnZSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0U3RhZ2UodGhpcywgJ1dlYlNvY2tldFN0YWdlJywge1xuICAgICAgd2ViU29ja2V0QXBpOiB0aGlzLndlYnNvY2tldEFwaSxcbiAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gU2Vzc2lvbiBjbGVhbnVwIGZ1bmN0aW9uIChydW5zIHBlcmlvZGljYWxseSB0byBjbGVhbiBleHBpcmVkIHNlc3Npb25zKVxuICAgIGNvbnN0IGNsZWFudXBGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NsZWFudXBGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2NsZWFudXAuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoKTtcbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhYmxlTmFtZSA9IHByb2Nlc3MuZW52LlNFU1NJT05fVEFCTEVfTkFNRTtcbiAgICAgICAgICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gU2NhbiBmb3IgZXhwaXJlZCBzZXNzaW9uc1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2Nhbih7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICBGaWx0ZXJFeHByZXNzaW9uOiAnYXR0cmlidXRlX2V4aXN0cygjdHRsKSBBTkQgI3R0bCA8IDpub3cnLFxuICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHsgJyN0dGwnOiAndHRsJyB9LFxuICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7ICc6bm93Jzogbm93IH0sXG4gICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIERlbGV0ZSBleHBpcmVkIHNlc3Npb25zXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVzdWx0Lkl0ZW1zIHx8IFtdKSB7XG4gICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLmRlbGV0ZSh7XG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgS2V5OiB7IHNlc3Npb25JZDogaXRlbS5zZXNzaW9uSWQgfSxcbiAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcXGBDbGVhbmVkIHVwIFxcJHtyZXN1bHQuSXRlbXM/Lmxlbmd0aCB8fCAwfSBleHBpcmVkIHNlc3Npb25zXFxgKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDIwMCwgY2xlYW5lZENvdW50OiByZXN1bHQuSXRlbXM/Lmxlbmd0aCB8fCAwIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NsZWFudXAgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNsZWFudXBGdW5jdGlvbik7XG5cbiAgICAvLyBTY2hlZHVsZSBjbGVhbnVwIGZ1bmN0aW9uIHRvIHJ1biBldmVyeSBob3VyXG4gICAgY29uc3QgY2xlYW51cFJ1bGUgPSBuZXcgY2RrLmF3c19ldmVudHMuUnVsZSh0aGlzLCAnQ2xlYW51cFNjaGVkdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGNkay5hd3NfZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xlYW51cCBleHBpcmVkIFdlYlNvY2tldCBzZXNzaW9ucycsXG4gICAgfSk7XG5cbiAgICBjbGVhbnVwUnVsZS5hZGRUYXJnZXQobmV3IGNkay5hd3NfZXZlbnRzX3RhcmdldHMuTGFtYmRhRnVuY3Rpb24oY2xlYW51cEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBTZXQgQVBJIFVSTHNcbiAgICB0aGlzLmFwaVVybCA9IHRoaXMucmVzdEFwaS51cmw7XG4gICAgdGhpcy53ZWJzb2NrZXRVcmwgPSBgd3NzOi8vJHt0aGlzLndlYnNvY2tldEFwaS5hcGlJZH0uZXhlY3V0ZS1hcGkuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke3N0YWdlfWA7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3RBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JFU1QgQVBJIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpSZXN0QXBpVXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJzb2NrZXRVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWaldlYlNvY2tldFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXN0QXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqUmVzdEFwaUlkLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpXZWJTb2NrZXRBcGlJZC0ke3N0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=