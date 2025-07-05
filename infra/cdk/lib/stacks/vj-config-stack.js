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
            pointInTimeRecovery: config.enableBackup,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotY29uZmlnLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotY29uZmlnLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUNyRCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBYWpFLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLFdBQVcsQ0FBaUI7SUFFNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVoQywyQ0FBMkM7UUFDM0MsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN6RCxTQUFTLEVBQUUsYUFBYSxLQUFLLEVBQUU7WUFDL0IsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxZQUFZO1lBQ3hDLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3ZGLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsR0FB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aW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpDb25maWdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFZqQ29uZmlnU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWakNvbmZpZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZyB9ID0gcHJvcHM7XG5cbiAgICAvLyBDb25maWd1cmF0aW9uIHRhYmxlIGZvciBydW50aW1lIHNldHRpbmdzXG4gICAgdGhpcy5jb25maWdUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29uZmlnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai1jb25maWctJHtzdGFnZX1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdjb25maWdLZXknLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogY29uZmlnLmVuYWJsZUJhY2t1cCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRhZ3MgYWZ0ZXIgY3JlYXRpb25cbiAgICBjZGsuVGFncy5vZih0aGlzLmNvbmZpZ1RhYmxlKS5hZGQoJ05hbWUnLCBgVkogQ29uZmlnIFRhYmxlIC0gJHtzdGFnZX1gKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLmNvbmZpZ1RhYmxlKS5hZGQoJ1B1cnBvc2UnLCAnUnVudGltZSBjb25maWd1cmF0aW9uIHN0b3JhZ2UnKTtcblxuICAgIC8vIFNTTSBQYXJhbWV0ZXJzIGZvciBhcHBsaWNhdGlvbiBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgYXBwQ29uZmlnID0ge1xuICAgICAgc3RhZ2UsXG4gICAgICBkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgIGVuYWJsZUF1dGg6IGNvbmZpZy5lbmFibGVBdXRoLFxuICAgICAgZW5hYmxlQ2xvdWRGcm9udDogY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQsXG4gICAgICBmZWF0dXJlczoge1xuICAgICAgICB3ZWJnbDI6IHRydWUsXG4gICAgICAgIHZvaWNlUmVjb2duaXRpb246IHRydWUsXG4gICAgICAgIG1pZGk6IHRydWUsXG4gICAgICAgIGNsb3VkU3luYzogdHJ1ZSxcbiAgICAgICAgYW5hbHl0aWNzOiBzdGFnZSAhPT0gJ2RldicsXG4gICAgICB9LFxuICAgICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgICAgdGFyZ2V0RlBTOiA2MCxcbiAgICAgICAgbWF4UGFydGljbGVzOiBzdGFnZSA9PT0gJ3Byb2QnID8gMjAwMCA6IDEwMDAsXG4gICAgICAgIGF1ZGlvTGF0ZW5jeVRhcmdldDogMjAsXG4gICAgICAgIHJlbmRlckxhdGVuY3lUYXJnZXQ6IDE2LFxuICAgICAgfSxcbiAgICAgIGxpbWl0czoge1xuICAgICAgICBtYXhQcmVzZXRzOiAxMDAsXG4gICAgICAgIG1heEhpc3RvcnlJdGVtczogNTAsXG4gICAgICAgIG1heFNlc3Npb25EdXJhdGlvbjogMjQgKiA2MCAqIDYwICogMTAwMCwgLy8gMjQgaG91cnNcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdBcHBDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9jb25maWdgLFxuICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KGFwcENvbmZpZyksXG4gICAgICBkZXNjcmlwdGlvbjogYFZKIEFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLlNUQU5EQVJELFxuICAgIH0pO1xuXG4gICAgLy8gRGF0YWJhc2UgY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdEYXRhYmFzZUNvbmZpZycsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L2RhdGFiYXNlL2NvbmZpZy10YWJsZWAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy5jb25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYENvbmZpZ3VyYXRpb24gdGFibGUgbmFtZSBmb3IgJHtzdGFnZX0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IGNvbmZpZ3VyYXRpb25cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnV2ViU29ja2V0Q29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vd2Vic29ja2V0L2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICByZWNvbm5lY3RJbnRlcnZhbDogMzAwMCxcbiAgICAgICAgbWF4UmVjb25uZWN0QXR0ZW1wdHM6IDUsXG4gICAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAzMDAwMCxcbiAgICAgICAgY29ubmVjdGlvblRpbWVvdXQ6IDEwMDAwLFxuICAgICAgICBtYXhDb25uZWN0aW9uczogc3RhZ2UgPT09ICdwcm9kJyA/IDEwMDAgOiAxMDAsXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgV2ViU29ja2V0IGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIEF1ZGlvIHByb2Nlc3NpbmcgY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdBdWRpb0NvbmZpZycsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLyR7c3RhZ2V9L2F1ZGlvL2NvbmZpZ2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzYW1wbGVSYXRlOiA0NDEwMCxcbiAgICAgICAgZmZ0U2l6ZTogMjA0OCxcbiAgICAgICAgc21vb3RoaW5nVGltZUNvbnN0YW50OiAwLjgsXG4gICAgICAgIG1pbkRlY2liZWxzOiAtMTAwLFxuICAgICAgICBtYXhEZWNpYmVsczogLTMwLFxuICAgICAgICBmcmVxdWVuY3lCaW5Db3VudDogMTAyNCxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBBdWRpbyBwcm9jZXNzaW5nIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIFZpc3VhbCByZW5kZXJpbmcgY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdWaXN1YWxDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS92aXN1YWwvY29uZmlnYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGRlZmF1bHRDYW52YXNXaWR0aDogMTkyMCxcbiAgICAgICAgZGVmYXVsdENhbnZhc0hlaWdodDogMTA4MCxcbiAgICAgICAgbWF4Q2FudmFzV2lkdGg6IHN0YWdlID09PSAncHJvZCcgPyAzODQwIDogMTkyMCxcbiAgICAgICAgbWF4Q2FudmFzSGVpZ2h0OiBzdGFnZSA9PT0gJ3Byb2QnID8gMjE2MCA6IDEwODAsXG4gICAgICAgIGRlZmF1bHRQaXhlbFJhdGlvOiAxLFxuICAgICAgICBtYXhQaXhlbFJhdGlvOiBzdGFnZSA9PT0gJ3Byb2QnID8gMyA6IDIsXG4gICAgICAgIG1heFBhcnRpY2xlczogYXBwQ29uZmlnLnBlcmZvcm1hbmNlLm1heFBhcnRpY2xlcyxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBWaXN1YWwgcmVuZGVyaW5nIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIFNlY3JldHMgZm9yIHNlbnNpdGl2ZSBjb25maWd1cmF0aW9uIChvbmx5IGlmIGF1dGggaXMgZW5hYmxlZClcbiAgICBpZiAoY29uZmlnLmVuYWJsZUF1dGgpIHtcbiAgICAgIG5ldyBzZWNyZXRzbWFuYWdlci5TZWNyZXQodGhpcywgJ0p3dFNlY3JldCcsIHtcbiAgICAgICAgc2VjcmV0TmFtZTogYC92ai1hcHAvJHtzdGFnZX0vYXV0aC9qd3Qtc2VjcmV0YCxcbiAgICAgICAgZGVzY3JpcHRpb246IGBKV1Qgc2lnbmluZyBzZWNyZXQgZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyBwdXJwb3NlOiAnand0LXNpZ25pbmcnIH0pLFxuICAgICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAnc2VjcmV0JyxcbiAgICAgICAgICBleGNsdWRlQ2hhcmFjdGVyczogJ1wiQC9cXFxcJyxcbiAgICAgICAgICBpbmNsdWRlU3BhY2U6IGZhbHNlLFxuICAgICAgICAgIHBhc3N3b3JkTGVuZ3RoOiA2NCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdBcGlLZXlzJywge1xuICAgICAgICBzZWNyZXROYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9hdXRoL2FwaS1rZXlzYCxcbiAgICAgICAgZGVzY3JpcHRpb246IGBBUEkga2V5cyBmb3IgZXh0ZXJuYWwgc2VydmljZXMgLSAke3N0YWdlfSBlbnZpcm9ubWVudGAsXG4gICAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGF3czogJ2F1dG8tZ2VuZXJhdGVkJyxcbiAgICAgICAgICAgIGFuYWx5dGljczogJ2F1dG8tZ2VuZXJhdGVkJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ21hc3Rlci1rZXknLFxuICAgICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICAgIGluY2x1ZGVTcGFjZTogZmFsc2UsXG4gICAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDMyLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRXYXRjaCBsb2cgcmV0ZW50aW9uIGNvbmZpZ3VyYXRpb25cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnTG9nQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vbG9nZ2luZy9jb25maWdgLFxuICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcmV0ZW50aW9uRGF5czogc3RhZ2UgPT09ICdwcm9kJyA/IDMwIDogNyxcbiAgICAgICAgZW5hYmxlRGV0YWlsZWRMb2dnaW5nOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICBsb2dMZXZlbDogc3RhZ2UgPT09ICdwcm9kJyA/ICdJTkZPJyA6ICdERUJVRycsXG4gICAgICAgIGVuYWJsZVBlcmZvcm1hbmNlTG9nZ2luZzogdHJ1ZSxcbiAgICAgICAgZW5hYmxlRXJyb3JUcmFja2luZzogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246IGBMb2dnaW5nIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIENPUlMgY29uZmlndXJhdGlvblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdDb3JzQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vY29ycy9jb25maWdgLFxuICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IHN0YWdlID09PSAncHJvZCcgXG4gICAgICAgICAgPyBbYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gXVxuICAgICAgICAgIDogWydodHRwOi8vbG9jYWxob3N0OjMwMDAnLCAnaHR0cDovL2xvY2FsaG9zdDozMDAxJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbicsICdYLVJlcXVlc3RlZC1XaXRoJ10sXG4gICAgICAgIG1heEFnZTogODY0MDAsIC8vIDI0IGhvdXJzXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQ09SUyBjb25maWd1cmF0aW9uIGZvciAke3N0YWdlfSBlbnZpcm9ubWVudGAsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgaW1wb3J0YW50IHZhbHVlc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbmZpZ3VyYXRpb24gRHluYW1vREIgdGFibGUgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgVmpDb25maWdUYWJsZS0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29uZmlnVGFibGVBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb25maWdUYWJsZS50YWJsZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29uZmlndXJhdGlvbiBEeW5hbW9EQiB0YWJsZSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYFZqQ29uZmlnVGFibGVBcm4tJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BhcmFtZXRlclByZWZpeCcsIHtcbiAgICAgIHZhbHVlOiBgL3ZqLWFwcC8ke3N0YWdlfS9gLFxuICAgICAgZGVzY3JpcHRpb246ICdTU00gUGFyYW1ldGVyIHByZWZpeCBmb3IgdGhpcyBlbnZpcm9ubWVudCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpQYXJhbWV0ZXJQcmVmaXgtJHtzdGFnZX1gLFxuICAgIH0pO1xuICB9XG59Il19