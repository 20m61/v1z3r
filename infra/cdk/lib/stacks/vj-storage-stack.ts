import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface VjStorageStackProps extends cdk.StackProps {
  stage: string;
  config: {
    domainName: string;
    enableAuth: boolean;
    enableCloudFront: boolean;
    enableBackup: boolean;
  };
  configTable: dynamodb.Table;
}

export class VjStorageStack extends cdk.Stack {
  public readonly sessionTable: dynamodb.Table;
  public readonly presetTable: dynamodb.Table;
  public readonly presetBucket: s3.Bucket;
  public readonly backupBucket?: s3.Bucket;

  constructor(scope: Construct, id: string, props: VjStorageStackProps) {
    super(scope, id, props);

    const { stage, config } = props;

    // Session management table
    this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
      tableName: `vj-sessions-${stage}`,
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.enableBackup,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      tags: {
        Name: `VJ Sessions Table - ${stage}`,
        Purpose: 'Real-time session management',
      },
    });

    // Add GSI for querying sessions by status
    this.sessionTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Preset management table
    this.presetTable = new dynamodb.Table(this, 'PresetTable', {
      tableName: `vj-presets-${stage}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'presetId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.enableBackup,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      tags: {
        Name: `VJ Presets Table - ${stage}`,
        Purpose: 'User preset storage and management',
      },
    });

    // Add GSI for querying public presets
    this.presetTable.addGlobalSecondaryIndex({
      indexName: 'PublicPresetsIndex',
      partitionKey: {
        name: 'isPublic',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'updatedAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Add GSI for searching presets by tags
    this.presetTable.addGlobalSecondaryIndex({
      indexName: 'TagsIndex',
      partitionKey: {
        name: 'tag',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'updatedAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // S3 bucket for preset files and media assets
    this.presetBucket = new s3.Bucket(this, 'PresetBucket', {
      bucketName: `vj-presets-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: config.enableBackup,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
        ...(stage !== 'prod' ? [{
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(7),
        }] : []),
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      tags: {
        Name: `VJ Presets Bucket - ${stage}`,
        Purpose: 'Preset files and media storage',
      },
    });

    // CORS configuration for direct uploads from browser
    this.presetBucket.addCorsRule({
      allowedOrigins: stage === 'prod' 
        ? [`https://${config.domainName}`]
        : ['http://localhost:3000', 'http://localhost:3001'],
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
      allowedHeaders: ['*'],
      maxAge: 3000,
    });

    // Backup bucket (only in production)
    if (config.enableBackup && stage === 'prod') {
      this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
        bucketName: `vj-backups-${stage}-${this.account}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        versioned: false,
        lifecycleRules: [
          {
            id: 'DeleteOldBackups',
            expiration: cdk.Duration.days(90),
          },
          {
            id: 'TransitionToGlacier',
            transitions: [
              {
                storageClass: s3.StorageClass.GLACIER,
                transitionAfter: cdk.Duration.days(30),
              },
            ],
          },
        ],
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        tags: {
          Name: `VJ Backups Bucket - ${stage}`,
          Purpose: 'Automated backups and disaster recovery',
        },
      });

      // Lambda function for automated backups
      const backupFunction = new lambda.Function(this, 'BackupFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
          const AWS = require('aws-sdk');
          const dynamodb = new AWS.DynamoDB();
          const s3 = new AWS.S3();
          
          exports.handler = async (event) => {
            const timestamp = new Date().toISOString();
            
            try {
              // Backup DynamoDB tables
              const tables = ['${this.sessionTable.tableName}', '${this.presetTable.tableName}'];
              
              for (const tableName of tables) {
                await dynamodb.createBackup({
                  TableName: tableName,
                  BackupName: \`\${tableName}-backup-\${timestamp}\`
                }).promise();
              }
              
              console.log('Backup completed successfully');
              return { statusCode: 200, body: 'Backup completed' };
            } catch (error) {
              console.error('Backup failed:', error);
              throw error;
            }
          };
        `),
        environment: {
          BACKUP_BUCKET: this.backupBucket.bucketName,
        },
        timeout: cdk.Duration.minutes(15),
      });

      // Grant permissions for backup function
      this.sessionTable.grantBackupAccess(backupFunction);
      this.presetTable.grantBackupAccess(backupFunction);
      this.backupBucket.grantWrite(backupFunction);

      // Schedule daily backups
      const backupRule = new events.Rule(this, 'BackupSchedule', {
        schedule: events.Schedule.cron({ hour: '2', minute: '0' }), // 2 AM daily
        description: 'Daily backup of VJ application data',
      });

      backupRule.addTarget(new targets.LambdaFunction(backupFunction));
    }

    // Lambda function for S3 event processing
    const s3ProcessorFunction = new lambda.Function(this, 'S3ProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
          console.log('S3 event:', JSON.stringify(event, null, 2));
          
          for (const record of event.Records) {
            if (record.eventName.startsWith('ObjectCreated')) {
              const bucket = record.s3.bucket.name;
              const key = record.s3.object.key;
              const size = record.s3.object.size;
              
              // Update preset metadata in DynamoDB
              const keyParts = key.split('/');
              if (keyParts.length >= 2) {
                const userId = keyParts[0];
                const presetId = keyParts[1].replace(/\\.[^/.]+$/, ''); // Remove extension
                
                try {
                  await dynamodb.update({
                    TableName: '${this.presetTable.tableName}',
                    Key: { userId, presetId },
                    UpdateExpression: 'SET fileSize = :size, fileUrl = :url, updatedAt = :timestamp',
                    ExpressionAttributeValues: {
                      ':size': size,
                      ':url': \`s3://\${bucket}/\${key}\`,
                      ':timestamp': new Date().toISOString(),
                    },
                  }).promise();
                } catch (error) {
                  console.error('Failed to update preset metadata:', error);
                }
              }
            }
          }
          
          return { statusCode: 200 };
        };
      `),
      environment: {
        PRESET_TABLE_NAME: this.presetTable.tableName,
      },
    });

    // Grant permissions to S3 processor
    this.presetTable.grantWriteData(s3ProcessorFunction);

    // S3 event notifications
    this.presetBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(s3ProcessorFunction)
    );

    // Output important values
    new cdk.CfnOutput(this, 'SessionTableName', {
      value: this.sessionTable.tableName,
      description: 'Session DynamoDB table name',
      exportName: `VjSessionTable-${stage}`,
    });

    new cdk.CfnOutput(this, 'PresetTableName', {
      value: this.presetTable.tableName,
      description: 'Preset DynamoDB table name',
      exportName: `VjPresetTable-${stage}`,
    });

    new cdk.CfnOutput(this, 'PresetBucketName', {
      value: this.presetBucket.bucketName,
      description: 'Preset S3 bucket name',
      exportName: `VjPresetBucket-${stage}`,
    });

    if (this.backupBucket) {
      new cdk.CfnOutput(this, 'BackupBucketName', {
        value: this.backupBucket.bucketName,
        description: 'Backup S3 bucket name',
        exportName: `VjBackupBucket-${stage}`,
      });
    }
  }
}