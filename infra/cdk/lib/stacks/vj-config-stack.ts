import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface VjConfigStackProps extends cdk.StackProps {
  stage: string;
  config: {
    domainName: string;
    enableAuth: boolean;
    enableCloudFront: boolean;
    enableBackup: boolean;
  };
}

export class VjConfigStack extends cdk.Stack {
  public readonly configTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: VjConfigStackProps) {
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