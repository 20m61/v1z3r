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
exports.VjStorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3n = __importStar(require("aws-cdk-lib/aws-s3-notifications"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLXN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMsc0VBQXdEO0FBQ3hELCtEQUFpRDtBQUNqRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBZTFELE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNCLFlBQVksQ0FBaUI7SUFDN0IsV0FBVyxDQUFpQjtJQUM1QixZQUFZLENBQVk7SUFDeEIsWUFBWSxDQUFhO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFaEMsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDM0QsU0FBUyxFQUFFLGVBQWUsS0FBSyxFQUFFO1lBQ2pDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELG1CQUFtQixFQUFFLEtBQUs7WUFDMUIsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxZQUFZO1lBQ3hDLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFD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Q0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVU7WUFDbkMsV0FBVyxFQUFFLHVCQUF1QjtZQUNwQyxVQUFVLEVBQUUsa0JBQWtCLEtBQUssRUFBRTtTQUN0QyxDQUFDLENBQUM7UUFFSCxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN0QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO2dCQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVO2dCQUNuQyxXQUFXLEVBQUUsdUJBQXVCO2dCQUNwQyxVQUFVLEVBQUUsa0JBQWtCLEtBQUssRUFBRTthQUN0QyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBMVNELHdDQTBTQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzbiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtbm90aWZpY2F0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWalN0b3JhZ2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgY29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgVmpTdG9yYWdlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgc2Vzc2lvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHByZXNldEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYmFja3VwQnVja2V0PzogczMuQnVja2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWalN0b3JhZ2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBjb25maWcgfSA9IHByb3BzO1xuXG4gICAgLy8gU2Vzc2lvbiBtYW5hZ2VtZW50IHRhYmxlXG4gICAgdGhpcy5zZXNzaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Nlc3Npb25UYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYHZqLXNlc3Npb25zLSR7c3RhZ2V9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc2Vzc2lvbklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogY29uZmlnLmVuYWJsZUJhY2t1cCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgICB0YWdzOiB7XG4gICAgICAgIE5hbWU6IGBWSiBTZXNzaW9ucyBUYWJsZSAtICR7c3RhZ2V9YCxcbiAgICAgICAgUHVycG9zZTogJ1JlYWwtdGltZSBzZXNzaW9uIG1hbmFnZW1lbnQnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIHNlc3Npb25zIGJ5IHN0YXR1c1xuICAgIHRoaXMuc2Vzc2lvblRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1N0YXR1c0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc3RhdHVzJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUHJlc2V0IG1hbmFnZW1lbnQgdGFibGVcbiAgICB0aGlzLnByZXNldFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQcmVzZXRUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYHZqLXByZXNldHMtJHtzdGFnZX1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdwcmVzZXRJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZW5hYmxlQmFja3VwLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB0YWdzOiB7XG4gICAgICAgIE5hbWU6IGBWSiBQcmVzZXRzIFRhYmxlIC0gJHtzdGFnZX1gLFxuICAgICAgICBQdXJwb3NlOiAnVXNlciBwcmVzZXQgc3RvcmFnZSBhbmQgbWFuYWdlbWVudCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgcHVibGljIHByZXNldHNcbiAgICB0aGlzLnByZXNldFRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1B1YmxpY1ByZXNldHNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2lzUHVibGljJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndXBkYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc2VhcmNoaW5nIHByZXNldHMgYnkgdGFnc1xuICAgIHRoaXMucHJlc2V0VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVGFnc0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndGFnJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndXBkYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBwcmVzZXQgZmlsZXMgYW5kIG1lZGlhIGFzc2V0c1xuICAgIHRoaXMucHJlc2V0QnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUHJlc2V0QnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLXByZXNldHMtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IGNvbmZpZy5lbmFibGVCYWNrdXAsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uVG9JQScsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICAuLi4oc3RhZ2UgIT09ICdwcm9kJyA/IFt7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXG4gICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgfV0gOiBbXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIHRhZ3M6IHtcbiAgICAgICAgTmFtZTogYFZKIFByZXNldHMgQnVja2V0IC0gJHtzdGFnZX1gLFxuICAgICAgICBQdXJwb3NlOiAnUHJlc2V0IGZpbGVzIGFuZCBtZWRpYSBzdG9yYWdlJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDT1JTIGNvbmZpZ3VyYXRpb24gZm9yIGRpcmVjdCB1cGxvYWRzIGZyb20gYnJvd3NlclxuICAgIHRoaXMucHJlc2V0QnVja2V0LmFkZENvcnNSdWxlKHtcbiAgICAgIGFsbG93ZWRPcmlnaW5zOiBzdGFnZSA9PT0gJ3Byb2QnIFxuICAgICAgICA/IFtgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWBdXG4gICAgICAgIDogWydodHRwOi8vbG9jYWxob3N0OjMwMDAnLCAnaHR0cDovL2xvY2FsaG9zdDozMDAxJ10sXG4gICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NULCBzMy5IdHRwTWV0aG9kcy5ERUxFVEVdLFxuICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgbWF4QWdlOiAzMDAwLFxuICAgIH0pO1xuXG4gICAgLy8gQmFja3VwIGJ1Y2tldCAob25seSBpbiBwcm9kdWN0aW9uKVxuICAgIGlmIChjb25maWcuZW5hYmxlQmFja3VwICYmIHN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIHRoaXMuYmFja3VwQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQmFja3VwQnVja2V0Jywge1xuICAgICAgICBidWNrZXROYW1lOiBgdmotYmFja3Vwcy0ke3N0YWdlfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdEZWxldGVPbGRCYWNrdXBzJyxcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDkwKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvR2xhY2llcicsXG4gICAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgTmFtZTogYFZKIEJhY2t1cHMgQnVja2V0IC0gJHtzdGFnZX1gLFxuICAgICAgICAgIFB1cnBvc2U6ICdBdXRvbWF0ZWQgYmFja3VwcyBhbmQgZGlzYXN0ZXIgcmVjb3ZlcnknLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgYXV0b21hdGVkIGJhY2t1cHNcbiAgICAgIGNvbnN0IGJhY2t1cEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQmFja3VwRnVuY3Rpb24nLCB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIoKTtcbiAgICAgICAgICBjb25zdCBzMyA9IG5ldyBBV1MuUzMoKTtcbiAgICAgICAgICBcbiAgICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy8gQmFja3VwIER5bmFtb0RCIHRhYmxlc1xuICAgICAgICAgICAgICBjb25zdCB0YWJsZXMgPSBbJyR7dGhpcy5zZXNzaW9uVGFibGUudGFibGVOYW1lfScsICcke3RoaXMucHJlc2V0VGFibGUudGFibGVOYW1lfSddO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB0YWJsZU5hbWUgb2YgdGFibGVzKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIuY3JlYXRlQmFja3VwKHtcbiAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgQmFja3VwTmFtZTogXFxgXFwke3RhYmxlTmFtZX0tYmFja3VwLVxcJHt0aW1lc3RhbXB9XFxgXG4gICAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQmFja3VwIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwLCBib2R5OiAnQmFja3VwIGNvbXBsZXRlZCcgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0JhY2t1cCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICBgKSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBCQUNLVVBfQlVDS0VUOiB0aGlzLmJhY2t1cEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICB9LFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICB9KTtcblxuICAgICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIGJhY2t1cCBmdW5jdGlvblxuICAgICAgdGhpcy5zZXNzaW9uVGFibGUuZ3JhbnRCYWNrdXBBY2Nlc3MoYmFja3VwRnVuY3Rpb24pO1xuICAgICAgdGhpcy5wcmVzZXRUYWJsZS5ncmFudEJhY2t1cEFjY2VzcyhiYWNrdXBGdW5jdGlvbik7XG4gICAgICB0aGlzLmJhY2t1cEJ1Y2tldC5ncmFudFdyaXRlKGJhY2t1cEZ1bmN0aW9uKTtcblxuICAgICAgLy8gU2NoZWR1bGUgZGFpbHkgYmFja3Vwc1xuICAgICAgY29uc3QgYmFja3VwUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQmFja3VwU2NoZWR1bGUnLCB7XG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7IGhvdXI6ICcyJywgbWludXRlOiAnMCcgfSksIC8vIDIgQU0gZGFpbHlcbiAgICAgICAgZGVzY3JpcHRpb246ICdEYWlseSBiYWNrdXAgb2YgVkogYXBwbGljYXRpb24gZGF0YScsXG4gICAgICB9KTtcblxuICAgICAgYmFja3VwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYmFja3VwRnVuY3Rpb24pKTtcbiAgICB9XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIFMzIGV2ZW50IHByb2Nlc3NpbmdcbiAgICBjb25zdCBzM1Byb2Nlc3NvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUzNQcm9jZXNzb3JGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUzMgZXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiBldmVudC5SZWNvcmRzKSB7XG4gICAgICAgICAgICBpZiAocmVjb3JkLmV2ZW50TmFtZS5zdGFydHNXaXRoKCdPYmplY3RDcmVhdGVkJykpIHtcbiAgICAgICAgICAgICAgY29uc3QgYnVja2V0ID0gcmVjb3JkLnMzLmJ1Y2tldC5uYW1lO1xuICAgICAgICAgICAgICBjb25zdCBrZXkgPSByZWNvcmQuczMub2JqZWN0LmtleTtcbiAgICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IHJlY29yZC5zMy5vYmplY3Quc2l6ZTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIFVwZGF0ZSBwcmVzZXQgbWV0YWRhdGEgaW4gRHluYW1vREJcbiAgICAgICAgICAgICAgY29uc3Qga2V5UGFydHMgPSBrZXkuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgaWYgKGtleVBhcnRzLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXNlcklkID0ga2V5UGFydHNbMF07XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlc2V0SWQgPSBrZXlQYXJ0c1sxXS5yZXBsYWNlKC9cXFxcLlteLy5dKyQvLCAnJyk7IC8vIFJlbW92ZSBleHRlbnNpb25cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIudXBkYXRlKHtcbiAgICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLnByZXNldFRhYmxlLnRhYmxlTmFtZX0nLFxuICAgICAgICAgICAgICAgICAgICBLZXk6IHsgdXNlcklkLCBwcmVzZXRJZCB9LFxuICAgICAgICAgICAgICAgICAgICBVcGRhdGVFeHByZXNzaW9uOiAnU0VUIGZpbGVTaXplID0gOnNpemUsIGZpbGVVcmwgPSA6dXJsLCB1cGRhdGVkQXQgPSA6dGltZXN0YW1wJyxcbiAgICAgICAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICc6c2l6ZSc6IHNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgJzp1cmwnOiBcXGBzMzovL1xcJHtidWNrZXR9L1xcJHtrZXl9XFxgLFxuICAgICAgICAgICAgICAgICAgICAgICc6dGltZXN0YW1wJzogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gdXBkYXRlIHByZXNldCBtZXRhZGF0YTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDIwMCB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQUkVTRVRfVEFCTEVfTkFNRTogdGhpcy5wcmVzZXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gUzMgcHJvY2Vzc29yXG4gICAgdGhpcy5wcmVzZXRUYWJsZS5ncmFudFdyaXRlRGF0YShzM1Byb2Nlc3NvckZ1bmN0aW9uKTtcblxuICAgIC8vIFMzIGV2ZW50IG5vdGlmaWNhdGlvbnNcbiAgICB0aGlzLnByZXNldEJ1Y2tldC5hZGRFdmVudE5vdGlmaWNhdGlvbihcbiAgICAgIHMzLkV2ZW50VHlwZS5PQkpFQ1RfQ1JFQVRFRCxcbiAgICAgIG5ldyBzM24uTGFtYmRhRGVzdGluYXRpb24oczNQcm9jZXNzb3JGdW5jdGlvbilcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0IGltcG9ydGFudCB2YWx1ZXNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2Vzc2lvblRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Nlc3Npb24gRHluYW1vREIgdGFibGUgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgVmpTZXNzaW9uVGFibGUtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByZXNldFRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJlc2V0IER5bmFtb0RCIHRhYmxlIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqUHJlc2V0VGFibGUtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByZXNldEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcmVzZXRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJlc2V0IFMzIGJ1Y2tldCBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalByZXNldEJ1Y2tldC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5iYWNrdXBCdWNrZXQpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCYWNrdXBCdWNrZXROYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iYWNrdXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCYWNrdXAgUzMgYnVja2V0IG5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgVmpCYWNrdXBCdWNrZXQtJHtzdGFnZX1gLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59Il19