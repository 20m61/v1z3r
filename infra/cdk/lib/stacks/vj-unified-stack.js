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
exports.VjUnifiedStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const path = __importStar(require("path"));
class VjUnifiedStack extends cdk.Stack {
    // DynamoDB Tables
    configTable;
    presetTable;
    sessionTable;
    // S3 Buckets
    presetBucket;
    backupBucket;
    siteBucket;
    // Lambda Functions
    presetFunction;
    connectionFunction;
    messageFunction;
    healthFunction;
    cleanupFunction;
    s3ProcessorFunction;
    metricsFunction;
    // API Gateway
    api;
    websocketApi;
    // CloudWatch
    logGroup;
    dashboard;
    // URLs
    apiUrl;
    websocketUrl;
    frontendUrl;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, enableAuth = false, enableCloudFront = false, enableBackup = false } = props;
        // =====================================
        // Configuration (SSM Parameters)
        // =====================================
        // Create SSM parameters for configuration
        const configParameters = {
            appConfig: new ssm.StringParameter(this, 'UnifiedAppConfig', {
                parameterName: `/vj-app-unified/${stage}/config`,
                stringValue: JSON.stringify({
                    apiUrl: 'placeholder',
                    websocketUrl: 'placeholder',
                    enableAuth: enableAuth,
                    enableCloudFront: enableCloudFront,
                    stage: stage
                }),
                description: `VJ Application unified configuration for ${stage}`,
            }),
            databaseConfig: new ssm.StringParameter(this, 'UnifiedDatabaseConfig', {
                parameterName: `/vj-app-unified/${stage}/database/config-table`,
                stringValue: 'placeholder',
                description: `Database unified configuration table name for ${stage}`,
            }),
            corsConfig: new ssm.StringParameter(this, 'UnifiedCorsConfig', {
                parameterName: `/vj-app-unified/${stage}/cors/config`,
                stringValue: JSON.stringify({
                    allowedOrigins: stage === 'prod' ? ['https://v1z3r.sc4pe.net'] : ['http://localhost:3000'],
                    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
                }),
                description: `CORS unified configuration for ${stage}`,
            }),
            loggingConfig: new ssm.StringParameter(this, 'UnifiedLoggingConfig', {
                parameterName: `/vj-app-unified/${stage}/logging/config`,
                stringValue: JSON.stringify({
                    logLevel: stage === 'prod' ? 'INFO' : 'DEBUG',
                    enableCloudWatch: true,
                    enableXRay: stage !== 'dev'
                }),
                description: `Logging unified configuration for ${stage}`,
            }),
            visualConfig: new ssm.StringParameter(this, 'UnifiedVisualConfig', {
                parameterName: `/vj-app-unified/${stage}/visual/config`,
                stringValue: JSON.stringify({
                    enableWebGPU: true,
                    enableAI: true,
                    enableMIDI: true,
                    performanceMode: stage === 'prod' ? 'balanced' : 'quality',
                    maxParticles: stage === 'prod' ? 50000 : 100000
                }),
                description: `Visual unified configuration for ${stage}`,
            }),
            audioConfig: new ssm.StringParameter(this, 'UnifiedAudioConfig', {
                parameterName: `/vj-app-unified/${stage}/audio/config`,
                stringValue: JSON.stringify({
                    sampleRate: 44100,
                    bufferSize: 2048,
                    enableAI: true,
                    enableBeatDetection: true
                }),
                description: `Audio unified configuration for ${stage}`,
            }),
            websocketConfig: new ssm.StringParameter(this, 'UnifiedWebSocketConfig', {
                parameterName: `/vj-app-unified/${stage}/websocket/config`,
                stringValue: JSON.stringify({
                    maxConnections: stage === 'prod' ? 1000 : 100,
                    enableCompression: true,
                    pingInterval: 30000
                }),
                description: `WebSocket unified configuration for ${stage}`,
            }),
        };
        // =====================================
        // Storage (DynamoDB & S3)
        // =====================================
        // DynamoDB Tables
        this.configTable = new dynamodb.Table(this, 'UnifiedConfigTable', {
            tableName: `vj-unified-config-${stage}`,
            partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: stage === 'prod',
            },
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });
        this.presetTable = new dynamodb.Table(this, 'UnifiedPresetTable', {
            tableName: `vj-unified-presets-${stage}`,
            partitionKey: { name: 'presetId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: stage === 'prod',
            },
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });
        this.sessionTable = new dynamodb.Table(this, 'UnifiedSessionTable', {
            tableName: `vj-unified-sessions-${stage}`,
            partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: stage === 'prod',
            },
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            timeToLiveAttribute: 'ttl',
        });
        // Add GSI for session queries
        this.sessionTable.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
        });
        // S3 Buckets
        this.presetBucket = new s3.Bucket(this, 'UnifiedPresetBucket', {
            bucketName: `vj-unified-presets-${stage}-${cdk.Stack.of(this).account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: stage !== 'prod',
            versioned: stage === 'prod',
            lifecycleRules: stage === 'prod' ? [
                {
                    id: 'DeleteIncompleteUploads',
                    enabled: true,
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
                {
                    id: 'TransitionToIA',
                    enabled: true,
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                },
            ] : [],
        });
        this.backupBucket = new s3.Bucket(this, 'UnifiedBackupBucket', {
            bucketName: `vj-unified-backups-${stage}-${cdk.Stack.of(this).account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: stage !== 'prod',
            versioned: true,
            lifecycleRules: [
                {
                    id: 'DeleteOldBackups',
                    enabled: true,
                    expiration: cdk.Duration.days(stage === 'prod' ? 90 : 30),
                },
            ],
        });
        this.siteBucket = new s3.Bucket(this, 'UnifiedSiteBucket', {
            bucketName: `vj-unified-frontend-${stage}-${cdk.Stack.of(this).account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            publicReadAccess: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: stage !== 'prod',
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: '404.html',
        });
        // =====================================
        // Lambda Functions
        // =====================================
        // Common Lambda layer
        const lambdaLayer = new lambda.LayerVersion(this, 'CommonLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-layers/shared')),
            compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
            description: 'Common utilities and dependencies',
        });
        // Lambda execution role
        const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
            inlinePolicies: {
                DynamoDBAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                'dynamodb:GetItem',
                                'dynamodb:PutItem',
                                'dynamodb:UpdateItem',
                                'dynamodb:DeleteItem',
                                'dynamodb:Query',
                                'dynamodb:Scan',
                                'dynamodb:BatchGetItem',
                                'dynamodb:BatchWriteItem',
                            ],
                            resources: [
                                this.configTable.tableArn,
                                this.presetTable.tableArn,
                                this.sessionTable.tableArn,
                                `${this.sessionTable.tableArn}/index/*`,
                            ],
                        }),
                    ],
                }),
                S3Access: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                's3:GetObject',
                                's3:PutObject',
                                's3:DeleteObject',
                                's3:GetObjectVersion',
                                's3:PutObjectAcl',
                            ],
                            resources: [
                                `${this.presetBucket.bucketArn}/*`,
                                `${this.backupBucket.bucketArn}/*`,
                            ],
                        }),
                    ],
                }),
                SSMAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                'ssm:GetParameter',
                                'ssm:GetParameters',
                                'ssm:GetParametersByPath',
                            ],
                            resources: [
                                `arn:aws:ssm:${this.region}:${this.account}:parameter/vj-app/${stage}/*`,
                            ],
                        }),
                    ],
                }),
            },
        });
        // Common Lambda environment variables
        const commonLambdaEnvironment = {
            STAGE: stage,
            CONFIG_TABLE: this.configTable.tableName,
            PRESET_TABLE: this.presetTable.tableName,
            SESSION_TABLE: this.sessionTable.tableName,
            PRESET_BUCKET: this.presetBucket.bucketName,
            BACKUP_BUCKET: this.backupBucket.bucketName,
            LOG_LEVEL: stage === 'prod' ? 'INFO' : 'DEBUG',
        };
        // Lambda functions
        this.presetFunction = new lambda.Function(this, 'PresetFunction', {
            functionName: `vj-preset-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'preset.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/preset')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        this.connectionFunction = new lambda.Function(this, 'ConnectionFunction', {
            functionName: `vj-connection-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'connection.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/websocket')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        this.messageFunction = new lambda.Function(this, 'MessageFunction', {
            functionName: `vj-message-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'message.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/websocket')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        this.healthFunction = new lambda.Function(this, 'HealthFunction', {
            functionName: `vj-health-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'health.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/websocket')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        this.cleanupFunction = new lambda.Function(this, 'CleanupFunction', {
            functionName: `vj-cleanup-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'cleanup.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/websocket')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.minutes(15),
            memorySize: 512,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        this.s3ProcessorFunction = new lambda.Function(this, 'S3ProcessorFunction', {
            functionName: `vj-s3-processor-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 's3-processor.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/websocket')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.minutes(5),
            memorySize: 1024,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        this.metricsFunction = new lambda.Function(this, 'MetricsFunction', {
            functionName: `vj-metrics-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'metrics.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/websocket')),
            layers: [lambdaLayer],
            role: lambdaRole,
            environment: commonLambdaEnvironment,
            timeout: cdk.Duration.minutes(5),
            memorySize: 256,
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        // =====================================
        // API Gateway
        // =====================================
        // REST API
        this.api = new apigateway.RestApi(this, 'VjApi', {
            restApiName: `vj-api-${stage}`,
            description: `VJ Application API - ${stage}`,
            defaultCorsPreflightOptions: {
                allowOrigins: stage === 'prod' ? ['https://v1z3r.sc4pe.net'] : ['http://localhost:3000'],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                allowCredentials: true,
            },
            deployOptions: {
                stageName: stage,
                throttlingBurstLimit: stage === 'prod' ? 2000 : 100,
                throttlingRateLimit: stage === 'prod' ? 1000 : 50,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: stage !== 'prod',
                metricsEnabled: true,
            },
        });
        // API Routes
        const healthResource = this.api.root.addResource('health');
        healthResource.addMethod('GET', new apigateway.LambdaIntegration(this.healthFunction));
        const presetsResource = this.api.root.addResource('presets');
        presetsResource.addMethod('GET', new apigateway.LambdaIntegration(this.presetFunction));
        presetsResource.addMethod('POST', new apigateway.LambdaIntegration(this.presetFunction));
        const presetResource = presetsResource.addResource('{presetId}');
        presetResource.addMethod('GET', new apigateway.LambdaIntegration(this.presetFunction));
        presetResource.addMethod('PUT', new apigateway.LambdaIntegration(this.presetFunction));
        presetResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.presetFunction));
        // WebSocket API (simplified for this example)
        this.websocketApi = this.api; // In real implementation, this would be a WebSocket API
        // =====================================
        // CloudWatch Monitoring
        // =====================================
        // CloudWatch Log Group
        this.logGroup = new logs.LogGroup(this, 'VjLogGroup', {
            logGroupName: `/aws/vj-app/${stage}`,
            retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // CloudWatch Dashboard
        this.dashboard = new cloudwatch.Dashboard(this, 'VjDashboard', {
            dashboardName: `vj-app-${stage}`,
            widgets: [
                [
                    new cloudwatch.GraphWidget({
                        title: 'API Gateway Requests',
                        left: [this.api.metricCount()],
                        width: 12,
                        height: 6,
                    }),
                    new cloudwatch.GraphWidget({
                        title: 'API Gateway Latency',
                        left: [this.api.metricLatency()],
                        width: 12,
                        height: 6,
                    }),
                ],
                [
                    new cloudwatch.GraphWidget({
                        title: 'Lambda Invocations',
                        left: [
                            this.presetFunction.metricInvocations(),
                            this.connectionFunction.metricInvocations(),
                            this.messageFunction.metricInvocations(),
                        ],
                        width: 12,
                        height: 6,
                    }),
                    new cloudwatch.GraphWidget({
                        title: 'Lambda Errors',
                        left: [
                            this.presetFunction.metricErrors(),
                            this.connectionFunction.metricErrors(),
                            this.messageFunction.metricErrors(),
                        ],
                        width: 12,
                        height: 6,
                    }),
                ],
                [
                    new cloudwatch.GraphWidget({
                        title: 'DynamoDB Read/Write Capacity',
                        left: [
                            this.configTable.metricConsumedReadCapacityUnits(),
                            this.presetTable.metricConsumedReadCapacityUnits(),
                            this.sessionTable.metricConsumedReadCapacityUnits(),
                        ],
                        right: [
                            this.configTable.metricConsumedWriteCapacityUnits(),
                            this.presetTable.metricConsumedWriteCapacityUnits(),
                            this.sessionTable.metricConsumedWriteCapacityUnits(),
                        ],
                        width: 24,
                        height: 6,
                    }),
                ],
            ],
        });
        // =====================================
        // Static Website Deployment
        // =====================================
        // Deploy static website (skip for now, will be handled by CI/CD)
        // if (stage !== 'dev') {
        //   new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        //     sources: [s3deploy.Source.asset('../../../out')],
        //     destinationBucket: this.siteBucket,
        //     prune: true,
        //     retainOnDelete: false,
        //   });
        // }
        // =====================================
        // Outputs
        // =====================================
        this.apiUrl = this.api.url;
        this.websocketUrl = this.api.url; // Would be different for WebSocket API
        this.frontendUrl = `https://${this.siteBucket.bucketWebsiteUrl}`;
        // Update SSM parameters with actual values
        new ssm.StringParameter(this, 'UpdatedAppConfig', {
            parameterName: `/vj-app/${stage}/config-updated`,
            stringValue: JSON.stringify({
                apiUrl: this.apiUrl,
                websocketUrl: this.websocketUrl,
                frontendUrl: this.frontendUrl,
                enableAuth: enableAuth,
                enableCloudFront: enableCloudFront,
                stage: stage
            }),
            description: `Updated VJ Application configuration for ${stage}`,
        });
        new ssm.StringParameter(this, 'UpdatedDatabaseConfig', {
            parameterName: `/vj-app/${stage}/database/config-table-updated`,
            stringValue: this.configTable.tableName,
            description: `Updated database configuration table name for ${stage}`,
        });
        // CloudFormation Outputs
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.apiUrl,
            description: 'API Gateway URL',
        });
        new cdk.CfnOutput(this, 'WebSocketUrl', {
            value: this.websocketUrl,
            description: 'WebSocket API URL',
        });
        new cdk.CfnOutput(this, 'FrontendUrl', {
            value: this.frontendUrl,
            description: 'Frontend URL',
        });
        new cdk.CfnOutput(this, 'ConfigTableName', {
            value: this.configTable.tableName,
            description: 'Configuration table name',
        });
        new cdk.CfnOutput(this, 'PresetTableName', {
            value: this.presetTable.tableName,
            description: 'Preset table name',
        });
        new cdk.CfnOutput(this, 'SessionTableName', {
            value: this.sessionTable.tableName,
            description: 'Session table name',
        });
        // =====================================
        // Cleanup and Monitoring
        // =====================================
        // Cleanup schedule
        const cleanupRule = new events.Rule(this, 'CleanupRule', {
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '2',
                day: '*',
                month: '*',
                year: '*',
            }),
        });
        cleanupRule.addTarget(new targets.LambdaFunction(this.cleanupFunction));
        // Metrics collection
        const metricsRule = new events.Rule(this, 'MetricsRule', {
            schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
        });
        metricsRule.addTarget(new targets.LambdaFunction(this.metricsFunction));
        // Tagging
        cdk.Tags.of(this).add('Project', 'VJ-Application');
        cdk.Tags.of(this).add('Stage', stage);
        cdk.Tags.of(this).add('Owner', 'vj-team');
        cdk.Tags.of(this).add('Architecture', 'Unified');
    }
}
exports.VjUnifiedStack = VjUnifiedStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotdW5pZmllZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLXVuaWZpZWQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsbUVBQXFEO0FBQ3JELHVEQUF5QztBQUN6QywrREFBaUQ7QUFDakQsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQywyREFBNkM7QUFDN0MsdUVBQXlEO0FBRXpELHlEQUEyQztBQUczQywrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELDJDQUE2QjtBQVU3QixNQUFhLGNBQWUsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMzQyxrQkFBa0I7SUFDRixXQUFXLENBQWlCO0lBQzVCLFdBQVcsQ0FBaUI7SUFDNUIsWUFBWSxDQUFpQjtJQUU3QyxhQUFhO0lBQ0csWUFBWSxDQUFZO0lBQ3hCLFlBQVksQ0FBWTtJQUN4QixVQUFVLENBQVk7SUFFdEMsbUJBQW1CO0lBQ0gsY0FBYyxDQUFrQjtJQUNoQyxrQkFBa0IsQ0FBa0I7SUFDcEMsZUFBZSxDQUFrQjtJQUNqQyxjQUFjLENBQWtCO0lBQ2hDLGVBQWUsQ0FBa0I7SUFDakMsbUJBQW1CLENBQWtCO0lBQ3JDLGVBQWUsQ0FBa0I7SUFFakQsY0FBYztJQUNFLEdBQUcsQ0FBcUI7SUFDeEIsWUFBWSxDQUFxQjtJQUVqRCxhQUFhO0lBQ0csUUFBUSxDQUFnQjtJQUN4QixTQUFTLENBQXVCO0lBRWhELE9BQU87SUFDUyxNQUFNLENBQVM7SUFDZixZQUFZLENBQVM7SUFDckIsV0FBVyxDQUFTO0lBRXBDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxVQUFVLEdBQUcsS0FBSyxFQUFFLGdCQUFnQixHQUFHLEtBQUssRUFBRSxZQUFZLEdBQUcs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QUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3RDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDMUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNuRCxDQUFDO0NBQ0Y7QUFybUJELHdDQXFtQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNxcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3FzJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpVbmlmaWVkU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgZW5hYmxlQXV0aD86IGJvb2xlYW47XG4gIGVuYWJsZUNsb3VkRnJvbnQ/OiBib29sZWFuO1xuICBlbmFibGVCYWNrdXA/OiBib29sZWFuO1xuICBkb21haW5OYW1lPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVmpVbmlmaWVkU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgcHVibGljIHJlYWRvbmx5IGNvbmZpZ1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHNlc3Npb25UYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIFxuICAvLyBTMyBCdWNrZXRzXG4gIHB1YmxpYyByZWFkb25seSBwcmVzZXRCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGJhY2t1cEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgc2l0ZUJ1Y2tldDogczMuQnVja2V0O1xuICBcbiAgLy8gTGFtYmRhIEZ1bmN0aW9uc1xuICBwdWJsaWMgcmVhZG9ubHkgcHJlc2V0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGNvbm5lY3Rpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBoZWFsdGhGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgY2xlYW51cEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzM1Byb2Nlc3NvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBtZXRyaWNzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8vIEFQSSBHYXRld2F5XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldEFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBcbiAgLy8gQ2xvdWRXYXRjaFxuICBwdWJsaWMgcmVhZG9ubHkgbG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXA7XG4gIHB1YmxpYyByZWFkb25seSBkYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBcbiAgLy8gVVJMc1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpVXJsOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRVcmw6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGZyb250ZW5kVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqVW5pZmllZFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGVuYWJsZUF1dGggPSBmYWxzZSwgZW5hYmxlQ2xvdWRGcm9udCA9IGZhbHNlLCBlbmFibGVCYWNrdXAgPSBmYWxzZSB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ29uZmlndXJhdGlvbiAoU1NNIFBhcmFtZXRlcnMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIENyZWF0ZSBTU00gcGFyYW1ldGVycyBmb3IgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGNvbmZpZ1BhcmFtZXRlcnMgPSB7XG4gICAgICBhcHBDb25maWc6IG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdVbmlmaWVkQXBwQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2NvbmZpZ2AsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYXBpVXJsOiAncGxhY2Vob2xkZXInLFxuICAgICAgICAgIHdlYnNvY2tldFVybDogJ3BsYWNlaG9sZGVyJyxcbiAgICAgICAgICBlbmFibGVBdXRoOiBlbmFibGVBdXRoLFxuICAgICAgICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGVuYWJsZUNsb3VkRnJvbnQsXG4gICAgICAgICAgc3RhZ2U6IHN0YWdlXG4gICAgICAgIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFZKIEFwcGxpY2F0aW9uIHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgICBcbiAgICAgIGRhdGFiYXNlQ29uZmlnOiBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVW5pZmllZERhdGFiYXNlQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2RhdGFiYXNlL2NvbmZpZy10YWJsZWAsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiAncGxhY2Vob2xkZXInLFxuICAgICAgICBkZXNjcmlwdGlvbjogYERhdGFiYXNlIHVuaWZpZWQgY29uZmlndXJhdGlvbiB0YWJsZSBuYW1lIGZvciAke3N0YWdlfWAsXG4gICAgICB9KSxcbiAgICAgIFxuICAgICAgY29yc0NvbmZpZzogbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VuaWZpZWRDb3JzQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2NvcnMvY29uZmlnYCxcbiAgICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyA/IFsnaHR0cHM6Ly92MXozci5zYzRwZS5uZXQnXSA6IFsnaHR0cDovL2xvY2FsaG9zdDozMDAwJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1SZXF1ZXN0ZWQtV2l0aCddXG4gICAgICAgIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogYENPUlMgdW5pZmllZCBjb25maWd1cmF0aW9uIGZvciAke3N0YWdlfWAsXG4gICAgICB9KSxcbiAgICAgIFxuICAgICAgbG9nZ2luZ0NvbmZpZzogbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VuaWZpZWRMb2dnaW5nQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2xvZ2dpbmcvY29uZmlnYCxcbiAgICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBsb2dMZXZlbDogc3RhZ2UgPT09ICdwcm9kJyA/ICdJTkZPJyA6ICdERUJVRycsXG4gICAgICAgICAgZW5hYmxlQ2xvdWRXYXRjaDogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVYUmF5OiBzdGFnZSAhPT0gJ2RldidcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgTG9nZ2luZyB1bmlmaWVkIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9YCxcbiAgICAgIH0pLFxuICAgICAgXG4gICAgICB2aXN1YWxDb25maWc6IG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdVbmlmaWVkVmlzdWFsQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L3Zpc3VhbC9jb25maWdgLFxuICAgICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVuYWJsZVdlYkdQVTogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVNSURJOiB0cnVlLFxuICAgICAgICAgIHBlcmZvcm1hbmNlTW9kZTogc3RhZ2UgPT09ICdwcm9kJyA/ICdiYWxhbmNlZCcgOiAncXVhbGl0eScsXG4gICAgICAgICAgbWF4UGFydGljbGVzOiBzdGFnZSA9PT0gJ3Byb2QnID8gNTAwMDAgOiAxMDAwMDBcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgVmlzdWFsIHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgICBcbiAgICAgIGF1ZGlvQ29uZmlnOiBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVW5pZmllZEF1ZGlvQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2F1ZGlvL2NvbmZpZ2AsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2FtcGxlUmF0ZTogNDQxMDAsXG4gICAgICAgICAgYnVmZmVyU2l6ZTogMjA0OCxcbiAgICAgICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVCZWF0RGV0ZWN0aW9uOiB0cnVlXG4gICAgICAgIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEF1ZGlvIHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgICBcbiAgICAgIHdlYnNvY2tldENvbmZpZzogbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VuaWZpZWRXZWJTb2NrZXRDb25maWcnLCB7XG4gICAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLXVuaWZpZWQvJHtzdGFnZX0vd2Vic29ja2V0L2NvbmZpZ2AsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbWF4Q29ubmVjdGlvbnM6IHN0YWdlID09PSAncHJvZCcgPyAxMDAwIDogMTAwLFxuICAgICAgICAgIGVuYWJsZUNvbXByZXNzaW9uOiB0cnVlLFxuICAgICAgICAgIHBpbmdJbnRlcnZhbDogMzAwMDBcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgV2ViU29ja2V0IHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgfTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTdG9yYWdlIChEeW5hbW9EQiAmIFMzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBcbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICB0aGlzLmNvbmZpZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVbmlmaWVkQ29uZmlnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai11bmlmaWVkLWNvbmZpZy0ke3N0YWdlfWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2tleScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG4gICAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlFbmFibGVkOiBzdGFnZSA9PT0gJ3Byb2QnLFxuICAgICAgfSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgfSk7XG5cbiAgICB0aGlzLnByZXNldFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVbmlmaWVkUHJlc2V0VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai11bmlmaWVkLXByZXNldHMtJHtzdGFnZX1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwcmVzZXRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd2ZXJzaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogc3RhZ2UgPT09ICdwcm9kJyxcbiAgICAgIH0sXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHN0cmVhbTogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0FORF9PTERfSU1BR0VTLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zZXNzaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VuaWZpZWRTZXNzaW9uVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai11bmlmaWVkLXNlc3Npb25zLSR7c3RhZ2V9YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2Vzc2lvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHN0YWdlID09PSAncHJvZCcsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc2Vzc2lvbiBxdWVyaWVzXG4gICAgdGhpcy5zZXNzaW9uVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVXNlcklkSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldHNcbiAgICB0aGlzLnByZXNldEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VuaWZpZWRQcmVzZXRCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgdmotdW5pZmllZC1wcmVzZXRzLSR7c3RhZ2V9LSR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgdmVyc2lvbmVkOiBzdGFnZSA9PT0gJ3Byb2QnLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IHN0YWdlID09PSAncHJvZCcgPyBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVVcGxvYWRzJyxcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvSUEnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSA6IFtdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5iYWNrdXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVbmlmaWVkQmFja3VwQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLXVuaWZpZWQtYmFja3Vwcy0ke3N0YWdlfS0ke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZEJhY2t1cHMnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoc3RhZ2UgPT09ICdwcm9kJyA/IDkwIDogMzApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMuc2l0ZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VuaWZpZWRTaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLXVuaWZpZWQtZnJvbnRlbmQtJHtzdGFnZX0tJHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BQ0xTLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJzQwNC5odG1sJyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIENvbW1vbiBMYW1iZGEgbGF5ZXJcbiAgICBjb25zdCBsYW1iZGFMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhLWxheWVycy9zaGFyZWQnKSksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWF0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiB1dGlsaXRpZXMgYW5kIGRlcGVuZGVuY2llcycsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZXhlY3V0aW9uIHJvbGVcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMYW1iZGFFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgRHluYW1vREJBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW0nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIHRoaXMucHJlc2V0VGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy5zZXNzaW9uVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgYCR7dGhpcy5zZXNzaW9uVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0VmVyc2lvbicsXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdEFjbCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGAke3RoaXMucHJlc2V0QnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgYCR7dGhpcy5iYWNrdXBCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICBTU01BY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyc0J5UGF0aCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGBhcm46YXdzOnNzbToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyL3ZqLWFwcC8ke3N0YWdlfS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENvbW1vbiBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgY29uc3QgY29tbW9uTGFtYmRhRW52aXJvbm1lbnQgPSB7XG4gICAgICBTVEFHRTogc3RhZ2UsXG4gICAgICBDT05GSUdfVEFCTEU6IHRoaXMuY29uZmlnVGFibGUudGFibGVOYW1lLFxuICAgICAgUFJFU0VUX1RBQkxFOiB0aGlzLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFNFU1NJT05fVEFCTEU6IHRoaXMuc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFBSRVNFVF9CVUNLRVQ6IHRoaXMucHJlc2V0QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBCQUNLVVBfQlVDS0VUOiB0aGlzLmJhY2t1cEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgTE9HX0xFVkVMOiBzdGFnZSA9PT0gJ3Byb2QnID8gJ0lORk8nIDogJ0RFQlVHJyxcbiAgICB9O1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uc1xuICAgIHRoaXMucHJlc2V0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcmVzZXRGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYHZqLXByZXNldC0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdwcmVzZXQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2xhbWJkYS9wcmVzZXQnKSksXG4gICAgICBsYXllcnM6IFtsYW1iZGFMYXllcl0sXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkxhbWJkYUVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbm5lY3Rpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Nvbm5lY3Rpb25GdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYHZqLWNvbm5lY3Rpb24tJHtzdGFnZX1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnY29ubmVjdGlvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhL3dlYnNvY2tldCcpKSxcbiAgICAgIGxheWVyczogW2xhbWJkYUxheWVyXSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uTGFtYmRhRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIHRoaXMubWVzc2FnZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWVzc2FnZUZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgdmotbWVzc2FnZS0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdtZXNzYWdlLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9sYW1iZGEvd2Vic29ja2V0JykpLFxuICAgICAgbGF5ZXJzOiBbbGFtYmRhTGF5ZXJdLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25MYW1iZGFFbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgdGhpcy5oZWFsdGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0hlYWx0aEZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgdmotaGVhbHRoLSR7c3RhZ2V9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2hlYWx0aC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhL3dlYnNvY2tldCcpKSxcbiAgICAgIGxheWVyczogW2xhbWJkYUxheWVyXSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uTGFtYmRhRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIHRoaXMuY2xlYW51cEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ2xlYW51cEZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgdmotY2xlYW51cC0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjbGVhbnVwLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9sYW1iZGEvd2Vic29ja2V0JykpLFxuICAgICAgbGF5ZXJzOiBbbGFtYmRhTGF5ZXJdLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25MYW1iZGFFbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zM1Byb2Nlc3NvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUzNQcm9jZXNzb3JGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYHZqLXMzLXByb2Nlc3Nvci0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzMy1wcm9jZXNzb3IuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2xhbWJkYS93ZWJzb2NrZXQnKSksXG4gICAgICBsYXllcnM6IFtsYW1iZGFMYXllcl0sXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkxhbWJkYUVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICB0aGlzLm1ldHJpY3NGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01ldHJpY3NGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYHZqLW1ldHJpY3MtJHtzdGFnZX1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnbWV0cmljcy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhL3dlYnNvY2tldCcpKSxcbiAgICAgIGxheWVyczogW2xhbWJkYUxheWVyXSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uTGFtYmRhRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIFJFU1QgQVBJXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdWakFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVkogQXBwbGljYXRpb24gQVBJIC0gJHtzdGFnZX1gLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyA/IFsnaHR0cHM6Ly92MXozci5zYzRwZS5uZXQnXSA6IFsnaHR0cDovL2xvY2FsaG9zdDozMDAwJ10sXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJywgJ1gtUmVxdWVzdGVkLVdpdGgnXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiBzdGFnZSA9PT0gJ3Byb2QnID8gMjAwMCA6IDEwMCxcbiAgICAgICAgdGhyb3R0bGluZ1JhdGVMaW1pdDogc3RhZ2UgPT09ICdwcm9kJyA/IDEwMDAgOiA1MCxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgUm91dGVzXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuaGVhbHRoRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHByZXNldHNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3ByZXNldHMnKTtcbiAgICBwcmVzZXRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSk7XG4gICAgcHJlc2V0c1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucHJlc2V0RnVuY3Rpb24pKTtcbiAgICBcbiAgICBjb25zdCBwcmVzZXRSZXNvdXJjZSA9IHByZXNldHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3ByZXNldElkfScpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbikpO1xuICAgIHByZXNldFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbikpO1xuXG4gICAgLy8gV2ViU29ja2V0IEFQSSAoc2ltcGxpZmllZCBmb3IgdGhpcyBleGFtcGxlKVxuICAgIHRoaXMud2Vic29ja2V0QXBpID0gdGhpcy5hcGk7IC8vIEluIHJlYWwgaW1wbGVtZW50YXRpb24sIHRoaXMgd291bGQgYmUgYSBXZWJTb2NrZXQgQVBJXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xvdWRXYXRjaCBNb25pdG9yaW5nXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIENsb3VkV2F0Y2ggTG9nIEdyb3VwXG4gICAgdGhpcy5sb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdWakxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy92ai1hcHAvJHtzdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uOiBzdGFnZSA9PT0gJ3Byb2QnID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIERhc2hib2FyZFxuICAgIHRoaXMuZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdWakRhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGB2ai1hcHAtJHtzdGFnZX1gLFxuICAgICAgd2lkZ2V0czogW1xuICAgICAgICBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSBSZXF1ZXN0cycsXG4gICAgICAgICAgICBsZWZ0OiBbdGhpcy5hcGkubWV0cmljQ291bnQoKV0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSBMYXRlbmN5JyxcbiAgICAgICAgICAgIGxlZnQ6IFt0aGlzLmFwaS5tZXRyaWNMYXRlbmN5KCldLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdMYW1iZGEgSW52b2NhdGlvbnMnLFxuICAgICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgICB0aGlzLnByZXNldEZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKCksXG4gICAgICAgICAgICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKCksXG4gICAgICAgICAgICAgIHRoaXMubWVzc2FnZUZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKCksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTGFtYmRhIEVycm9ycycsXG4gICAgICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgICAgIHRoaXMucHJlc2V0RnVuY3Rpb24ubWV0cmljRXJyb3JzKCksXG4gICAgICAgICAgICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpLFxuICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2VGdW5jdGlvbi5tZXRyaWNFcnJvcnMoKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0R5bmFtb0RCIFJlYWQvV3JpdGUgQ2FwYWNpdHknLFxuICAgICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgICB0aGlzLmNvbmZpZ1RhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgICAgdGhpcy5wcmVzZXRUYWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKCksXG4gICAgICAgICAgICAgIHRoaXMuc2Vzc2lvblRhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByaWdodDogW1xuICAgICAgICAgICAgICB0aGlzLmNvbmZpZ1RhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKCksXG4gICAgICAgICAgICAgIHRoaXMucHJlc2V0VGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgICAgdGhpcy5zZXNzaW9uVGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFN0YXRpYyBXZWJzaXRlIERlcGxveW1lbnRcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgXG4gICAgLy8gRGVwbG95IHN0YXRpYyB3ZWJzaXRlIChza2lwIGZvciBub3csIHdpbGwgYmUgaGFuZGxlZCBieSBDSS9DRClcbiAgICAvLyBpZiAoc3RhZ2UgIT09ICdkZXYnKSB7XG4gICAgLy8gICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnRGVwbG95V2Vic2l0ZScsIHtcbiAgICAvLyAgICAgc291cmNlczogW3MzZGVwbG95LlNvdXJjZS5hc3NldCgnLi4vLi4vLi4vb3V0JyldLFxuICAgIC8vICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogdGhpcy5zaXRlQnVja2V0LFxuICAgIC8vICAgICBwcnVuZTogdHJ1ZSxcbiAgICAvLyAgICAgcmV0YWluT25EZWxldGU6IGZhbHNlLFxuICAgIC8vICAgfSk7XG4gICAgLy8gfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgXG4gICAgdGhpcy5hcGlVcmwgPSB0aGlzLmFwaS51cmw7XG4gICAgdGhpcy53ZWJzb2NrZXRVcmwgPSB0aGlzLmFwaS51cmw7IC8vIFdvdWxkIGJlIGRpZmZlcmVudCBmb3IgV2ViU29ja2V0IEFQSVxuICAgIHRoaXMuZnJvbnRlbmRVcmwgPSBgaHR0cHM6Ly8ke3RoaXMuc2l0ZUJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsfWA7XG5cbiAgICAvLyBVcGRhdGUgU1NNIHBhcmFtZXRlcnMgd2l0aCBhY3R1YWwgdmFsdWVzXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VwZGF0ZWRBcHBDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9jb25maWctdXBkYXRlZGAsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBhcGlVcmw6IHRoaXMuYXBpVXJsLFxuICAgICAgICB3ZWJzb2NrZXRVcmw6IHRoaXMud2Vic29ja2V0VXJsLFxuICAgICAgICBmcm9udGVuZFVybDogdGhpcy5mcm9udGVuZFVybCxcbiAgICAgICAgZW5hYmxlQXV0aDogZW5hYmxlQXV0aCxcbiAgICAgICAgZW5hYmxlQ2xvdWRGcm9udDogZW5hYmxlQ2xvdWRGcm9udCxcbiAgICAgICAgc3RhZ2U6IHN0YWdlXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVXBkYXRlZCBWSiBBcHBsaWNhdGlvbiBjb25maWd1cmF0aW9uIGZvciAke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVXBkYXRlZERhdGFiYXNlQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vZGF0YWJhc2UvY29uZmlnLXRhYmxlLXVwZGF0ZWRgLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuY29uZmlnVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBVcGRhdGVkIGRhdGFiYXNlIGNvbmZpZ3VyYXRpb24gdGFibGUgbmFtZSBmb3IgJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0VXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMud2Vic29ja2V0VXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgQVBJIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mcm9udGVuZFVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRnJvbnRlbmQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbmZpZ3VyYXRpb24gdGFibGUgbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJlc2V0VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmVzZXQgdGFibGUgbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2Vzc2lvblRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Nlc3Npb24gdGFibGUgbmFtZScsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xlYW51cCBhbmQgTW9uaXRvcmluZ1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBcbiAgICAvLyBDbGVhbnVwIHNjaGVkdWxlXG4gICAgY29uc3QgY2xlYW51cFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0NsZWFudXBSdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICcyJyxcbiAgICAgICAgZGF5OiAnKicsXG4gICAgICAgIG1vbnRoOiAnKicsXG4gICAgICAgIHllYXI6ICcqJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuICAgIFxuICAgIGNsZWFudXBSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmNsZWFudXBGdW5jdGlvbikpO1xuXG4gICAgLy8gTWV0cmljcyBjb2xsZWN0aW9uXG4gICAgY29uc3QgbWV0cmljc1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ01ldHJpY3NSdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKGNkay5EdXJhdGlvbi5taW51dGVzKDUpKSxcbiAgICB9KTtcbiAgICBcbiAgICBtZXRyaWNzUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5tZXRyaWNzRnVuY3Rpb24pKTtcblxuICAgIC8vIFRhZ2dpbmdcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnVkotQXBwbGljYXRpb24nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWdlJywgc3RhZ2UpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnT3duZXInLCAndmotdGVhbScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXJjaGl0ZWN0dXJlJywgJ1VuaWZpZWQnKTtcbiAgfVxufSJdfQ==