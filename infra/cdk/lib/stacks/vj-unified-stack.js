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
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const path = __importStar(require("path"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
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
    // CloudFront
    distribution;
    certificate;
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
            handler: 'index.handler',
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
        // CloudFront Distribution
        // =====================================
        // SSL Certificate
        if (enableCloudFront) {
            if (stage === 'prod') {
                // Production certificate for v1z3r.sc4pe.net
                this.certificate = acm.Certificate.fromCertificateArn(this, 'SslCertificate', 'arn:aws:acm:us-east-1:822063948773:certificate/40d2858d-424d-4402-bfa7-afcd432310ca');
            }
            else if (stage === 'dev') {
                // Development certificate for v1z3r-dev.sc4pe.net
                this.certificate = acm.Certificate.fromCertificateArn(this, 'SslCertificate', 'arn:aws:acm:us-east-1:822063948773:certificate/89b8fe7e-f20a-45df-b848-4b8d1d9d6140');
            }
        }
        // CloudFront Distribution
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.siteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress: true,
            },
            additionalBehaviors: {
                '/api/*': {
                    origin: new origins.RestApiOrigin(this.api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
                },
            },
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
            defaultRootObject: 'index.html',
            domainNames: enableCloudFront ?
                (stage === 'prod' ? ['v1z3r.sc4pe.net'] :
                    stage === 'dev' ? ['v1z3r-dev.sc4pe.net'] : undefined) : undefined,
            certificate: this.certificate,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            comment: `VJ Application CloudFront Distribution - ${stage}`,
        });
        // =====================================
        // Outputs
        // =====================================
        this.apiUrl = this.api.url;
        this.websocketUrl = this.api.url; // Would be different for WebSocket API
        this.frontendUrl = `https://${this.distribution.distributionDomainName}`;
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
        new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
            value: this.distribution.distributionId,
            description: 'CloudFront Distribution ID',
        });
        new cdk.CfnOutput(this, 'CloudFrontDistributionDomainName', {
            value: this.distribution.distributionDomainName,
            description: 'CloudFront Distribution Domain Name',
        });
        // =====================================
        // CloudWatch Alarms and Monitoring
        // =====================================
        // Create SNS topic for alerts
        const alertTopic = new sns.Topic(this, 'AlertTopic', {
            topicName: `vj-app-alerts-${stage}`,
            displayName: `VJ Application Alerts - ${stage}`,
        });
        // API Gateway Alarms
        const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
            metric: this.api.metricServerError({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 10,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'API Gateway server errors',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        apiErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
            metric: this.api.metricLatency({
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
            }),
            threshold: 5000,
            evaluationPeriods: 3,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'API Gateway high latency',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        apiLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // Lambda Function Alarms
        const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
            metric: new cloudwatch.MathExpression({
                expression: 'e1 + e2 + e3 + e4',
                usingMetrics: {
                    e1: this.presetFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
                    e2: this.connectionFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
                    e3: this.messageFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
                    e4: this.healthFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
                },
            }),
            threshold: 5,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'Lambda function errors',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        lambdaErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // DynamoDB Alarms
        const dynamoDbThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDbThrottleAlarm', {
            metric: new cloudwatch.MathExpression({
                expression: 't1 + t2 + t3',
                usingMetrics: {
                    t1: this.configTable.metricThrottledRequests({ period: cdk.Duration.minutes(5) }),
                    t2: this.presetTable.metricThrottledRequests({ period: cdk.Duration.minutes(5) }),
                    t3: this.sessionTable.metricThrottledRequests({ period: cdk.Duration.minutes(5) }),
                },
            }),
            threshold: 1,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'DynamoDB throttling detected',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        dynamoDbThrottleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // CloudFront Alarms
        const cloudfrontErrorAlarm = new cloudwatch.Alarm(this, 'CloudFrontErrorAlarm', {
            metric: this.distribution.metric4xxErrorRate({
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
            }),
            threshold: 5,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'CloudFront high error rate',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        cloudfrontErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // Custom Metrics Dashboard
        const customDashboard = new cloudwatch.Dashboard(this, 'CustomDashboard', {
            dashboardName: `vj-app-custom-${stage}`,
            widgets: [
                [
                    new cloudwatch.GraphWidget({
                        title: 'Application Health Overview',
                        left: [
                            this.api.metricCount({ label: 'API Requests' }),
                            this.api.metricServerError({ label: 'API Errors' }),
                        ],
                        right: [
                            this.api.metricLatency({ label: 'API Latency' }),
                        ],
                        width: 12,
                        height: 6,
                    }),
                    new cloudwatch.GraphWidget({
                        title: 'CloudFront Performance',
                        left: [
                            this.distribution.metricRequests({ label: 'CloudFront Requests' }),
                            this.distribution.metricBytesDownloaded({ label: 'Bytes Downloaded' }),
                        ],
                        right: [
                            this.distribution.metric4xxErrorRate({ label: 'Error Rate' }),
                        ],
                        width: 12,
                        height: 6,
                    }),
                ],
                [
                    new cloudwatch.SingleValueWidget({
                        title: 'Current Active Sessions',
                        metrics: [
                            this.sessionTable.metricConsumedReadCapacityUnits({ label: 'Session Reads' }),
                        ],
                        width: 6,
                        height: 6,
                    }),
                    new cloudwatch.SingleValueWidget({
                        title: 'Total Presets',
                        metrics: [
                            this.presetTable.metricConsumedWriteCapacityUnits({ label: 'Preset Writes' }),
                        ],
                        width: 6,
                        height: 6,
                    }),
                    new cloudwatch.SingleValueWidget({
                        title: 'Lambda Invocations',
                        metrics: [
                            this.presetFunction.metricInvocations({ label: 'Preset Function' }),
                            this.connectionFunction.metricInvocations({ label: 'Connection Function' }),
                        ],
                        width: 6,
                        height: 6,
                    }),
                    new cloudwatch.SingleValueWidget({
                        title: 'System Health',
                        metrics: [
                            this.healthFunction.metricInvocations({ label: 'Health Checks' }),
                        ],
                        width: 6,
                        height: 6,
                    }),
                ],
            ],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotdW5pZmllZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLXVuaWZpZWQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsbUVBQXFEO0FBQ3JELHVEQUF5QztBQUN6QywrREFBaUQ7QUFDakQsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQywyREFBNkM7QUFDN0MsdUVBQXlEO0FBRXpELHlEQUEyQztBQUMzQyx5REFBMkM7QUFFM0MsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCwyQ0FBNkI7QUFDN0IsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCx3RUFBMEQ7QUFDMUQsdUZBQXlFO0FBVXpFLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNDLGtCQUFrQjtJQUNGLFdBQVcsQ0FBaUI7SUFDNUIsV0FBVyxDQUFpQjtJQUM1QixZQUFZLENBQWlCO0lBRTdDLGFBQWE7SUFDRyxZQUFZLENBQVk7SUFDeEIsWUFBWSxDQUFZO0lBQ3hCLFVBQVUsQ0FBWTtJQUV0QyxtQkFBbUI7SUFDSCxjQUFjLENBQWtCO0lBQ2hDLGtCQUFrQixDQUFrQjtJQUNwQyxlQUFlLENBQWtCO0lBQ2pDLGNBQWMsQ0FBa0I7SUFDaEMsZUFBZSxDQUFrQjtJQUNqQyxtQkFBbUIsQ0FBa0I7SUFDckMsZUFBZSxDQUFrQjtJQUVqRCxjQUFjO0lBQ0UsR0FBRyxDQUFxQjtJQUN4QixZQUFZLENBQXFCO0lBRWpELGFBQWE7SUFDRyxRQUFRLENBQWdCO0lBQ3hCLFNBQVMsQ0FBdUI7SUFFaEQsYUFBYTtJQUNHLFlBQVksQ0FBMEI7SUFDdEMsV0FBVyxDQUFvQjtJQUUvQyxPQUFPO0lBQ1MsTUFBTSxDQUFTO0lBQ2YsWUFBWSxDQUFTO0lBQ3JCLFdBQVcsQ0FBUztJQUVwQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFL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Yic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcblxuZXhwb3J0IGludGVyZmFjZSBWalVuaWZpZWRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBlbmFibGVBdXRoPzogYm9vbGVhbjtcbiAgZW5hYmxlQ2xvdWRGcm9udD86IGJvb2xlYW47XG4gIGVuYWJsZUJhY2t1cD86IGJvb2xlYW47XG4gIGRvbWFpbk5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBWalVuaWZpZWRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIER5bmFtb0RCIFRhYmxlc1xuICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgcHJlc2V0VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgc2Vzc2lvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgXG4gIC8vIFMzIEJ1Y2tldHNcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYmFja3VwQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBzaXRlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIFxuICAvLyBMYW1iZGEgRnVuY3Rpb25zXG4gIHB1YmxpYyByZWFkb25seSBwcmVzZXRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgY29ubmVjdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBtZXNzYWdlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGhlYWx0aEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBjbGVhbnVwRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHMzUHJvY2Vzc29yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG1ldHJpY3NGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBcbiAgLy8gQVBJIEdhdGV3YXlcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0QXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIFxuICAvLyBDbG91ZFdhdGNoXG4gIHB1YmxpYyByZWFkb25seSBsb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcbiAgcHVibGljIHJlYWRvbmx5IGRhc2hib2FyZDogY2xvdWR3YXRjaC5EYXNoYm9hcmQ7XG4gIFxuICAvLyBDbG91ZEZyb250XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgY2VydGlmaWNhdGU/OiBhY20uSUNlcnRpZmljYXRlO1xuICBcbiAgLy8gVVJMc1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpVXJsOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRVcmw6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGZyb250ZW5kVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqVW5pZmllZFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGVuYWJsZUF1dGggPSBmYWxzZSwgZW5hYmxlQ2xvdWRGcm9udCA9IGZhbHNlLCBlbmFibGVCYWNrdXAgPSBmYWxzZSB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ29uZmlndXJhdGlvbiAoU1NNIFBhcmFtZXRlcnMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIENyZWF0ZSBTU00gcGFyYW1ldGVycyBmb3IgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGNvbmZpZ1BhcmFtZXRlcnMgPSB7XG4gICAgICBhcHBDb25maWc6IG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdVbmlmaWVkQXBwQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2NvbmZpZ2AsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYXBpVXJsOiAncGxhY2Vob2xkZXInLFxuICAgICAgICAgIHdlYnNvY2tldFVybDogJ3BsYWNlaG9sZGVyJyxcbiAgICAgICAgICBlbmFibGVBdXRoOiBlbmFibGVBdXRoLFxuICAgICAgICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGVuYWJsZUNsb3VkRnJvbnQsXG4gICAgICAgICAgc3RhZ2U6IHN0YWdlXG4gICAgICAgIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFZKIEFwcGxpY2F0aW9uIHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgICBcbiAgICAgIGRhdGFiYXNlQ29uZmlnOiBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVW5pZmllZERhdGFiYXNlQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2RhdGFiYXNlL2NvbmZpZy10YWJsZWAsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiAncGxhY2Vob2xkZXInLFxuICAgICAgICBkZXNjcmlwdGlvbjogYERhdGFiYXNlIHVuaWZpZWQgY29uZmlndXJhdGlvbiB0YWJsZSBuYW1lIGZvciAke3N0YWdlfWAsXG4gICAgICB9KSxcbiAgICAgIFxuICAgICAgY29yc0NvbmZpZzogbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VuaWZpZWRDb3JzQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2NvcnMvY29uZmlnYCxcbiAgICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyA/IFsnaHR0cHM6Ly92MXozci5zYzRwZS5uZXQnXSA6IFsnaHR0cDovL2xvY2FsaG9zdDozMDAwJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1SZXF1ZXN0ZWQtV2l0aCddXG4gICAgICAgIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogYENPUlMgdW5pZmllZCBjb25maWd1cmF0aW9uIGZvciAke3N0YWdlfWAsXG4gICAgICB9KSxcbiAgICAgIFxuICAgICAgbG9nZ2luZ0NvbmZpZzogbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VuaWZpZWRMb2dnaW5nQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2xvZ2dpbmcvY29uZmlnYCxcbiAgICAgICAgc3RyaW5nVmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBsb2dMZXZlbDogc3RhZ2UgPT09ICdwcm9kJyA/ICdJTkZPJyA6ICdERUJVRycsXG4gICAgICAgICAgZW5hYmxlQ2xvdWRXYXRjaDogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVYUmF5OiBzdGFnZSAhPT0gJ2RldidcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgTG9nZ2luZyB1bmlmaWVkIGNvbmZpZ3VyYXRpb24gZm9yICR7c3RhZ2V9YCxcbiAgICAgIH0pLFxuICAgICAgXG4gICAgICB2aXN1YWxDb25maWc6IG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdVbmlmaWVkVmlzdWFsQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L3Zpc3VhbC9jb25maWdgLFxuICAgICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVuYWJsZVdlYkdQVTogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVNSURJOiB0cnVlLFxuICAgICAgICAgIHBlcmZvcm1hbmNlTW9kZTogc3RhZ2UgPT09ICdwcm9kJyA/ICdiYWxhbmNlZCcgOiAncXVhbGl0eScsXG4gICAgICAgICAgbWF4UGFydGljbGVzOiBzdGFnZSA9PT0gJ3Byb2QnID8gNTAwMDAgOiAxMDAwMDBcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgVmlzdWFsIHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgICBcbiAgICAgIGF1ZGlvQ29uZmlnOiBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVW5pZmllZEF1ZGlvQ29uZmlnJywge1xuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC11bmlmaWVkLyR7c3RhZ2V9L2F1ZGlvL2NvbmZpZ2AsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2FtcGxlUmF0ZTogNDQxMDAsXG4gICAgICAgICAgYnVmZmVyU2l6ZTogMjA0OCxcbiAgICAgICAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVCZWF0RGV0ZWN0aW9uOiB0cnVlXG4gICAgICAgIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEF1ZGlvIHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgICBcbiAgICAgIHdlYnNvY2tldENvbmZpZzogbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VuaWZpZWRXZWJTb2NrZXRDb25maWcnLCB7XG4gICAgICAgIHBhcmFtZXRlck5hbWU6IGAvdmotYXBwLXVuaWZpZWQvJHtzdGFnZX0vd2Vic29ja2V0L2NvbmZpZ2AsXG4gICAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbWF4Q29ubmVjdGlvbnM6IHN0YWdlID09PSAncHJvZCcgPyAxMDAwIDogMTAwLFxuICAgICAgICAgIGVuYWJsZUNvbXByZXNzaW9uOiB0cnVlLFxuICAgICAgICAgIHBpbmdJbnRlcnZhbDogMzAwMDBcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgV2ViU29ja2V0IHVuaWZpZWQgY29uZmlndXJhdGlvbiBmb3IgJHtzdGFnZX1gLFxuICAgICAgfSksXG4gICAgfTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTdG9yYWdlIChEeW5hbW9EQiAmIFMzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBcbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICB0aGlzLmNvbmZpZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVbmlmaWVkQ29uZmlnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai11bmlmaWVkLWNvbmZpZy0ke3N0YWdlfWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2tleScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG4gICAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlFbmFibGVkOiBzdGFnZSA9PT0gJ3Byb2QnLFxuICAgICAgfSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgfSk7XG5cbiAgICB0aGlzLnByZXNldFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVbmlmaWVkUHJlc2V0VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai11bmlmaWVkLXByZXNldHMtJHtzdGFnZX1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwcmVzZXRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd2ZXJzaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogc3RhZ2UgPT09ICdwcm9kJyxcbiAgICAgIH0sXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHN0cmVhbTogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0FORF9PTERfSU1BR0VTLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zZXNzaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VuaWZpZWRTZXNzaW9uVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai11bmlmaWVkLXNlc3Npb25zLSR7c3RhZ2V9YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2Vzc2lvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHN0YWdlID09PSAncHJvZCcsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc2Vzc2lvbiBxdWVyaWVzXG4gICAgdGhpcy5zZXNzaW9uVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVXNlcklkSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldHNcbiAgICB0aGlzLnByZXNldEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VuaWZpZWRQcmVzZXRCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgdmotdW5pZmllZC1wcmVzZXRzLSR7c3RhZ2V9LSR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgdmVyc2lvbmVkOiBzdGFnZSA9PT0gJ3Byb2QnLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IHN0YWdlID09PSAncHJvZCcgPyBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVVcGxvYWRzJyxcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvSUEnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSA6IFtdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5iYWNrdXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVbmlmaWVkQmFja3VwQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLXVuaWZpZWQtYmFja3Vwcy0ke3N0YWdlfS0ke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZEJhY2t1cHMnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoc3RhZ2UgPT09ICdwcm9kJyA/IDkwIDogMzApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMuc2l0ZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VuaWZpZWRTaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLXVuaWZpZWQtZnJvbnRlbmQtJHtzdGFnZX0tJHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BQ0xTLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJzQwNC5odG1sJyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIENvbW1vbiBMYW1iZGEgbGF5ZXJcbiAgICBjb25zdCBsYW1iZGFMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhLWxheWVycy9zaGFyZWQnKSksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWF0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiB1dGlsaXRpZXMgYW5kIGRlcGVuZGVuY2llcycsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZXhlY3V0aW9uIHJvbGVcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMYW1iZGFFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgRHluYW1vREJBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW0nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZ1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIHRoaXMucHJlc2V0VGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy5zZXNzaW9uVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgYCR7dGhpcy5zZXNzaW9uVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0VmVyc2lvbicsXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdEFjbCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGAke3RoaXMucHJlc2V0QnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgYCR7dGhpcy5iYWNrdXBCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICBTU01BY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyc0J5UGF0aCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGBhcm46YXdzOnNzbToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyL3ZqLWFwcC8ke3N0YWdlfS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENvbW1vbiBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgY29uc3QgY29tbW9uTGFtYmRhRW52aXJvbm1lbnQgPSB7XG4gICAgICBTVEFHRTogc3RhZ2UsXG4gICAgICBDT05GSUdfVEFCTEU6IHRoaXMuY29uZmlnVGFibGUudGFibGVOYW1lLFxuICAgICAgUFJFU0VUX1RBQkxFOiB0aGlzLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFNFU1NJT05fVEFCTEU6IHRoaXMuc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFBSRVNFVF9CVUNLRVQ6IHRoaXMucHJlc2V0QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBCQUNLVVBfQlVDS0VUOiB0aGlzLmJhY2t1cEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgTE9HX0xFVkVMOiBzdGFnZSA9PT0gJ3Byb2QnID8gJ0lORk8nIDogJ0RFQlVHJyxcbiAgICB9O1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uc1xuICAgIHRoaXMucHJlc2V0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcmVzZXRGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYHZqLXByZXNldC0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhL3ByZXNldCcpKSxcbiAgICAgIGxheWVyczogW2xhbWJkYUxheWVyXSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uTGFtYmRhRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29ubmVjdGlvbkZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgdmotY29ubmVjdGlvbi0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjb25uZWN0aW9uLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9sYW1iZGEvd2Vic29ja2V0JykpLFxuICAgICAgbGF5ZXJzOiBbbGFtYmRhTGF5ZXJdLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25MYW1iZGFFbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgdGhpcy5tZXNzYWdlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNZXNzYWdlRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGB2ai1tZXNzYWdlLSR7c3RhZ2V9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ21lc3NhZ2UuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2xhbWJkYS93ZWJzb2NrZXQnKSksXG4gICAgICBsYXllcnM6IFtsYW1iZGFMYXllcl0sXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkxhbWJkYUVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICB0aGlzLmhlYWx0aEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSGVhbHRoRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGB2ai1oZWFsdGgtJHtzdGFnZX1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaGVhbHRoLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9sYW1iZGEvd2Vic29ja2V0JykpLFxuICAgICAgbGF5ZXJzOiBbbGFtYmRhTGF5ZXJdLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25MYW1iZGFFbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEyOCxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgdGhpcy5jbGVhbnVwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDbGVhbnVwRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGB2ai1jbGVhbnVwLSR7c3RhZ2V9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2NsZWFudXAuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2xhbWJkYS93ZWJzb2NrZXQnKSksXG4gICAgICBsYXllcnM6IFtsYW1iZGFMYXllcl0sXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkxhbWJkYUVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICB0aGlzLnMzUHJvY2Vzc29yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTM1Byb2Nlc3NvckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgdmotczMtcHJvY2Vzc29yLSR7c3RhZ2V9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3MzLXByb2Nlc3Nvci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhL3dlYnNvY2tldCcpKSxcbiAgICAgIGxheWVyczogW2xhbWJkYUxheWVyXSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uTGFtYmRhRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIHRoaXMubWV0cmljc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWV0cmljc0Z1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgdmotbWV0cmljcy0ke3N0YWdlfWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdtZXRyaWNzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9sYW1iZGEvd2Vic29ja2V0JykpLFxuICAgICAgbGF5ZXJzOiBbbGFtYmRhTGF5ZXJdLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25MYW1iZGFFbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgXG4gICAgLy8gUkVTVCBBUElcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1ZqQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGB2ai1hcGktJHtzdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246IGBWSiBBcHBsaWNhdGlvbiBBUEkgLSAke3N0YWdlfWAsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBzdGFnZSA9PT0gJ3Byb2QnID8gWydodHRwczovL3YxejNyLnNjNHBlLm5ldCddIDogWydodHRwOi8vbG9jYWxob3N0OjMwMDAnXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1SZXF1ZXN0ZWQtV2l0aCddLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBzdGFnZSxcbiAgICAgICAgdGhyb3R0bGluZ0J1cnN0TGltaXQ6IHN0YWdlID09PSAncHJvZCcgPyAyMDAwIDogMTAwLFxuICAgICAgICB0aHJvdHRsaW5nUmF0ZUxpbWl0OiBzdGFnZSA9PT0gJ3Byb2QnID8gMTAwMCA6IDUwLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSb3V0ZXNcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xuICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5oZWFsdGhGdW5jdGlvbikpO1xuXG4gICAgY29uc3QgcHJlc2V0c1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgncHJlc2V0cycpO1xuICAgIHByZXNldHNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucHJlc2V0RnVuY3Rpb24pKTtcbiAgICBwcmVzZXRzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wcmVzZXRGdW5jdGlvbikpO1xuICAgIFxuICAgIGNvbnN0IHByZXNldFJlc291cmNlID0gcHJlc2V0c1Jlc291cmNlLmFkZFJlc291cmNlKCd7cHJlc2V0SWR9Jyk7XG4gICAgcHJlc2V0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSk7XG4gICAgcHJlc2V0UmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSk7XG4gICAgcHJlc2V0UmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnByZXNldEZ1bmN0aW9uKSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgQVBJIChzaW1wbGlmaWVkIGZvciB0aGlzIGV4YW1wbGUpXG4gICAgdGhpcy53ZWJzb2NrZXRBcGkgPSB0aGlzLmFwaTsgLy8gSW4gcmVhbCBpbXBsZW1lbnRhdGlvbiwgdGhpcyB3b3VsZCBiZSBhIFdlYlNvY2tldCBBUElcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDbG91ZFdhdGNoIE1vbml0b3JpbmdcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXBcbiAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ1ZqTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL3ZqLWFwcC8ke3N0YWdlfWAsXG4gICAgICByZXRlbnRpb246IHN0YWdlID09PSAncHJvZCcgPyBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIIDogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRGFzaGJvYXJkXG4gICAgdGhpcy5kYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ1ZqRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYHZqLWFwcC0ke3N0YWdlfWAsXG4gICAgICB3aWRnZXRzOiBbXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IFJlcXVlc3RzJyxcbiAgICAgICAgICAgIGxlZnQ6IFt0aGlzLmFwaS5tZXRyaWNDb3VudCgpXSxcbiAgICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IExhdGVuY3knLFxuICAgICAgICAgICAgbGVmdDogW3RoaXMuYXBpLm1ldHJpY0xhdGVuY3koKV0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0xhbWJkYSBJbnZvY2F0aW9ucycsXG4gICAgICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgICAgIHRoaXMucHJlc2V0RnVuY3Rpb24ubWV0cmljSW52b2NhdGlvbnMoKSxcbiAgICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uRnVuY3Rpb24ubWV0cmljSW52b2NhdGlvbnMoKSxcbiAgICAgICAgICAgICAgdGhpcy5tZXNzYWdlRnVuY3Rpb24ubWV0cmljSW52b2NhdGlvbnMoKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdMYW1iZGEgRXJyb3JzJyxcbiAgICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgICAgdGhpcy5wcmVzZXRGdW5jdGlvbi5tZXRyaWNFcnJvcnMoKSxcbiAgICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uRnVuY3Rpb24ubWV0cmljRXJyb3JzKCksXG4gICAgICAgICAgICAgIHRoaXMubWVzc2FnZUZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnRHluYW1vREIgUmVhZC9Xcml0ZSBDYXBhY2l0eScsXG4gICAgICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgICAgIHRoaXMuY29uZmlnVGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cygpLFxuICAgICAgICAgICAgICB0aGlzLnByZXNldFRhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgICAgdGhpcy5zZXNzaW9uVGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cygpLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgICAgIHRoaXMuY29uZmlnVGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgICAgdGhpcy5wcmVzZXRUYWJsZS5tZXRyaWNDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cygpLFxuICAgICAgICAgICAgICB0aGlzLnNlc3Npb25UYWJsZS5tZXRyaWNDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cygpLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgXG4gICAgLy8gU1NMIENlcnRpZmljYXRlXG4gICAgaWYgKGVuYWJsZUNsb3VkRnJvbnQpIHtcbiAgICAgIGlmIChzdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICAgIC8vIFByb2R1Y3Rpb24gY2VydGlmaWNhdGUgZm9yIHYxejNyLnNjNHBlLm5ldFxuICAgICAgICB0aGlzLmNlcnRpZmljYXRlID0gYWNtLkNlcnRpZmljYXRlLmZyb21DZXJ0aWZpY2F0ZUFybihcbiAgICAgICAgICB0aGlzLCBcbiAgICAgICAgICAnU3NsQ2VydGlmaWNhdGUnLFxuICAgICAgICAgICdhcm46YXdzOmFjbTp1cy1lYXN0LTE6ODIyMDYzOTQ4NzczOmNlcnRpZmljYXRlLzQwZDI4NThkLTQyNGQtNDQwMi1iZmE3LWFmY2Q0MzIzMTBjYSdcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT09ICdkZXYnKSB7XG4gICAgICAgIC8vIERldmVsb3BtZW50IGNlcnRpZmljYXRlIGZvciB2MXozci1kZXYuc2M0cGUubmV0XG4gICAgICAgIHRoaXMuY2VydGlmaWNhdGUgPSBhY20uQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKFxuICAgICAgICAgIHRoaXMsIFxuICAgICAgICAgICdTc2xDZXJ0aWZpY2F0ZScsXG4gICAgICAgICAgJ2Fybjphd3M6YWNtOnVzLWVhc3QtMTo4MjIwNjM5NDg3NzM6Y2VydGlmaWNhdGUvODliOGZlN2UtZjIwYS00NWRmLWI4NDgtNGI4ZDFkOWQ2MTQwJ1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuc2l0ZUJ1Y2tldCksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgJy9hcGkvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4odGhpcy5hcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICBkb21haW5OYW1lczogZW5hYmxlQ2xvdWRGcm9udCA/IFxuICAgICAgICAoc3RhZ2UgPT09ICdwcm9kJyA/IFsndjF6M3Iuc2M0cGUubmV0J10gOiBcbiAgICAgICAgIHN0YWdlID09PSAnZGV2JyA/IFsndjF6M3ItZGV2LnNjNHBlLm5ldCddIDogdW5kZWZpbmVkKSA6IHVuZGVmaW5lZCxcbiAgICAgIGNlcnRpZmljYXRlOiB0aGlzLmNlcnRpZmljYXRlLFxuICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzEwMCxcbiAgICAgIGNvbW1lbnQ6IGBWSiBBcHBsaWNhdGlvbiBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiAtICR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBPdXRwdXRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIHRoaXMuYXBpVXJsID0gdGhpcy5hcGkudXJsO1xuICAgIHRoaXMud2Vic29ja2V0VXJsID0gdGhpcy5hcGkudXJsOyAvLyBXb3VsZCBiZSBkaWZmZXJlbnQgZm9yIFdlYlNvY2tldCBBUElcbiAgICB0aGlzLmZyb250ZW5kVXJsID0gYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWA7XG5cbiAgICAvLyBVcGRhdGUgU1NNIHBhcmFtZXRlcnMgd2l0aCBhY3R1YWwgdmFsdWVzXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VwZGF0ZWRBcHBDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL3ZqLWFwcC8ke3N0YWdlfS9jb25maWctdXBkYXRlZGAsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBhcGlVcmw6IHRoaXMuYXBpVXJsLFxuICAgICAgICB3ZWJzb2NrZXRVcmw6IHRoaXMud2Vic29ja2V0VXJsLFxuICAgICAgICBmcm9udGVuZFVybDogdGhpcy5mcm9udGVuZFVybCxcbiAgICAgICAgZW5hYmxlQXV0aDogZW5hYmxlQXV0aCxcbiAgICAgICAgZW5hYmxlQ2xvdWRGcm9udDogZW5hYmxlQ2xvdWRGcm9udCxcbiAgICAgICAgc3RhZ2U6IHN0YWdlXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVXBkYXRlZCBWSiBBcHBsaWNhdGlvbiBjb25maWd1cmF0aW9uIGZvciAke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVXBkYXRlZERhdGFiYXNlQ29uZmlnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC92ai1hcHAvJHtzdGFnZX0vZGF0YWJhc2UvY29uZmlnLXRhYmxlLXVwZGF0ZWRgLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuY29uZmlnVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBVcGRhdGVkIGRhdGFiYXNlIGNvbmZpZ3VyYXRpb24gdGFibGUgbmFtZSBmb3IgJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0VXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMud2Vic29ja2V0VXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgQVBJIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mcm9udGVuZFVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRnJvbnRlbmQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbmZpZ3VyYXRpb24gdGFibGUgbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJlc2V0VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmVzZXQgdGFibGUgbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2Vzc2lvblRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Nlc3Npb24gdGFibGUgbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbkRvbWFpbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gRG9tYWluIE5hbWUnLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENsb3VkV2F0Y2ggQWxhcm1zIGFuZCBNb25pdG9yaW5nXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIENyZWF0ZSBTTlMgdG9waWMgZm9yIGFsZXJ0c1xuICAgIGNvbnN0IGFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgdmotYXBwLWFsZXJ0cy0ke3N0YWdlfWAsXG4gICAgICBkaXNwbGF5TmFtZTogYFZKIEFwcGxpY2F0aW9uIEFsZXJ0cyAtICR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IEFsYXJtc1xuICAgIGNvbnN0IGFwaUVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXBpRXJyb3JBbGFybScsIHtcbiAgICAgIG1ldHJpYzogdGhpcy5hcGkubWV0cmljU2VydmVyRXJyb3Ioe1xuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgc2VydmVyIGVycm9ycycsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICBcbiAgICBhcGlFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKGFsZXJ0VG9waWMpKTtcblxuICAgIGNvbnN0IGFwaUxhdGVuY3lBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGlMYXRlbmN5QWxhcm0nLCB7XG4gICAgICBtZXRyaWM6IHRoaXMuYXBpLm1ldHJpY0xhdGVuY3koe1xuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA1MDAwLCAvLyA1IHNlY29uZHNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGhpZ2ggbGF0ZW5jeScsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICBcbiAgICBhcGlMYXRlbmN5QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRUb3BpYykpO1xuXG4gICAgLy8gTGFtYmRhIEZ1bmN0aW9uIEFsYXJtc1xuICAgIGNvbnN0IGxhbWJkYUVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnTGFtYmRhRXJyb3JBbGFybScsIHtcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWF0aEV4cHJlc3Npb24oe1xuICAgICAgICBleHByZXNzaW9uOiAnZTEgKyBlMiArIGUzICsgZTQnLFxuICAgICAgICB1c2luZ01ldHJpY3M6IHtcbiAgICAgICAgICBlMTogdGhpcy5wcmVzZXRGdW5jdGlvbi5tZXRyaWNFcnJvcnMoeyBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxuICAgICAgICAgIGUyOiB0aGlzLmNvbm5lY3Rpb25GdW5jdGlvbi5tZXRyaWNFcnJvcnMoeyBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxuICAgICAgICAgIGUzOiB0aGlzLm1lc3NhZ2VGdW5jdGlvbi5tZXRyaWNFcnJvcnMoeyBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxuICAgICAgICAgIGU0OiB0aGlzLmhlYWx0aEZ1bmN0aW9uLm1ldHJpY0Vycm9ycyh7IHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBlcnJvcnMnLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG4gICAgXG4gICAgbGFtYmRhRXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKSk7XG5cbiAgICAvLyBEeW5hbW9EQiBBbGFybXNcbiAgICBjb25zdCBkeW5hbW9EYlRocm90dGxlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRHluYW1vRGJUaHJvdHRsZUFsYXJtJywge1xuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NYXRoRXhwcmVzc2lvbih7XG4gICAgICAgIGV4cHJlc3Npb246ICd0MSArIHQyICsgdDMnLFxuICAgICAgICB1c2luZ01ldHJpY3M6IHtcbiAgICAgICAgICB0MTogdGhpcy5jb25maWdUYWJsZS5tZXRyaWNUaHJvdHRsZWRSZXF1ZXN0cyh7IHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXG4gICAgICAgICAgdDI6IHRoaXMucHJlc2V0VGFibGUubWV0cmljVGhyb3R0bGVkUmVxdWVzdHMoeyBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxuICAgICAgICAgIHQzOiB0aGlzLnNlc3Npb25UYWJsZS5tZXRyaWNUaHJvdHRsZWRSZXF1ZXN0cyh7IHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRocm90dGxpbmcgZGV0ZWN0ZWQnLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG4gICAgXG4gICAgZHluYW1vRGJUaHJvdHRsZUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKGFsZXJ0VG9waWMpKTtcblxuICAgIC8vIENsb3VkRnJvbnQgQWxhcm1zXG4gICAgY29uc3QgY2xvdWRmcm9udEVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQ2xvdWRGcm9udEVycm9yQWxhcm0nLCB7XG4gICAgICBtZXRyaWM6IHRoaXMuZGlzdHJpYnV0aW9uLm1ldHJpYzR4eEVycm9yUmF0ZSh7XG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsIC8vIDUlXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdDbG91ZEZyb250IGhpZ2ggZXJyb3IgcmF0ZScsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICBcbiAgICBjbG91ZGZyb250RXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKSk7XG5cbiAgICAvLyBDdXN0b20gTWV0cmljcyBEYXNoYm9hcmRcbiAgICBjb25zdCBjdXN0b21EYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0N1c3RvbURhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGB2ai1hcHAtY3VzdG9tLSR7c3RhZ2V9YCxcbiAgICAgIHdpZGdldHM6IFtcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnQXBwbGljYXRpb24gSGVhbHRoIE92ZXJ2aWV3JyxcbiAgICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgICAgdGhpcy5hcGkubWV0cmljQ291bnQoeyBsYWJlbDogJ0FQSSBSZXF1ZXN0cycgfSksXG4gICAgICAgICAgICAgIHRoaXMuYXBpLm1ldHJpY1NlcnZlckVycm9yKHsgbGFiZWw6ICdBUEkgRXJyb3JzJyB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByaWdodDogW1xuICAgICAgICAgICAgICB0aGlzLmFwaS5tZXRyaWNMYXRlbmN5KHsgbGFiZWw6ICdBUEkgTGF0ZW5jeScgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnQ2xvdWRGcm9udCBQZXJmb3JtYW5jZScsXG4gICAgICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgICAgIHRoaXMuZGlzdHJpYnV0aW9uLm1ldHJpY1JlcXVlc3RzKHsgbGFiZWw6ICdDbG91ZEZyb250IFJlcXVlc3RzJyB9KSxcbiAgICAgICAgICAgICAgdGhpcy5kaXN0cmlidXRpb24ubWV0cmljQnl0ZXNEb3dubG9hZGVkKHsgbGFiZWw6ICdCeXRlcyBEb3dubG9hZGVkJyB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByaWdodDogW1xuICAgICAgICAgICAgICB0aGlzLmRpc3RyaWJ1dGlvbi5tZXRyaWM0eHhFcnJvclJhdGUoeyBsYWJlbDogJ0Vycm9yIFJhdGUnIH0pLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnQ3VycmVudCBBY3RpdmUgU2Vzc2lvbnMnLFxuICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICB0aGlzLnNlc3Npb25UYWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKHsgbGFiZWw6ICdTZXNzaW9uIFJlYWRzJyB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogNixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ1RvdGFsIFByZXNldHMnLFxuICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICB0aGlzLnByZXNldFRhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKHsgbGFiZWw6ICdQcmVzZXQgV3JpdGVzJyB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogNixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0xhbWJkYSBJbnZvY2F0aW9ucycsXG4gICAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICAgIHRoaXMucHJlc2V0RnVuY3Rpb24ubWV0cmljSW52b2NhdGlvbnMoeyBsYWJlbDogJ1ByZXNldCBGdW5jdGlvbicgfSksXG4gICAgICAgICAgICAgIHRoaXMuY29ubmVjdGlvbkZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKHsgbGFiZWw6ICdDb25uZWN0aW9uIEZ1bmN0aW9uJyB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogNixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ1N5c3RlbSBIZWFsdGgnLFxuICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICB0aGlzLmhlYWx0aEZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKHsgbGFiZWw6ICdIZWFsdGggQ2hlY2tzJyB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogNixcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xlYW51cCBhbmQgTW9uaXRvcmluZ1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBcbiAgICAvLyBDbGVhbnVwIHNjaGVkdWxlXG4gICAgY29uc3QgY2xlYW51cFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0NsZWFudXBSdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICcyJyxcbiAgICAgICAgZGF5OiAnKicsXG4gICAgICAgIG1vbnRoOiAnKicsXG4gICAgICAgIHllYXI6ICcqJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuICAgIFxuICAgIGNsZWFudXBSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmNsZWFudXBGdW5jdGlvbikpO1xuXG4gICAgLy8gTWV0cmljcyBjb2xsZWN0aW9uXG4gICAgY29uc3QgbWV0cmljc1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ01ldHJpY3NSdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKGNkay5EdXJhdGlvbi5taW51dGVzKDUpKSxcbiAgICB9KTtcbiAgICBcbiAgICBtZXRyaWNzUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5tZXRyaWNzRnVuY3Rpb24pKTtcblxuICAgIC8vIFRhZ2dpbmdcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnVkotQXBwbGljYXRpb24nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWdlJywgc3RhZ2UpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnT3duZXInLCAndmotdGVhbScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXJjaGl0ZWN0dXJlJywgJ1VuaWZpZWQnKTtcbiAgfVxufSJdfQ==