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
exports.VjConfigStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class VjConfigStack extends cdk.Stack {
    configTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, config } = props;
        // Configuration table for runtime settings
        this.configTable = new dynamodb.Table(this, 'ConfigTable', {
            tableName: `vj-config-${stage}`,
            partitionKey: {
                name: 'configKey',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: config.enableBackup,
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            tags: {
                Name: `VJ Config Table - ${stage}`,
                Purpose: 'Runtime configuration storage',
            },
        });
        // SSM Parameters for application configuration
        const appConfig = {
            stage,
            domainName: config.domainName,
            enableAuth: config.enableAuth,
            enableCloudFront: config.enableCloudFront,
            features: {
                webgl2: true,
                voiceRecognition: true,
                midi: true,
                cloudSync: true,
                analytics: stage !== 'dev',
            },
            performance: {
                targetFPS: 60,
                maxParticles: stage === 'prod' ? 2000 : 1000,
                audioLatencyTarget: 20,
                renderLatencyTarget: 16,
            },
            limits: {
                maxPresets: 100,
                maxHistoryItems: 50,
                maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
            },
        };
        new ssm.StringParameter(this, 'AppConfig', {
            parameterName: `/vj-app/${stage}/config`,
            stringValue: JSON.stringify(appConfig),
            description: `VJ Application configuration for ${stage} environment`,
            tier: ssm.ParameterTier.STANDARD,
        });
        // Database configuration
        new ssm.StringParameter(this, 'DatabaseConfig', {
            parameterName: `/vj-app/${stage}/database/config-table`,
            stringValue: this.configTable.tableName,
            description: `Configuration table name for ${stage} environment`,
        });
        // WebSocket configuration
        new ssm.StringParameter(this, 'WebSocketConfig', {
            parameterName: `/vj-app/${stage}/websocket/config`,
            stringValue: JSON.stringify({
                reconnectInterval: 3000,
                maxReconnectAttempts: 5,
                heartbeatInterval: 30000,
                connectionTimeout: 10000,
                maxConnections: stage === 'prod' ? 1000 : 100,
            }),
            description: `WebSocket configuration for ${stage} environment`,
        });
        // Audio processing configuration
        new ssm.StringParameter(this, 'AudioConfig', {
            parameterName: `/vj-app/${stage}/audio/config`,
            stringValue: JSON.stringify({
                sampleRate: 44100,
                fftSize: 2048,
                smoothingTimeConstant: 0.8,
                minDecibels: -100,
                maxDecibels: -30,
                frequencyBinCount: 1024,
            }),
            description: `Audio processing configuration for ${stage} environment`,
        });
        // Visual rendering configuration
        new ssm.StringParameter(this, 'VisualConfig', {
            parameterName: `/vj-app/${stage}/visual/config`,
            stringValue: JSON.stringify({
                defaultCanvasWidth: 1920,
                defaultCanvasHeight: 1080,
                maxCanvasWidth: stage === 'prod' ? 3840 : 1920,
                maxCanvasHeight: stage === 'prod' ? 2160 : 1080,
                defaultPixelRatio: 1,
                maxPixelRatio: stage === 'prod' ? 3 : 2,
                maxParticles: appConfig.performance.maxParticles,
            }),
            description: `Visual rendering configuration for ${stage} environment`,
        });
        // Secrets for sensitive configuration (only if auth is enabled)
        if (config.enableAuth) {
            new secretsmanager.Secret(this, 'JwtSecret', {
                secretName: `/vj-app/${stage}/auth/jwt-secret`,
                description: `JWT signing secret for ${stage} environment`,
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({ purpose: 'jwt-signing' }),
                    generateStringKey: 'secret',
                    excludeCharacters: '"@/\\',
                    includeSpace: false,
                    passwordLength: 64,
                },
            });
            new secretsmanager.Secret(this, 'ApiKeys', {
                secretName: `/vj-app/${stage}/auth/api-keys`,
                description: `API keys for external services - ${stage} environment`,
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({
                        aws: 'auto-generated',
                        analytics: 'auto-generated',
                    }),
                    generateStringKey: 'master-key',
                    excludeCharacters: '"@/\\',
                    includeSpace: false,
                    passwordLength: 32,
                },
            });
        }
        // CloudWatch log retention configuration
        new ssm.StringParameter(this, 'LogConfig', {
            parameterName: `/vj-app/${stage}/logging/config`,
            stringValue: JSON.stringify({
                retentionDays: stage === 'prod' ? 30 : 7,
                enableDetailedLogging: stage !== 'prod',
                logLevel: stage === 'prod' ? 'INFO' : 'DEBUG',
                enablePerformanceLogging: true,
                enableErrorTracking: true,
            }),
            description: `Logging configuration for ${stage} environment`,
        });
        // CORS configuration
        new ssm.StringParameter(this, 'CorsConfig', {
            parameterName: `/vj-app/${stage}/cors/config`,
            stringValue: JSON.stringify({
                allowedOrigins: stage === 'prod'
                    ? [`https://${config.domainName}`]
                    : ['http://localhost:3000', 'http://localhost:3001'],
                allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                maxAge: 86400, // 24 hours
            }),
            description: `CORS configuration for ${stage} environment`,
        });
        // Output important values
        new cdk.CfnOutput(this, 'ConfigTableName', {
            value: this.configTable.tableName,
            description: 'Configuration DynamoDB table name',
            exportName: `VjConfigTable-${stage}`,
        });
        new cdk.CfnOutput(this, 'ConfigTableArn', {
            value: this.configTable.tableArn,
            description: 'Configuration DynamoDB table ARN',
            exportName: `VjConfigTableArn-${stage}`,
        });
        new cdk.CfnOutput(this, 'ParameterPrefix', {
            value: `/vj-app/${stage}/`,
            description: 'SSM Parameter prefix for this environment',
            exportName: `VjParameterPrefix-${stage}`,
        });
    }
}
exports.VjConfigStack = VjConfigStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotY29uZmlnLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotY29uZmlnLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQseURBQTJDO0FBQzNDLCtFQUFpRTtBQWFqRSxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQixXQUFXLENBQWlCO0lBRTVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFaEMsMkNBQTJDO1FBQzNDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDekQsU0FBUyxFQUFFLGFBQWEsS0FBSyxFQUFFO1lBQy9CLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsWUFBWTtZQUN4QyxhQUFhLEVBQUUsS0FBSyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN0RixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxFQUFFLHFCQUFxQixLQUFLLEVBQUU7Z0JBQ2xDLE9BQU8sRUFBRSwrQkFBK0I7YUFDekM7U0FD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QUFFLHVCQUF1QixDQUFDO2dCQUN0RCxjQUFjLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDO2dCQUMzRCxjQUFjLEVBQUUsQ0FBQyxjQUFjLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixDQUFDO2dCQUNyRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFdBQVc7YUFDM0IsQ0FBQztZQUNGLFdBQVcsRUFBRSwwQkFBMEIsS0FBSyxjQUFjO1NBQzNELENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVM7WUFDakMsV0FBVyxFQUFFLG1DQUFtQztZQUNoRCxVQUFVLEVBQUUsaUJBQWlCLEtBQUssRUFBRTtTQUNyQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVE7WUFDaEMsV0FBVyxFQUFFLGtDQUFrQztZQUMvQyxVQUFVLEVBQUUsb0JBQW9CLEtBQUssRUFBRTtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxXQUFXLEtBQUssR0FBRztZQUMxQixXQUFXLEVBQUUsMkNBQTJDO1lBQ3hELFVBQVUsRUFBRSxxQkFBcUIsS0FBSyxFQUFFO1NBQ3pDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXZMRCxzQ0F1TEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWakNvbmZpZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgICBlbmFibGVBdXRoOiBib29sZWFuO1xuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gICAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgVmpDb25maWdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBjb25maWdUYWJsZTogZHluYW1vZGIuVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqQ29uZmlnU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnIH0gPSBwcm9wcztcblxuICAgIC8vIENvbmZpZ3VyYXRpb24gdGFibGUgZm9yIHJ1bnRpbWUgc2V0dGluZ3NcbiAgICB0aGlzLmNvbmZpZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDb25maWdUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYHZqLWNvbmZpZy0ke3N0YWdlfWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2NvbmZpZ0tleScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZW5hYmxlQmFja3VwLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB0YWdzOiB7XG4gICAgICAgIE5hbWU6IGBWSiBDb25maWcgVGFibGUgLSAke3N0YWdlfWAsXG4gICAgICAgIFB1cnBvc2U6ICdSdW50aW1lIGNvbmZpZ3VyYXRpb24gc3RvcmFnZScsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gU1NNIFBhcmFtZXRlcnMgZm9yIGFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBhcHBDb25maWcgPSB7XG4gICAgICBzdGFnZSxcbiAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgZW5hYmxlQXV0aDogY29uZmlnLmVuYWJsZUF1dGgsXG4gICAgICBlbmFibGVDbG91ZEZyb250OiBjb25maWcuZW5hYmxlQ2xvdWRGcm9udCxcbiAgICAgIGZlYXR1cmVzOiB7XG4gICAgICAgIHdlYmdsMjogdHJ1ZSxcbiAgICAgICAgdm9pY2VSZWNvZ25pdGlvbjogdHJ1ZSxcbiAgICAgICAgbWlkaTogdHJ1ZSxcbiAgICAgICAgY2xvdWRTeW5jOiB0cnVlLFxuICAgICAgICBhbmFseXRpY3M6IHN0YWdlICE9PSAnZGV2JyxcbiAgICAgIH0sXG4gICAgICBwZXJmb3JtYW5jZToge1xuICAgICAgICB0YXJnZXRGUFM6IDYwLFxuICAgICAgICBtYXhQYXJ0aWNsZXM6IHN0YWdlID09PSAncHJvZCcgPyAyMDAwIDogMTAwMCxcbiAgICAgICAgYXVkaW9MYXRlbmN5VGFyZ2V0OiAyMCxcbiAgICAgICAgcmVuZGVyTGF0ZW5jeVRhcmdldDogMTYsXG4gICAgICB9LFxuICAgICAgbGltaXRzOiB7XG4gICAgICAgIG1heFByZXNldHM6IDEwMCxcbiAgICAgICAgbWF4SGlzdG9yeUl0ZW1zOiA1MCxcbiAgICAgICAgbWF4U2Vzc2lvbkR1cmF0aW9uOiAyNCAqIDYwICogNjAgKiAxMDAwLCAvLyAyNCBob3Vyc1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0FwcENvbmZpZycsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoYXBwQ29uZmlnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICAvLyBEYXRhYmFzZSBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0RhdGFiYXNlQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vZGF0YWJhc2UvY29uZmlnLXRhYmxlYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQ29uZmlndXJhdGlvbiB0YWJsZSBuYW1lIGZvciAke3N0YWdlfSBlbnZpcm9ubWVudGAsXG4gICAgfSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdXZWJTb2NrZXRDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS93ZWJzb2NrZXQvY29uZmlnYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHJlY29ubmVjdEludGVydmFsOiAzMDAwLFxuICAgICAgICBtYXhSZWNvbm5lY3RBdHRlbXB0czogNSxcbiAgICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IDMwMDAwLFxuICAgICAgICBjb25uZWN0aW9uVGltZW91dDogMTAwMDAsXG4gICAgICAgIG1heENvbm5lY3Rpb25zOiBzdGFnZSA9PT0gJ3Byb2QnID8gMTAwMCA6IDEwMCxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBXZWJTb2NrZXQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gQXVkaW8gcHJvY2Vzc2luZyBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0F1ZGlvQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vYXVkaW8vY29uZmlnYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHNhbXBsZVJhdGU6IDQ0MTAwLFxuICAgICAgICBmZnRTaXplOiAyMDQ4LFxuICAgICAgICBzbW9vdGhpbmdUaW1lQ29uc3RhbnQ6IDAuOCxcbiAgICAgICAgbWluRGVjaWJlbHM6IC0xMDAsXG4gICAgICAgIG1heERlY2liZWxzOiAtMzAsXG4gICAgICAgIGZyZXF1ZW5jeUJpbkNvdW50OiAxMDI0LFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogYEF1ZGlvIHByb2Nlc3NpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gVmlzdWFsIHJlbmRlcmluZyBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1Zpc3VhbENvbmZpZycsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L3Zpc3VhbC9jb25maWdgLFxuICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZGVmYXVsdENhbnZhc1dpZHRoOiAxOTIwLFxuICAgICAgICBkZWZhdWx0Q2FudmFzSGVpZ2h0OiAxMDgwLFxuICAgICAgICBtYXhDYW52YXNXaWR0aDogc3RhZ2UgPT09ICdwcm9kJyA/IDM4NDAgOiAxOTIwLFxuICAgICAgICBtYXhDYW52YXNIZWlnaHQ6IHN0YWdlID09PSAncHJvZCcgPyAyMTYwIDogMTA4MCxcbiAgICAgICAgZGVmYXVsdFBpeGVsUmF0aW86IDEsXG4gICAgICAgIG1heFBpeGVsUmF0aW86IHN0YWdlID09PSAncHJvZCcgPyAzIDogMixcbiAgICAgICAgbWF4UGFydGljbGVzOiBhcHBDb25maWcucGVyZm9ybWFuY2UubWF4UGFydGljbGVzLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogYFZpc3VhbCByZW5kZXJpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjcmV0cyBmb3Igc2Vuc2l0aXZlIGNvbmZpZ3VyYXRpb24gKG9ubHkgaWYgYXV0aCBpcyBlbmFibGVkKVxuICAgIGlmIChjb25maWcuZW5hYmxlQXV0aCkge1xuICAgICAgbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnSnd0U2VjcmV0Jywge1xuICAgICAgICBzZWNyZXROYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9hdXRoL2p3dC1zZWNyZXRgLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEpXVCBzaWduaW5nIHNlY3JldCBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IHB1cnBvc2U6ICdqd3Qtc2lnbmluZycgfSksXG4gICAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICdzZWNyZXQnLFxuICAgICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICAgIGluY2x1ZGVTcGFjZTogZmFsc2UsXG4gICAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDY0LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBzZWNyZXRzbWFuYWdlci5TZWNyZXQodGhpcywgJ0FwaUtleXMnLCB7XG4gICAgICAgIHNlY3JldE5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L2F1dGgvYXBpLWtleXNgLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEFQSSBrZXlzIGZvciBleHRlcm5hbCBzZXJ2aWNlcyAtICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgYXdzOiAnYXV0by1nZW5lcmF0ZWQnLFxuICAgICAgICAgICAgYW5hbHl0aWNzOiAnYXV0by1nZW5lcmF0ZWQnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAnbWFzdGVyLWtleScsXG4gICAgICAgICAgZXhjbHVkZUNoYXJhY3RlcnM6ICdcIkAvXFxcXCcsXG4gICAgICAgICAgaW5jbHVkZVNwYWNlOiBmYWxzZSxcbiAgICAgICAgICBwYXNzd29yZExlbmd0aDogMzIsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZFdhdGNoIGxvZyByZXRlbnRpb24gY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdMb2dDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9sb2dnaW5nL2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICByZXRlbnRpb25EYXlzOiBzdGFnZSA9PT0gJ3Byb2QnID8gMzAgOiA3LFxuICAgICAgICBlbmFibGVEZXRhaWxlZExvZ2dpbmc6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICAgIGxvZ0xldmVsOiBzdGFnZSA9PT0gJ3Byb2QnID8gJ0lORk8nIDogJ0RFQlVHJyxcbiAgICAgICAgZW5hYmxlUGVyZm9ybWFuY2VMb2dnaW5nOiB0cnVlLFxuICAgICAgICBlbmFibGVFcnJvclRyYWNraW5nOiB0cnVlLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogYExvZ2dpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gQ09SUyBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0NvcnNDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9jb3JzL2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBhbGxvd2VkT3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IFtgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWBdXG4gICAgICAgICAgOiBbJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDEnXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJywgJ1gtUmVxdWVzdGVkLVdpdGgnXSxcbiAgICAgICAgbWF4QWdlOiA4NjQwMCwgLy8gMjQgaG91cnNcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBDT1JTIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBpbXBvcnRhbnQgdmFsdWVzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbmZpZ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29uZmlndXJhdGlvbiBEeW5hbW9EQiB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWakNvbmZpZ1RhYmxlLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdUYWJsZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDb25maWd1cmF0aW9uIER5bmFtb0RCIHRhYmxlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgVmpDb25maWdUYWJsZUFybi0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGFyYW1ldGVyUHJlZml4Jywge1xuICAgICAgdmFsdWU6IGAvdmotYXBwLyR7c3RhZ2V9L2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NTTSBQYXJhbWV0ZXIgcHJlZml4IGZvciB0aGlzIGVudmlyb25tZW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalBhcmFtZXRlclByZWZpeC0ke3N0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=