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
exports.VjStorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3n = __importStar(require("aws-cdk-lib/aws-s3-notifications"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class VjStorageStack extends cdk.Stack {
    sessionTable;
    presetTable;
    presetBucket;
    backupBucket;
    constructor(scope, id, props) {
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
        });
        // Add tags after creation
        cdk.Tags.of(this.sessionTable).add('Name', `VJ Sessions Table - ${stage}`);
        cdk.Tags.of(this.sessionTable).add('Purpose', 'Real-time session management');
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
        });
        // Add tags after creation
        cdk.Tags.of(this.presetTable).add('Name', `VJ Presets Table - ${stage}`);
        cdk.Tags.of(this.presetTable).add('Purpose', 'User preset storage and management');
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
        });
        // Add tags after creation
        cdk.Tags.of(this.presetBucket).add('Name', `VJ Presets Bucket - ${stage}`);
        cdk.Tags.of(this.presetBucket).add('Purpose', 'Preset files and media storage');
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
            });
            // Add tags after creation
            cdk.Tags.of(this.backupBucket).add('Name', `VJ Backups Bucket - ${stage}`);
            cdk.Tags.of(this.backupBucket).add('Purpose', 'Automated backups and disaster recovery');
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
            this.sessionTable.grantReadData(backupFunction);
            this.presetTable.grantReadData(backupFunction);
            this.backupBucket.grantWrite(backupFunction);
            // Grant DynamoDB backup permissions
            backupFunction.addToRolePolicy(new iam.PolicyStatement({
                actions: [
                    'dynamodb:CreateBackup',
                    'dynamodb:DescribeBackup',
                    'dynamodb:ListBackups'
                ],
                resources: [
                    this.sessionTable.tableArn,
                    this.presetTable.tableArn
                ]
            }));
            // Schedule daily backups
            const backupRule = new events.Rule(this, 'BackupSchedule', {
                schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
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
        this.presetBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(s3ProcessorFunction));
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
exports.VjStorageStack = VjStorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLXN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELHVEQUF5QztBQUN6QyxzRUFBd0Q7QUFDeEQsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQseURBQTJDO0FBYzNDLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNCLFlBQVksQ0FBaUI7SUFDN0IsV0FBVyxDQUFpQjtJQUM1QixZQUFZLENBQVk7SUFDeEIsWUFBWSxDQUFhO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFaEMsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDM0QsU0FBUyxFQUFFLGVBQWUsS0FBSyxFQUFFO1lBQ2pDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELG1CQUFtQixFQUFFLEtBQUs7WUFDMUIsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxZQUFZO1lBQ3hDLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxD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QUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVU7Z0JBQ25DLFdBQVcsRUFBRSx1QkFBdUI7Z0JBQ3BDLFVBQVUsRUFBRSxrQkFBa0IsS0FBSyxFQUFFO2FBQ3RDLENBQUMsQ0FBQztTQUNKO0lBQ0gsQ0FBQztDQUNGO0FBdlRELHdDQXVUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzbiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtbm90aWZpY2F0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWalN0b3JhZ2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgVmpTdG9yYWdlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgc2Vzc2lvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYmFja3VwQnVja2V0PzogczMuQnVja2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWalN0b3JhZ2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBjb25maWcgfSA9IHByb3BzO1xuXG4gICAgLy8gU2Vzc2lvbiBtYW5hZ2VtZW50IHRhYmxlXG4gICAgdGhpcy5zZXNzaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Nlc3Npb25UYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYHZqLXNlc3Npb25zLSR7c3RhZ2V9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc2Vzc2lvbklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogY29uZmlnLmVuYWJsZUJhY2t1cCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyBhZnRlciBjcmVhdGlvblxuICAgIGNkay5UYWdzLm9mKHRoaXMuc2Vzc2lvblRhYmxlKS5hZGQoJ05hbWUnLCBgVkogU2Vzc2lvbnMgVGFibGUgLSAke3N0YWdlfWApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuc2Vzc2lvblRhYmxlKS5hZGQoJ1B1cnBvc2UnLCAnUmVhbC10aW1lIHNlc3Npb24gbWFuYWdlbWVudCcpO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgc2Vzc2lvbnMgYnkgc3RhdHVzXG4gICAgdGhpcy5zZXNzaW9uVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnU3RhdHVzSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdzdGF0dXMnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBQcmVzZXQgbWFuYWdlbWVudCB0YWJsZVxuICAgIHRoaXMucHJlc2V0VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1ByZXNldFRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgdmotcHJlc2V0cy0ke3N0YWdlfWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3VzZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3ByZXNldElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5lbmFibGVCYWNrdXAsXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIGFmdGVyIGNyZWF0aW9uXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5wcmVzZXRUYWJsZSkuYWRkKCdOYW1lJywgYFZKIFByZXNldHMgVGFibGUgLSAke3N0YWdlfWApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMucHJlc2V0VGFibGUpLmFkZCgnUHVycG9zZScsICdVc2VyIHByZXNldCBzdG9yYWdlIGFuZCBtYW5hZ2VtZW50Jyk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBxdWVyeWluZyBwdWJsaWMgcHJlc2V0c1xuICAgIHRoaXMucHJlc2V0VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnUHVibGljUHJlc2V0c0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnaXNQdWJsaWMnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd1cGRhdGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBzZWFyY2hpbmcgcHJlc2V0cyBieSB0YWdzXG4gICAgdGhpcy5wcmVzZXRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdUYWdzSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd0YWcnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd1cGRhdGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTMyBidWNrZXQgZm9yIHByZXNldCBmaWxlcyBhbmQgbWVkaWEgYXNzZXRzXG4gICAgdGhpcy5wcmVzZXRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcmVzZXRCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgdmotcHJlc2V0cy0ke3N0YWdlfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogY29uZmlnLmVuYWJsZUJhY2t1cCxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLihzdGFnZSAhPT0gJ3Byb2QnID8gW3tcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZFZlcnNpb25zJyxcbiAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgICB9XSA6IFtdKSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRhZ3MgYWZ0ZXIgY3JlYXRpb25cbiAgICBjZGsuVGFncy5vZih0aGlzLnByZXNldEJ1Y2tldCkuYWRkKCdOYW1lJywgYFZKIFByZXNldHMgQnVja2V0IC0gJHtzdGFnZX1gKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnByZXNldEJ1Y2tldCkuYWRkKCdQdXJwb3NlJywgJ1ByZXNldCBmaWxlcyBhbmQgbWVkaWEgc3RvcmFnZScpO1xuXG4gICAgLy8gQ09SUyBjb25maWd1cmF0aW9uIGZvciBkaXJlY3QgdXBsb2FkcyBmcm9tIGJyb3dzZXJcbiAgICB0aGlzLnByZXNldEJ1Y2tldC5hZGRDb3JzUnVsZSh7XG4gICAgICBhbGxvd2VkT3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJyBcbiAgICAgICAgPyBbYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gXVxuICAgICAgICA6IFsnaHR0cDovL2xvY2FsaG9zdDozMDAwJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMSddLFxuICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVCwgczMuSHR0cE1ldGhvZHMuREVMRVRFXSxcbiAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgIG1heEFnZTogMzAwMCxcbiAgICB9KTtcblxuICAgIC8vIEJhY2t1cCBidWNrZXQgKG9ubHkgaW4gcHJvZHVjdGlvbilcbiAgICBpZiAoY29uZmlnLmVuYWJsZUJhY2t1cCAmJiBzdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICB0aGlzLmJhY2t1cEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0JhY2t1cEJ1Y2tldCcsIHtcbiAgICAgICAgYnVja2V0TmFtZTogYHZqLWJhY2t1cHMtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnRGVsZXRlT2xkQmFja3VwcycsXG4gICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0dsYWNpZXInLFxuICAgICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBZGQgdGFncyBhZnRlciBjcmVhdGlvblxuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5iYWNrdXBCdWNrZXQpLmFkZCgnTmFtZScsIGBWSiBCYWNrdXBzIEJ1Y2tldCAtICR7c3RhZ2V9YCk7XG4gICAgICBjZGsuVGFncy5vZih0aGlzLmJhY2t1cEJ1Y2tldCkuYWRkKCdQdXJwb3NlJywgJ0F1dG9tYXRlZCBiYWNrdXBzIGFuZCBkaXNhc3RlciByZWNvdmVyeScpO1xuXG4gICAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGF1dG9tYXRlZCBiYWNrdXBzXG4gICAgICBjb25zdCBiYWNrdXBGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0JhY2t1cEZ1bmN0aW9uJywge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCKCk7XG4gICAgICAgICAgY29uc3QgczMgPSBuZXcgQVdTLlMzKCk7XG4gICAgICAgICAgXG4gICAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vIEJhY2t1cCBEeW5hbW9EQiB0YWJsZXNcbiAgICAgICAgICAgICAgY29uc3QgdGFibGVzID0gWycke3RoaXMuc2Vzc2lvblRhYmxlLnRhYmxlTmFtZX0nLCAnJHt0aGlzLnByZXNldFRhYmxlLnRhYmxlTmFtZX0nXTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgdGFibGVOYW1lIG9mIHRhYmxlcykge1xuICAgICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLmNyZWF0ZUJhY2t1cCh7XG4gICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IHRhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICAgIEJhY2t1cE5hbWU6IFxcYFxcJHt0YWJsZU5hbWV9LWJhY2t1cC1cXCR7dGltZXN0YW1wfVxcYFxuICAgICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0JhY2t1cCBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDIwMCwgYm9keTogJ0JhY2t1cCBjb21wbGV0ZWQnIH07XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdCYWNrdXAgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgYCksXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgQkFDS1VQX0JVQ0tFVDogdGhpcy5iYWNrdXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciBiYWNrdXAgZnVuY3Rpb25cbiAgICAgIHRoaXMuc2Vzc2lvblRhYmxlLmdyYW50UmVhZERhdGEoYmFja3VwRnVuY3Rpb24pO1xuICAgICAgdGhpcy5wcmVzZXRUYWJsZS5ncmFudFJlYWREYXRhKGJhY2t1cEZ1bmN0aW9uKTtcbiAgICAgIHRoaXMuYmFja3VwQnVja2V0LmdyYW50V3JpdGUoYmFja3VwRnVuY3Rpb24pO1xuICAgICAgXG4gICAgICAvLyBHcmFudCBEeW5hbW9EQiBiYWNrdXAgcGVybWlzc2lvbnNcbiAgICAgIGJhY2t1cEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6Q3JlYXRlQmFja3VwJyxcbiAgICAgICAgICAnZHluYW1vZGI6RGVzY3JpYmVCYWNrdXAnLFxuICAgICAgICAgICdkeW5hbW9kYjpMaXN0QmFja3VwcydcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgdGhpcy5zZXNzaW9uVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgdGhpcy5wcmVzZXRUYWJsZS50YWJsZUFyblxuICAgICAgICBdXG4gICAgICB9KSk7XG5cbiAgICAgIC8vIFNjaGVkdWxlIGRhaWx5IGJhY2t1cHNcbiAgICAgIGNvbnN0IGJhY2t1cFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0JhY2t1cFNjaGVkdWxlJywge1xuICAgICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oeyBob3VyOiAnMicsIG1pbnV0ZTogJzAnIH0pLCAvLyAyIEFNIGRhaWx5XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRGFpbHkgYmFja3VwIG9mIFZKIGFwcGxpY2F0aW9uIGRhdGEnLFxuICAgICAgfSk7XG5cbiAgICAgIGJhY2t1cFJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGJhY2t1cEZ1bmN0aW9uKSk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBTMyBldmVudCBwcm9jZXNzaW5nXG4gICAgY29uc3QgczNQcm9jZXNzb3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1MzUHJvY2Vzc29yRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1MzIGV2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCByZWNvcmQgb2YgZXZlbnQuUmVjb3Jkcykge1xuICAgICAgICAgICAgaWYgKHJlY29yZC5ldmVudE5hbWUuc3RhcnRzV2l0aCgnT2JqZWN0Q3JlYXRlZCcpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJ1Y2tldCA9IHJlY29yZC5zMy5idWNrZXQubmFtZTtcbiAgICAgICAgICAgICAgY29uc3Qga2V5ID0gcmVjb3JkLnMzLm9iamVjdC5rZXk7XG4gICAgICAgICAgICAgIGNvbnN0IHNpemUgPSByZWNvcmQuczMub2JqZWN0LnNpemU7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBVcGRhdGUgcHJlc2V0IG1ldGFkYXRhIGluIER5bmFtb0RCXG4gICAgICAgICAgICAgIGNvbnN0IGtleVBhcnRzID0ga2V5LnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgIGlmIChrZXlQYXJ0cy5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJJZCA9IGtleVBhcnRzWzBdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXNldElkID0ga2V5UGFydHNbMV0ucmVwbGFjZSgvXFxcXC5bXi8uXSskLywgJycpOyAvLyBSZW1vdmUgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnVwZGF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogJyR7dGhpcy5wcmVzZXRUYWJsZS50YWJsZU5hbWV9JyxcbiAgICAgICAgICAgICAgICAgICAgS2V5OiB7IHVzZXJJZCwgcHJlc2V0SWQgfSxcbiAgICAgICAgICAgICAgICAgICAgVXBkYXRlRXhwcmVzc2lvbjogJ1NFVCBmaWxlU2l6ZSA9IDpzaXplLCBmaWxlVXJsID0gOnVybCwgdXBkYXRlZEF0ID0gOnRpbWVzdGFtcCcsXG4gICAgICAgICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAnOnNpemUnOiBzaXplLFxuICAgICAgICAgICAgICAgICAgICAgICc6dXJsJzogXFxgczM6Ly9cXCR7YnVja2V0fS9cXCR7a2V5fVxcYCxcbiAgICAgICAgICAgICAgICAgICAgICAnOnRpbWVzdGFtcCc6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSBwcmVzZXQgbWV0YWRhdGE6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAgfTtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJFU0VUX1RBQkxFX05BTUU6IHRoaXMucHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIFMzIHByb2Nlc3NvclxuICAgIHRoaXMucHJlc2V0VGFibGUuZ3JhbnRXcml0ZURhdGEoczNQcm9jZXNzb3JGdW5jdGlvbik7XG5cbiAgICAvLyBTMyBldmVudCBub3RpZmljYXRpb25zXG4gICAgdGhpcy5wcmVzZXRCdWNrZXQuYWRkRXZlbnROb3RpZmljYXRpb24oXG4gICAgICBzMy5FdmVudFR5cGUuT0JKRUNUX0NSRUFURUQsXG4gICAgICBuZXcgczNuLkxhbWJkYURlc3RpbmF0aW9uKHMzUHJvY2Vzc29yRnVuY3Rpb24pXG4gICAgKTtcblxuICAgIC8vIE91dHB1dCBpbXBvcnRhbnQgdmFsdWVzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Nlc3Npb25UYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTZXNzaW9uIER5bmFtb0RCIHRhYmxlIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqU2Vzc2lvblRhYmxlLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmVzZXRUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcmVzZXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByZXNldCBEeW5hbW9EQiB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalByZXNldFRhYmxlLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmVzZXRCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJlc2V0QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByZXNldCBTMyBidWNrZXQgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgVmpQcmVzZXRCdWNrZXQtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuYmFja3VwQnVja2V0KSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmFja3VwQnVja2V0TmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYmFja3VwQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQmFja3VwIFMzIGJ1Y2tldCBuYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYFZqQmFja3VwQnVja2V0LSR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSJdfQ==