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
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: config.enableBackup,
            },
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
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: config.enableBackup,
            },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLXN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELHVEQUF5QztBQUN6QyxzRUFBd0Q7QUFDeEQsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQseURBQTJDO0FBYzNDLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNCLFlBQVksQ0FBaUI7SUFDN0IsV0FBVyxDQUFpQjtJQUM1QixZQUFZLENBQVk7SUFDeEIsWUFBWSxDQUFhO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFaEMsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDM0QsU0FBUyxFQUFFLGVBQWUsS0FBSyxFQUFFO1lBQ2pDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELG1CQUFtQixFQUFFLEtBQUs7WUFDMUIsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELGdDQUFnQyxFQUFFO2dCQUNoQywwQkFBMEIsRUFBRSxNQUFNLENBQUMsWUFBWTthQUNoRDtZQUNELGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3RGLE1BQU0sRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLGtCQUFrQjtTQUNuRCxDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsdUJBQXVCLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDM0UsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsOEJBQThCLENBQUMsQ0FBQztRQUU5RSwwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsQ0FBQztZQUN4QyxTQUFTLEVBQUUsYUFBYTtZQUN4QixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztTQUNGLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3pELFNBQVMsRUFBRSxjQUFjLEtBQUssRUFBRTtZQUNoQyxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxnQ0FBZ0MsRUFBRTtnQkFDaEMsMEJBQTBCLEVBQUUsTUFBTSxDQUFDLFlBQVk7YUFDaEQ7WUFDRCxhQUFhLEVBQUUsS0FBSyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN2RixDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsc0JBQXNCLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDekUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsb0NBQW9DLENBQUMsQ0FBQztRQUVuRixzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQztZQUN2QyxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztTQUNGLENBQUMsQ0FBQztRQUVILHdDQUF3QztRQUN4QyxJQUFJLENBQUMsV0FBVyxDQUFDLHVCQUF1QixDQUFDO1lBQ3ZDLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsS0FBSztnQkFDWCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsOENBQThDO1FBQzlDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEQsVUFBVSxFQUFFLGNBQWMsS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDakQsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1lBQzFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ2pELFNBQVMsRUFBRSxNQUFNLENBQUMsWUFBWTtZQUM5QixjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsRUFBRSxFQUFFLGtDQUFrQztvQkFDdEMsbUNBQW1DLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUMxRDtnQkFDRDtvQkFDRSxFQUFFLEVBQUUsZ0JBQWdCO29CQUNwQixXQUFXLEVBQUU7d0JBQ1g7NEJBQ0UsWUFBWSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsaUJBQWlCOzRCQUMvQyxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO3lCQUN2QztxQkFDRjtpQkFDRjtnQkFDRCxHQUFHLENBQUMsS0FBSyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDdEIsRUFBRSxFQUFFLG1CQUFtQjt3QkFDdkIsMkJBQTJCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3FCQUNsRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUNUO1lBQ0QsYUFBYSxFQUFFLEtBQUssS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDdEYsaUJBQWlCLEVBQUUsS0FBSyxLQUFLLE1BQU07U0FDcEMsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLHVCQUF1QixLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQzNFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGdDQUFnQyxDQUFDLENBQUM7UUFFaEYscURBQXFEO1FBQ3JELElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDO1lBQzVCLGNBQWMsRUFBRSxLQUFLLEtBQUssTUFBTTtnQkFDOUIsQ0FBQyxDQUFDLENBQUMsV0FBVyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2xDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixFQUFFLHVCQUF1QixDQUFDO1lBQ3RELGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO1lBQ3BHLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNyQixNQUFNLEVBQUUsSUFBSTtTQUNiLENBQUMsQ0FBQztRQUVILHFDQUFxQztRQUNyQyxJQUFJLE1BQU0sQ0FBQyxZQUFZLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRTtZQUMzQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO2dCQUN0RCxVQUFVLEVBQUUsY0FBYyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDakQsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO2dCQUMxQyxpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztnQkFDakQsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLGNBQWMsRUFBRTtvQkFDZDt3QkFDRSxFQUFFLEVBQUUsa0JBQWtCO3dCQUN0QixVQUFVLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO3FCQUNsQztvQkFDRDt3QkFDRSxFQUFFLEVBQUUscUJBQXFCO3dCQUN6QixXQUFXLEVBQUU7NEJBQ1g7Z0NBQ0UsWUFBWSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTztnQ0FDckMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs2QkFDdkM7eUJBQ0Y7cUJBQ0Y7aUJBQ0Y7Z0JBQ0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUN4QyxDQUFDLENBQUM7WUFFSCwwQkFBMEI7WUFDMUIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsdUJBQXVCLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0UsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUseUNBQXlDLENBQUMsQ0FBQztZQUV6Rix3Q0FBd0M7WUFDeEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtnQkFDakUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztnQkFDbkMsT0FBTyxFQUFFLGVBQWU7Z0JBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7OztpQ0FVSixJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVM7Ozs7Ozs7Ozs7Ozs7Ozs7U0FnQnBGLENBQUM7Z0JBQ0YsV0FBVyxFQUFFO29CQUNYLGFBQWEsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVU7aUJBQzVDO2dCQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7YUFDbEMsQ0FBQyxDQUFDO1lBRUgsd0NBQXdDO1lBQ3hDLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2hELElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQy9DLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRTdDLG9DQUFvQztZQUNwQyxjQUFjLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztnQkFDckQsT0FBTyxFQUFFO29CQUNQLHVCQUF1QjtvQkFDdkIseUJBQXlCO29CQUN6QixzQkFBc0I7aUJBQ3ZCO2dCQUNELFNBQVMsRUFBRTtvQkFDVCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVE7b0JBQzFCLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUTtpQkFDMUI7YUFDRixDQUFDLENBQUMsQ0FBQztZQUVKLHlCQUF5QjtZQUN6QixNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO2dCQUN6RCxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQztnQkFDMUQsV0FBVyxFQUFFLHFDQUFxQzthQUNuRCxDQUFDLENBQUM7WUFFSCxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1NBQ2xFO1FBRUQsMENBQTBDO1FBQzFDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUMzRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2tDQXFCRCxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVM7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQWtCckQsQ0FBQztZQUNGLFdBQVcsRUFBRTtnQkFDWCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVM7YUFDOUM7U0FDRixDQUFDLENBQUM7UUFFSCxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUVyRCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLFlBQVksQ0FBQyxvQkFBb0IsQ0FDcEMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQzNCLElBQUksR0FBRyxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLENBQy9DLENBQUM7UUFFRiwwQkFBMEI7UUFDMUIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTO1lBQ2xDLFdBQVcsRUFBRSw2QkFBNkI7WUFDMUMsVUFBVSxFQUFFLGtCQUFrQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTO1lBQ2pDLFdBQVcsRUFBRSw0QkFBNEI7WUFDekMsVUFBVSxFQUFFLGlCQUFpQixLQUFLLEVBQUU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVO1lBQ25DLFdBQVcsRUFBRSx1QkFBdUI7WUFDcEMsVUFBVSxFQUFFLGtCQUFrQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVU7Z0JBQ25DLFdBQVcsRUFBRSx1QkFBdUI7Z0JBQ3BDLFVBQVUsRUFBRSxrQkFBa0IsS0FBSyxFQUFFO2FBQ3RDLENBQUMsQ0FBQztTQUNKO0lBQ0gsQ0FBQztDQUNGO0FBM1RELHdDQTJUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzbiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtbm90aWZpY2F0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWalN0b3JhZ2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgVmpTdG9yYWdlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgc2Vzc2lvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYmFja3VwQnVja2V0PzogczMuQnVja2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWalN0b3JhZ2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBjb25maWcgfSA9IHByb3BzO1xuXG4gICAgLy8gU2Vzc2lvbiBtYW5hZ2VtZW50IHRhYmxlXG4gICAgdGhpcy5zZXNzaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Nlc3Npb25UYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYHZqLXNlc3Npb25zLSR7c3RhZ2V9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc2Vzc2lvbklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IGNvbmZpZy5lbmFibGVCYWNrdXAsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIGFmdGVyIGNyZWF0aW9uXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5zZXNzaW9uVGFibGUpLmFkZCgnTmFtZScsIGBWSiBTZXNzaW9ucyBUYWJsZSAtICR7c3RhZ2V9YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5zZXNzaW9uVGFibGUpLmFkZCgnUHVycG9zZScsICdSZWFsLXRpbWUgc2Vzc2lvbiBtYW5hZ2VtZW50Jyk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBxdWVyeWluZyBzZXNzaW9ucyBieSBzdGF0dXNcbiAgICB0aGlzLnNlc3Npb25UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFByZXNldCBtYW5hZ2VtZW50IHRhYmxlXG4gICAgdGhpcy5wcmVzZXRUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJlc2V0VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGB2ai1wcmVzZXRzLSR7c3RhZ2V9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAncHJlc2V0SWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IGNvbmZpZy5lbmFibGVCYWNrdXAsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyBhZnRlciBjcmVhdGlvblxuICAgIGNkay5UYWdzLm9mKHRoaXMucHJlc2V0VGFibGUpLmFkZCgnTmFtZScsIGBWSiBQcmVzZXRzIFRhYmxlIC0gJHtzdGFnZX1gKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnByZXNldFRhYmxlKS5hZGQoJ1B1cnBvc2UnLCAnVXNlciBwcmVzZXQgc3RvcmFnZSBhbmQgbWFuYWdlbWVudCcpO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgcHVibGljIHByZXNldHNcbiAgICB0aGlzLnByZXNldFRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1B1YmxpY1ByZXNldHNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2lzUHVibGljJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndXBkYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc2VhcmNoaW5nIHByZXNldHMgYnkgdGFnc1xuICAgIHRoaXMucHJlc2V0VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVGFnc0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndGFnJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndXBkYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBwcmVzZXQgZmlsZXMgYW5kIG1lZGlhIGFzc2V0c1xuICAgIHRoaXMucHJlc2V0QnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUHJlc2V0QnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLXByZXNldHMtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IGNvbmZpZy5lbmFibGVCYWNrdXAsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uVG9JQScsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICAuLi4oc3RhZ2UgIT09ICdwcm9kJyA/IFt7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXG4gICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgfV0gOiBbXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIGFmdGVyIGNyZWF0aW9uXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5wcmVzZXRCdWNrZXQpLmFkZCgnTmFtZScsIGBWSiBQcmVzZXRzIEJ1Y2tldCAtICR7c3RhZ2V9YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5wcmVzZXRCdWNrZXQpLmFkZCgnUHVycG9zZScsICdQcmVzZXQgZmlsZXMgYW5kIG1lZGlhIHN0b3JhZ2UnKTtcblxuICAgIC8vIENPUlMgY29uZmlndXJhdGlvbiBmb3IgZGlyZWN0IHVwbG9hZHMgZnJvbSBicm93c2VyXG4gICAgdGhpcy5wcmVzZXRCdWNrZXQuYWRkQ29yc1J1bGUoe1xuICAgICAgYWxsb3dlZE9yaWdpbnM6IHN0YWdlID09PSAncHJvZCcgXG4gICAgICAgID8gW2BodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YF1cbiAgICAgICAgOiBbJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDEnXSxcbiAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1QsIHMzLkh0dHBNZXRob2RzLkRFTEVURV0sXG4gICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgfSk7XG5cbiAgICAvLyBCYWNrdXAgYnVja2V0IChvbmx5IGluIHByb2R1Y3Rpb24pXG4gICAgaWYgKGNvbmZpZy5lbmFibGVCYWNrdXAgJiYgc3RhZ2UgPT09ICdwcm9kJykge1xuICAgICAgdGhpcy5iYWNrdXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdCYWNrdXBCdWNrZXQnLCB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IGB2ai1iYWNrdXBzLSR7c3RhZ2V9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgICAgdmVyc2lvbmVkOiBmYWxzZSxcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ0RlbGV0ZU9sZEJhY2t1cHMnLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uVG9HbGFjaWVyJyxcbiAgICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIHRhZ3MgYWZ0ZXIgY3JlYXRpb25cbiAgICAgIGNkay5UYWdzLm9mKHRoaXMuYmFja3VwQnVja2V0KS5hZGQoJ05hbWUnLCBgVkogQmFja3VwcyBCdWNrZXQgLSAke3N0YWdlfWApO1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5iYWNrdXBCdWNrZXQpLmFkZCgnUHVycG9zZScsICdBdXRvbWF0ZWQgYmFja3VwcyBhbmQgZGlzYXN0ZXIgcmVjb3ZlcnknKTtcblxuICAgICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBhdXRvbWF0ZWQgYmFja3Vwc1xuICAgICAgY29uc3QgYmFja3VwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdCYWNrdXBGdW5jdGlvbicsIHtcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQigpO1xuICAgICAgICAgIGNvbnN0IHMzID0gbmV3IEFXUy5TMygpO1xuICAgICAgICAgIFxuICAgICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAvLyBCYWNrdXAgRHluYW1vREIgdGFibGVzXG4gICAgICAgICAgICAgIGNvbnN0IHRhYmxlcyA9IFsnJHt0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWV9JywgJyR7dGhpcy5wcmVzZXRUYWJsZS50YWJsZU5hbWV9J107XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlTmFtZSBvZiB0YWJsZXMpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5jcmVhdGVCYWNrdXAoe1xuICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICBCYWNrdXBOYW1lOiBcXGBcXCR7dGFibGVOYW1lfS1iYWNrdXAtXFwke3RpbWVzdGFtcH1cXGBcbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdCYWNrdXAgY29tcGxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAsIGJvZHk6ICdCYWNrdXAgY29tcGxldGVkJyB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQmFja3VwIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIGApLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIEJBQ0tVUF9CVUNLRVQ6IHRoaXMuYmFja3VwQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyBmb3IgYmFja3VwIGZ1bmN0aW9uXG4gICAgICB0aGlzLnNlc3Npb25UYWJsZS5ncmFudFJlYWREYXRhKGJhY2t1cEZ1bmN0aW9uKTtcbiAgICAgIHRoaXMucHJlc2V0VGFibGUuZ3JhbnRSZWFkRGF0YShiYWNrdXBGdW5jdGlvbik7XG4gICAgICB0aGlzLmJhY2t1cEJ1Y2tldC5ncmFudFdyaXRlKGJhY2t1cEZ1bmN0aW9uKTtcbiAgICAgIFxuICAgICAgLy8gR3JhbnQgRHluYW1vREIgYmFja3VwIHBlcm1pc3Npb25zXG4gICAgICBiYWNrdXBGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2R5bmFtb2RiOkNyZWF0ZUJhY2t1cCcsXG4gICAgICAgICAgJ2R5bmFtb2RiOkRlc2NyaWJlQmFja3VwJyxcbiAgICAgICAgICAnZHluYW1vZGI6TGlzdEJhY2t1cHMnXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHRoaXMuc2Vzc2lvblRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgIHRoaXMucHJlc2V0VGFibGUudGFibGVBcm5cbiAgICAgICAgXVxuICAgICAgfSkpO1xuXG4gICAgICAvLyBTY2hlZHVsZSBkYWlseSBiYWNrdXBzXG4gICAgICBjb25zdCBiYWNrdXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdCYWNrdXBTY2hlZHVsZScsIHtcbiAgICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHsgaG91cjogJzInLCBtaW51dGU6ICcwJyB9KSwgLy8gMiBBTSBkYWlseVxuICAgICAgICBkZXNjcmlwdGlvbjogJ0RhaWx5IGJhY2t1cCBvZiBWSiBhcHBsaWNhdGlvbiBkYXRhJyxcbiAgICAgIH0pO1xuXG4gICAgICBiYWNrdXBSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihiYWNrdXBGdW5jdGlvbikpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgUzMgZXZlbnQgcHJvY2Vzc2luZ1xuICAgIGNvbnN0IHMzUHJvY2Vzc29yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTM1Byb2Nlc3NvckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoKTtcbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdTMyBldmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgcmVjb3JkIG9mIGV2ZW50LlJlY29yZHMpIHtcbiAgICAgICAgICAgIGlmIChyZWNvcmQuZXZlbnROYW1lLnN0YXJ0c1dpdGgoJ09iamVjdENyZWF0ZWQnKSkge1xuICAgICAgICAgICAgICBjb25zdCBidWNrZXQgPSByZWNvcmQuczMuYnVja2V0Lm5hbWU7XG4gICAgICAgICAgICAgIGNvbnN0IGtleSA9IHJlY29yZC5zMy5vYmplY3Qua2V5O1xuICAgICAgICAgICAgICBjb25zdCBzaXplID0gcmVjb3JkLnMzLm9iamVjdC5zaXplO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gVXBkYXRlIHByZXNldCBtZXRhZGF0YSBpbiBEeW5hbW9EQlxuICAgICAgICAgICAgICBjb25zdCBrZXlQYXJ0cyA9IGtleS5zcGxpdCgnLycpO1xuICAgICAgICAgICAgICBpZiAoa2V5UGFydHMubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1c2VySWQgPSBrZXlQYXJ0c1swXTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVzZXRJZCA9IGtleVBhcnRzWzFdLnJlcGxhY2UoL1xcXFwuW14vLl0rJC8sICcnKTsgLy8gUmVtb3ZlIGV4dGVuc2lvblxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi51cGRhdGUoe1xuICAgICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6ICcke3RoaXMucHJlc2V0VGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICAgICAgICAgIEtleTogeyB1c2VySWQsIHByZXNldElkIH0sXG4gICAgICAgICAgICAgICAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdTRVQgZmlsZVNpemUgPSA6c2l6ZSwgZmlsZVVybCA9IDp1cmwsIHVwZGF0ZWRBdCA9IDp0aW1lc3RhbXAnLFxuICAgICAgICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJzpzaXplJzogc2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAnOnVybCc6IFxcYHMzOi8vXFwke2J1Y2tldH0vXFwke2tleX1cXGAsXG4gICAgICAgICAgICAgICAgICAgICAgJzp0aW1lc3RhbXAnOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgcHJlc2V0IG1ldGFkYXRhOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBSRVNFVF9UQUJMRV9OQU1FOiB0aGlzLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBTMyBwcm9jZXNzb3JcbiAgICB0aGlzLnByZXNldFRhYmxlLmdyYW50V3JpdGVEYXRhKHMzUHJvY2Vzc29yRnVuY3Rpb24pO1xuXG4gICAgLy8gUzMgZXZlbnQgbm90aWZpY2F0aW9uc1xuICAgIHRoaXMucHJlc2V0QnVja2V0LmFkZEV2ZW50Tm90aWZpY2F0aW9uKFxuICAgICAgczMuRXZlbnRUeXBlLk9CSkVDVF9DUkVBVEVELFxuICAgICAgbmV3IHMzbi5MYW1iZGFEZXN0aW5hdGlvbihzM1Byb2Nlc3NvckZ1bmN0aW9uKVxuICAgICk7XG5cbiAgICAvLyBPdXRwdXQgaW1wb3J0YW50IHZhbHVlc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZXNzaW9uVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2Vzc2lvbiBEeW5hbW9EQiB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalNlc3Npb25UYWJsZS0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJlc2V0VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmVzZXQgRHluYW1vREIgdGFibGUgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgVmpQcmVzZXRUYWJsZS0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJlc2V0QnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnByZXNldEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmVzZXQgUzMgYnVja2V0IG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqUHJlc2V0QnVja2V0LSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmJhY2t1cEJ1Y2tldCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JhY2t1cEJ1Y2tldE5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJhY2t1cEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JhY2t1cCBTMyBidWNrZXQgbmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGBWakJhY2t1cEJ1Y2tldC0ke3N0YWdlfWAsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0iXX0=