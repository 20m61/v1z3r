import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';

export interface VjUnifiedStackProps extends cdk.StackProps {
  stage: string;
  enableAuth?: boolean;
  enableCloudFront?: boolean;
  enableBackup?: boolean;
  domainName?: string;
}

export class VjUnifiedStack extends cdk.Stack {
  // DynamoDB Tables
  public readonly configTable: dynamodb.Table;
  public readonly presetTable: dynamodb.Table;
  public readonly sessionTable: dynamodb.Table;
  
  // S3 Buckets
  public readonly presetBucket: s3.Bucket;
  public readonly backupBucket: s3.Bucket;
  public readonly siteBucket: s3.Bucket;
  
  // Lambda Functions
  public readonly presetFunction: lambda.Function;
  public readonly connectionFunction: lambda.Function;
  public readonly messageFunction: lambda.Function;
  public readonly healthFunction: lambda.Function;
  public readonly cleanupFunction: lambda.Function;
  public readonly s3ProcessorFunction: lambda.Function;
  public readonly metricsFunction: lambda.Function;
  
  // API Gateway
  public readonly api: apigateway.RestApi;
  public readonly websocketApi: apigateway.RestApi;
  
  // CloudWatch
  public readonly logGroup: logs.LogGroup;
  public readonly dashboard: cloudwatch.Dashboard;
  
  // CloudFront
  public readonly distribution: cloudfront.Distribution;
  public readonly certificate?: acm.ICertificate;
  
  // URLs
  public readonly apiUrl: string;
  public readonly websocketUrl: string;
  public readonly frontendUrl: string;

  constructor(scope: Construct, id: string, props: VjUnifiedStackProps) {
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
    // CloudFront Distribution
    // =====================================
    
    // SSL Certificate
    if (enableCloudFront && stage === 'prod') {
      // Use existing certificate from ACM
      this.certificate = acm.Certificate.fromCertificateArn(
        this, 
        'SslCertificate',
        'arn:aws:acm:us-east-1:822063948773:certificate/40d2858d-424d-4402-bfa7-afcd432310ca'
      );
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
      domainNames: enableCloudFront && stage === 'prod' ? ['v1z3r.sc4pe.net'] : undefined,
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
      threshold: 5000, // 5 seconds
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
      threshold: 5, // 5%
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