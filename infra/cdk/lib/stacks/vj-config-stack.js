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
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: config.enableBackup,
            },
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Add tags after creation
        cdk.Tags.of(this.configTable).add('Name', `VJ Config Table - ${stage}`);
        cdk.Tags.of(this.configTable).add('Purpose', 'Runtime configuration storage');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotY29uZmlnLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotY29uZmlnLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUNyRCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBYWpFLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLFdBQVcsQ0FBaUI7SUFFNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVoQywyQ0FBMkM7UUFDM0MsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN6RCxTQUFTLEVBQUUsYUFBYSxLQUFLLEVBQUU7WUFDL0IsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELGdDQUFnQyxFQUFFO2dCQUNoQywwQkFBMEIsRUFBRSxNQUFNLENBQUMsWUFBWTthQUNoRDtZQUNELGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3ZGLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxxQkFBcUIsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN4RSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSwrQkFBK0IsQ0FBQyxDQUFDO1FBRTlFLCtDQUErQztRQUMvQyxNQUFNLFNBQVMsR0FBRztZQUNoQixLQUFLO1lBQ0wsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQzdCLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVTtZQUM3QixnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO1lBQ3pDLFFBQVEsRUFBRTtnQkFDUixNQUFNLEVBQUUsSUFBSTtnQkFDWixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixJQUFJLEVBQUUsSUFBSTtnQkFDVixTQUFTLEVBQUUsSUFBSTtnQkFDZixTQUFTLEVBQUUsS0FBSyxLQUFLLEtBQUs7YUFDM0I7WUFDRCxXQUFXLEVBQUU7Z0JBQ1gsU0FBUyxFQUFFLEVBQUU7Z0JBQ2IsWUFBWSxFQUFFLEtBQUssS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtnQkFDNUMsa0JBQWtCLEVBQUUsRUFBRTtnQkFDdEIsbUJBQW1CLEVBQUUsRUFBRTthQUN4QjtZQUNELE1BQU0sRUFBRTtnQkFDTixVQUFVLEVBQUUsR0FBRztnQkFDZixlQUFlLEVBQUUsRUFBRTtnQkFDbkIsa0JBQWtCLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxFQUFFLFdBQVc7YUFDckQ7U0FDRixDQUFDO1FBRUYsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDekMsYUFBYSxFQUFFLFdBQVcsS0FBSyxTQUFTO1lBQ3hDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQztZQUN0QyxXQUFXLEVBQUUsb0NBQW9DLEtBQUssY0FBYztZQUNwRSxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2pDLENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzlDLGFBQWEsRUFBRSxXQUFXLEtBQUssd0JBQXdCO1lBQ3ZELFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVM7WUFDdkMsV0FBVyxFQUFFLGdDQUFnQyxLQUFLLGNBQWM7U0FDakUsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDL0MsYUFBYSxFQUFFLFdBQVcsS0FBSyxtQkFBbUI7WUFDbEQsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQzFCLGlCQUFpQixFQUFFLElBQUk7Z0JBQ3ZCLG9CQUFvQixFQUFFLENBQUM7Z0JBQ3ZCLGlCQUFpQixFQUFFLEtBQUs7Z0JBQ3hCLGlCQUFpQixFQUFFLEtBQUs7Z0JBQ3hCLGNBQWMsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUc7YUFDOUMsQ0FBQztZQUNGLFdBQVcsRUFBRSwrQkFBK0IsS0FBSyxjQUFjO1NBQ2hFLENBQUMsQ0FBQztRQUVILGlDQUFpQztRQUNqQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMzQyxhQUFhLEVBQUUsV0FBVyxLQUFLLGVBQWU7WUFDOUMsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQzFCLFVBQVUsRUFBRSxLQUFLO2dCQUNqQixPQUFPLEVBQUUsSUFBSTtnQkFDYixxQkFBcUIsRUFBRSxHQUFHO2dCQUMxQixXQUFXLEVBQUUsQ0FBQyxHQUFHO2dCQUNqQixXQUFXLEVBQUUsQ0FBQyxFQUFFO2dCQUNoQixpQkFBaUIsRUFBRSxJQUFJO2FBQ3hCLENBQUM7WUFDRixXQUFXLEVBQUUsc0NBQXNDLEtBQUssY0FBYztTQUN2RSxDQUFDLENBQUM7UUFFSCxpQ0FBaUM7UUFDakMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDNUMsYUFBYSxFQUFFLFdBQVcsS0FBSyxnQkFBZ0I7WUFDL0MsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQzFCLGtCQUFrQixFQUFFLElBQUk7Z0JBQ3hCLG1CQUFtQixFQUFFLElBQUk7Z0JBQ3pCLGNBQWMsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7Z0JBQzlDLGVBQWUsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7Z0JBQy9DLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZDLFlBQVksRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLFlBQVk7YUFDakQsQ0FBQztZQUNGLFdBQVcsRUFBRSxzQ0FBc0MsS0FBSyxjQUFjO1NBQ3ZFLENBQUMsQ0FBQztRQUVILGdFQUFnRTtRQUNoRSxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7WUFDckIsSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7Z0JBQzNDLFVBQVUsRUFBRSxXQUFXLEtBQUssa0JBQWtCO2dCQUM5QyxXQUFXLEVBQUUsMEJBQTBCLEtBQUssY0FBYztnQkFDMUQsb0JBQW9CLEVBQUU7b0JBQ3BCLG9CQUFvQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLENBQUM7b0JBQ2hFLGlCQUFpQixFQUFFLFFBQVE7b0JBQzNCLGlCQUFpQixFQUFFLE9BQU87b0JBQzFCLFlBQVksRUFBRSxLQUFLO29CQUNuQixjQUFjLEVBQUUsRUFBRTtpQkFDbkI7YUFDRixDQUFDLENBQUM7WUFFSCxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDekMsVUFBVSxFQUFFLFdBQVcsS0FBSyxnQkFBZ0I7Z0JBQzVDLFdBQVcsRUFBRSxvQ0FBb0MsS0FBSyxjQUFjO2dCQUNwRSxvQkFBb0IsRUFBRTtvQkFDcEIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQzt3QkFDbkMsR0FBRyxFQUFFLGdCQUFnQjt3QkFDckIsU0FBUyxFQUFFLGdCQUFnQjtxQkFDNUIsQ0FBQztvQkFDRixpQkFBaUIsRUFBRSxZQUFZO29CQUMvQixpQkFBaUIsRUFBRSxPQUFPO29CQUMxQixZQUFZLEVBQUUsS0FBSztvQkFDbkIsY0FBYyxFQUFFLEVBQUU7aUJBQ25CO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7UUFFRCx5Q0FBeUM7UUFDekMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDekMsYUFBYSxFQUFFLFdBQVcsS0FBSyxpQkFBaUI7WUFDaEQsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQzFCLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLHFCQUFxQixFQUFFLEtBQUssS0FBSyxNQUFNO2dCQUN2QyxRQUFRLEVBQUUsS0FBSyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO2dCQUM3Qyx3QkFBd0IsRUFBRSxJQUFJO2dCQUM5QixtQkFBbUIsRUFBRSxJQUFJO2FBQzFCLENBQUM7WUFDRixXQUFXLEVBQUUsNkJBQTZCLEtBQUssY0FBYztTQUM5RCxDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDMUMsYUFBYSxFQUFFLFdBQVcsS0FBSyxjQUFjO1lBQzdDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUMxQixjQUFjLEVBQUUsS0FBSyxLQUFLLE1BQU07b0JBQzlCLENBQUMsQ0FBQyxDQUFDLFdBQVcsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUNsQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSx1QkFBdUIsQ0FBQztnQkFDdEQsY0FBYyxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQztnQkFDM0QsY0FBYyxFQUFFLENBQUMsY0FBYyxFQUFFLGVBQWUsRUFBRSxrQkFBa0IsQ0FBQztnQkFDckUsTUFBTSxFQUFFLEtBQUssRUFBRSxXQUFXO2FBQzNCLENBQUM7WUFDRixXQUFXLEVBQUUsMEJBQTBCLEtBQUssY0FBYztTQUMzRCxDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTO1lBQ2pDLFdBQVcsRUFBRSxtQ0FBbUM7WUFDaEQsVUFBVSxFQUFFLGlCQUFpQixLQUFLLEVBQUU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRO1lBQ2hDLFdBQVcsRUFBRSxrQ0FBa0M7WUFDL0MsVUFBVSxFQUFFLG9CQUFvQixLQUFLLEVBQUU7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsV0FBVyxLQUFLLEdBQUc7WUFDMUIsV0FBVyxFQUFFLDJDQUEyQztZQUN4RCxVQUFVLEVBQUUscUJBQXFCLEtBQUssRUFBRTtTQUN6QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6TEQsc0NBeUxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpDb25maWdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFZqQ29uZmlnU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWakNvbmZpZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZyB9ID0gcHJvcHM7XG5cbiAgICAvLyBDb25maWd1cmF0aW9uIHRhYmxlIGZvciBydW50aW1lIHNldHRpbmdzXG4gICAgdGhpcy5jb25maWdUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29uZmlnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai1jb25maWctJHtzdGFnZX1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdjb25maWdLZXknLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IGNvbmZpZy5lbmFibGVCYWNrdXAsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyBhZnRlciBjcmVhdGlvblxuICAgIGNkay5UYWdzLm9mKHRoaXMuY29uZmlnVGFibGUpLmFkZCgnTmFtZScsIGBWSiBDb25maWcgVGFibGUgLSAke3N0YWdlfWApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuY29uZmlnVGFibGUpLmFkZCgnUHVycG9zZScsICdSdW50aW1lIGNvbmZpZ3VyYXRpb24gc3RvcmFnZScpO1xuXG4gICAgLy8gU1NNIFBhcmFtZXRlcnMgZm9yIGFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBhcHBDb25maWcgPSB7XG4gICAgICBzdGFnZSxcbiAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgZW5hYmxlQXV0aDogY29uZmlnLmVuYWJsZUF1dGgsXG4gICAgICBlbmFibGVDbG91ZEZyb250OiBjb25maWcuZW5hYmxlQ2xvdWRGcm9udCxcbiAgICAgIGZlYXR1cmVzOiB7XG4gICAgICAgIHdlYmdsMjogdHJ1ZSxcbiAgICAgICAgdm9pY2VSZWNvZ25pdGlvbjogdHJ1ZSxcbiAgICAgICAgbWlkaTogdHJ1ZSxcbiAgICAgICAgY2xvdWRTeW5jOiB0cnVlLFxuICAgICAgICBhbmFseXRpY3M6IHN0YWdlICE9PSAnZGV2JyxcbiAgICAgIH0sXG4gICAgICBwZXJmb3JtYW5jZToge1xuICAgICAgICB0YXJnZXRGUFM6IDYwLFxuICAgICAgICBtYXhQYXJ0aWNsZXM6IHN0YWdlID09PSAncHJvZCcgPyAyMDAwIDogMTAwMCxcbiAgICAgICAgYXVkaW9MYXRlbmN5VGFyZ2V0OiAyMCxcbiAgICAgICAgcmVuZGVyTGF0ZW5jeVRhcmdldDogMTYsXG4gICAgICB9LFxuICAgICAgbGltaXRzOiB7XG4gICAgICAgIG1heFByZXNldHM6IDEwMCxcbiAgICAgICAgbWF4SGlzdG9yeUl0ZW1zOiA1MCxcbiAgICAgICAgbWF4U2Vzc2lvbkR1cmF0aW9uOiAyNCAqIDYwICogNjAgKiAxMDAwLCAvLyAyNCBob3Vyc1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0FwcENvbmZpZycsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoYXBwQ29uZmlnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICAvLyBEYXRhYmFzZSBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0RhdGFiYXNlQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vZGF0YWJhc2UvY29uZmlnLXRhYmxlYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQ29uZmlndXJhdGlvbiB0YWJsZSBuYW1lIGZvciAke3N0YWdlfSBlbnZpcm9ubWVudGAsXG4gICAgfSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdXZWJTb2NrZXRDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS93ZWJzb2NrZXQvY29uZmlnYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHJlY29ubmVjdEludGVydmFsOiAzMDAwLFxuICAgICAgICBtYXhSZWNvbm5lY3RBdHRlbXB0czogNSxcbiAgICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IDMwMDAwLFxuICAgICAgICBjb25uZWN0aW9uVGltZW91dDogMTAwMDAsXG4gICAgICAgIG1heENvbm5lY3Rpb25zOiBzdGFnZSA9PT0gJ3Byb2QnID8gMTAwMCA6IDEwMCxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBXZWJTb2NrZXQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gQXVkaW8gcHJvY2Vzc2luZyBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0F1ZGlvQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vYXVkaW8vY29uZmlnYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHNhbXBsZVJhdGU6IDQ0MTAwLFxuICAgICAgICBmZnRTaXplOiAyMDQ4LFxuICAgICAgICBzbW9vdGhpbmdUaW1lQ29uc3RhbnQ6IDAuOCxcbiAgICAgICAgbWluRGVjaWJlbHM6IC0xMDAsXG4gICAgICAgIG1heERlY2liZWxzOiAtMzAsXG4gICAgICAgIGZyZXF1ZW5jeUJpbkNvdW50OiAxMDI0LFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogYEF1ZGlvIHByb2Nlc3NpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gVmlzdWFsIHJlbmRlcmluZyBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1Zpc3VhbENvbmZpZycsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L3Zpc3VhbC9jb25maWdgLFxuICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZGVmYXVsdENhbnZhc1dpZHRoOiAxOTIwLFxuICAgICAgICBkZWZhdWx0Q2FudmFzSGVpZ2h0OiAxMDgwLFxuICAgICAgICBtYXhDYW52YXNXaWR0aDogc3RhZ2UgPT09ICdwcm9kJyA/IDM4NDAgOiAxOTIwLFxuICAgICAgICBtYXhDYW52YXNIZWlnaHQ6IHN0YWdlID09PSAncHJvZCcgPyAyMTYwIDogMTA4MCxcbiAgICAgICAgZGVmYXVsdFBpeGVsUmF0aW86IDEsXG4gICAgICAgIG1heFBpeGVsUmF0aW86IHN0YWdlID09PSAncHJvZCcgPyAzIDogMixcbiAgICAgICAgbWF4UGFydGljbGVzOiBhcHBDb25maWcucGVyZm9ybWFuY2UubWF4UGFydGljbGVzLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogYFZpc3VhbCByZW5kZXJpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjcmV0cyBmb3Igc2Vuc2l0aXZlIGNvbmZpZ3VyYXRpb24gKG9ubHkgaWYgYXV0aCBpcyBlbmFibGVkKVxuICAgIGlmIChjb25maWcuZW5hYmxlQXV0aCkge1xuICAgICAgbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnSnd0U2VjcmV0Jywge1xuICAgICAgICBzZWNyZXROYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9hdXRoL2p3dC1zZWNyZXRgLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEpXVCBzaWduaW5nIHNlY3JldCBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IHB1cnBvc2U6ICdqd3Qtc2lnbmluZycgfSksXG4gICAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICdzZWNyZXQnLFxuICAgICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICAgIGluY2x1ZGVTcGFjZTogZmFsc2UsXG4gICAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDY0LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBzZWNyZXRzbWFuYWdlci5TZWNyZXQodGhpcywgJ0FwaUtleXMnLCB7XG4gICAgICAgIHNlY3JldE5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L2F1dGgvYXBpLWtleXNgLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEFQSSBrZXlzIGZvciBleHRlcm5hbCBzZXJ2aWNlcyAtICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgYXdzOiAnYXV0by1nZW5lcmF0ZWQnLFxuICAgICAgICAgICAgYW5hbHl0aWNzOiAnYXV0by1nZW5lcmF0ZWQnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAnbWFzdGVyLWtleScsXG4gICAgICAgICAgZXhjbHVkZUNoYXJhY3RlcnM6ICdcIkAvXFxcXCcsXG4gICAgICAgICAgaW5jbHVkZVNwYWNlOiBmYWxzZSxcbiAgICAgICAgICBwYXNzd29yZExlbmd0aDogMzIsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZFdhdGNoIGxvZyByZXRlbnRpb24gY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdMb2dDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9sb2dnaW5nL2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICByZXRlbnRpb25EYXlzOiBzdGFnZSA9PT0gJ3Byb2QnID8gMzAgOiA3LFxuICAgICAgICBlbmFibGVEZXRhaWxlZExvZ2dpbmc6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICAgIGxvZ0xldmVsOiBzdGFnZSA9PT0gJ3Byb2QnID8gJ0lORk8nIDogJ0RFQlVHJyxcbiAgICAgICAgZW5hYmxlUGVyZm9ybWFuY2VMb2dnaW5nOiB0cnVlLFxuICAgICAgICBlbmFibGVFcnJvclRyYWNraW5nOiB0cnVlLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogYExvZ2dpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gQ09SUyBjb25maWd1cmF0aW9uXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0NvcnNDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9jb3JzL2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBhbGxvd2VkT3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IFtgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWBdXG4gICAgICAgICAgOiBbJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDEnXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJywgJ1gtUmVxdWVzdGVkLVdpdGgnXSxcbiAgICAgICAgbWF4QWdlOiA4NjQwMCwgLy8gMjQgaG91cnNcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBDT1JTIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBpbXBvcnRhbnQgdmFsdWVzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbmZpZ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29uZmlndXJhdGlvbiBEeW5hbW9EQiB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWakNvbmZpZ1RhYmxlLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdUYWJsZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDb25maWd1cmF0aW9uIER5bmFtb0RCIHRhYmxlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgVmpDb25maWdUYWJsZUFybi0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGFyYW1ldGVyUHJlZml4Jywge1xuICAgICAgdmFsdWU6IGAvdmotYXBwLyR7c3RhZ2V9L2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NTTSBQYXJhbWV0ZXIgcHJlZml4IGZvciB0aGlzIGVudmlyb25tZW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalBhcmFtZXRlclByZWZpeC0ke3N0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=