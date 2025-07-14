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
exports.VjLoggingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const kinesis = __importStar(require("aws-cdk-lib/aws-kinesis"));
const kinesisfirehose = __importStar(require("aws-cdk-lib/aws-kinesisfirehose"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const destinations = __importStar(require("aws-cdk-lib/aws-logs-destinations"));
class VjLoggingStack extends cdk.Stack {
    logsBucket;
    kinesisStream;
    firehoseDeliveryStream;
    constructor(scope, id, props) {
        super(scope, id, props);
        // ログ保存用S3バケット
        this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
            bucketName: `vj-app-logs-${props.stage}-${this.account}`,
            lifecycleRules: [
                {
                    id: 'LogsLifecycle',
                    enabled: true,
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30)
                        },
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90)
                        },
                        {
                            storageClass: s3.StorageClass.DEEP_ARCHIVE,
                            transitionAfter: cdk.Duration.days(365)
                        }
                    ],
                    expiration: cdk.Duration.days(2555) // 7年保持
                }
            ],
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false
        });
        // Kinesis Data Stream for real-time log processing
        this.kinesisStream = new kinesis.Stream(this, 'LogsStream', {
            streamName: `vj-app-logs-${props.stage}`,
            shardCount: props.stage === 'prod' ? 2 : 1,
            retentionPeriod: cdk.Duration.hours(24)
        });
        // IAM role for Kinesis Firehose
        const firehoseRole = new iam.Role(this, 'FirehoseRole', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
            inlinePolicies: {
                S3DeliveryPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                's3:PutObject',
                                's3:GetObject',
                                's3:ListBucket'
                            ],
                            resources: [
                                this.logsBucket.bucketArn,
                                `${this.logsBucket.bucketArn}/*`
                            ]
                        })
                    ]
                }),
                KinesisSourcePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'kinesis:DescribeStream',
                                'kinesis:GetShardIterator',
                                'kinesis:GetRecords'
                            ],
                            resources: [this.kinesisStream.streamArn]
                        })
                    ]
                }),
                CloudWatchLogsPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'logs:CreateLogGroup',
                                'logs:CreateLogStream',
                                'logs:PutLogEvents'
                            ],
                            resources: [
                                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/kinesisfirehose/*`
                            ]
                        })
                    ]
                })
            }
        });
        // ログ変換用Lambda関数
        const logTransformFunction = new lambda.Function(this, 'LogTransformFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const zlib = require('zlib');
        
        exports.handler = async (event) => {
          const output = [];
          
          for (const record of event.records) {
            try {
              // Base64デコード
              const payload = Buffer.from(record.data, 'base64');
              
              // Gzip展開（CloudWatch Logsからの場合）
              let logData;
              try {
                logData = JSON.parse(zlib.gunzipSync(payload).toString());
              } catch (e) {
                // Gzipでない場合は直接パース
                logData = JSON.parse(payload.toString());
              }
              
              // ログイベントを処理
              const processedEvents = logData.logEvents?.map(event => ({
                timestamp: new Date(event.timestamp).toISOString(),
                message: event.message,
                logGroup: logData.logGroup,
                logStream: logData.logStream,
                stage: '${props.stage}',
                application: 'vj-app'
              })) || [logData];
              
              // 各イベントを個別のレコードとして出力
              for (const eventData of processedEvents) {
                output.push({
                  recordId: record.recordId,
                  result: 'Ok',
                  data: Buffer.from(JSON.stringify(eventData) + '\\n').toString('base64')
                });
              }
              
            } catch (error) {
              console.error('Log processing error:', error);
              output.push({
                recordId: record.recordId,
                result: 'ProcessingFailed'
              });
            }
          }
          
          return { records: output };
        };
      `),
            timeout: cdk.Duration.minutes(1),
            environment: {
                STAGE: props.stage
            }
        });
        // Kinesis Data Firehose delivery stream
        this.firehoseDeliveryStream = new kinesisfirehose.CfnDeliveryStream(this, 'LogsDeliveryStream', {
            deliveryStreamName: `vj-app-logs-delivery-${props.stage}`,
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: this.kinesisStream.streamArn,
                roleArn: firehoseRole.roleArn
            },
            extendedS3DestinationConfiguration: {
                bucketArn: this.logsBucket.bucketArn,
                roleArn: firehoseRole.roleArn,
                prefix: 'logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
                errorOutputPrefix: 'errors/',
                bufferingHints: {
                    sizeInMBs: 5,
                    intervalInSeconds: 300 // 5分
                },
                compressionFormat: 'GZIP',
                processingConfiguration: {
                    enabled: true,
                    processors: [
                        {
                            type: 'Lambda',
                            parameters: [
                                {
                                    parameterName: 'LambdaArn',
                                    parameterValue: logTransformFunction.functionArn
                                }
                            ]
                        }
                    ]
                },
                cloudWatchLoggingOptions: {
                    enabled: true,
                    logGroupName: `/aws/kinesisfirehose/vj-app-logs-${props.stage}`
                }
            }
        });
        // Lambda関数にFirehose実行権限を付与
        logTransformFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['kinesis:*'],
            resources: [this.kinesisStream.streamArn]
        }));
        // 各Lambda関数のログをKinesisに送信
        props.lambdaFunctions.forEach((func, index) => {
            // CloudWatch Logs宛先設定
            const logDestination = new destinations.KinesisDestination(this.kinesisStream);
            // サブスクリプションフィルター
            new logs.SubscriptionFilter(this, `LogSubscription${index}`, {
                logGroup: func.logGroup,
                destination: logDestination,
                filterPattern: logs.FilterPattern.allEvents(),
                filterName: `vj-app-${props.stage}-${func.functionName}`
            });
            // 構造化ログ用の環境変数を追加
            func.addEnvironment('LOG_LEVEL', props.stage === 'prod' ? 'INFO' : 'DEBUG');
            func.addEnvironment('LOG_FORMAT', 'JSON');
            func.addEnvironment('APPLICATION_NAME', 'vj-app');
            func.addEnvironment('STAGE', props.stage);
        });
        // ログ監視用のCloudWatch Log Insights クエリを事前定義
        const logInsightsQueries = [
            {
                name: 'Error Analysis',
                query: `
          fields @timestamp, @message, @logStream
          | filter @message like /ERROR/
          | sort @timestamp desc
          | limit 100
        `
            },
            {
                name: 'Performance Analysis',
                query: `
          fields @timestamp, @duration, @requestId
          | filter @type = "REPORT"
          | sort @timestamp desc
          | stats avg(@duration), max(@duration), min(@duration) by bin(5m)
        `
            },
            {
                name: 'User Activity',
                query: `
          fields @timestamp, @message
          | filter @message like /user_action/
          | sort @timestamp desc
          | stats count() by bin(1h)
        `
            }
        ];
        // Outputs
        new cdk.CfnOutput(this, 'LogsBucketName', {
            value: this.logsBucket.bucketName,
            description: 'S3 bucket for log storage'
        });
        new cdk.CfnOutput(this, 'KinesisStreamName', {
            value: this.kinesisStream.streamName,
            description: 'Kinesis stream for real-time log processing'
        });
        new cdk.CfnOutput(this, 'LogInsightsUrl', {
            value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#logsV2:logs-insights`,
            description: 'CloudWatch Logs Insights Console URL'
        });
        logInsightsQueries.forEach((query, index) => {
            new cdk.CfnOutput(this, `LogInsightsQuery${index}`, {
                value: query.query.replace(/\s+/g, ' ').trim(),
                description: `Pre-defined query: ${query.name}`
            });
        });
        // Tags
        cdk.Tags.of(this).add('Application', 'v1z3r');
        cdk.Tags.of(this).add('Stage', props.stage);
    }
}
exports.VjLoggingStack = VjLoggingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotbG9nZ2luZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLWxvZ2dpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsMkRBQTZDO0FBQzdDLGlFQUFtRDtBQUNuRCxpRkFBbUU7QUFDbkUsdURBQXlDO0FBQ3pDLHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsZ0ZBQWtFO0FBUWxFLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNCLFVBQVUsQ0FBWTtJQUN0QixhQUFhLENBQWlCO0lBQzlCLHNCQUFzQixDQUFvQztJQUUxRSxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGNBQWM7UUFDZCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ2xELFVBQVUsRUFBRSxlQUFlLEtBQUssQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUN4RCxjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsRUFBRSxFQUFFLGVBQWU7b0JBQ25CLE9BQU8sRUFBRSxJQUFJO29CQUNiLFdBQVcsRUFBRTt3QkFDWDs0QkFDRSxZQUFZLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxpQkFBaUI7NEJBQy9DLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7eUJBQ3ZDO3dCQUNEOzRCQUNFLFlBQVksRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU87NEJBQ3JDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7eUJBQ3ZDO3dCQUNEOzRCQUNFLFlBQVksRUFBRSxFQUFFLENBQUMs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S0FBSyxFQUFFLEVBQUU7Z0JBQ2xELEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFO2dCQUM5QyxXQUFXLEVBQUUsc0JBQXNCLEtBQUssQ0FBQyxJQUFJLEVBQUU7YUFDaEQsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUF4UkQsd0NBd1JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMga2luZXNpcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta2luZXNpcyc7XG5pbXBvcnQgKiBhcyBraW5lc2lzZmlyZWhvc2UgZnJvbSAnYXdzLWNkay1saWIvYXdzLWtpbmVzaXNmaXJlaG9zZSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZGVzdGluYXRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzLWRlc3RpbmF0aW9ucyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWakxvZ2dpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdO1xufVxuXG5leHBvcnQgY2xhc3MgVmpMb2dnaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgbG9nc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkga2luZXNpc1N0cmVhbToga2luZXNpcy5TdHJlYW07XG4gIHB1YmxpYyByZWFkb25seSBmaXJlaG9zZURlbGl2ZXJ5U3RyZWFtOiBraW5lc2lzZmlyZWhvc2UuQ2ZuRGVsaXZlcnlTdHJlYW07XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqTG9nZ2luZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOODreOCsOS/neWtmOeUqFMz44OQ44Kx44OD44OIXG4gICAgdGhpcy5sb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnTG9nc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGB2ai1hcHAtbG9ncy0ke3Byb3BzLnN0YWdlfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnTG9nc0xpZmVjeWNsZScsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMClcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5ERUVQX0FSQ0hJVkUsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzY1KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIF0sXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMjU1NSkgLy8gN+W5tOS/neaMgVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogZmFsc2VcbiAgICB9KTtcblxuICAgIC8vIEtpbmVzaXMgRGF0YSBTdHJlYW0gZm9yIHJlYWwtdGltZSBsb2cgcHJvY2Vzc2luZ1xuICAgIHRoaXMua2luZXNpc1N0cmVhbSA9IG5ldyBraW5lc2lzLlN0cmVhbSh0aGlzLCAnTG9nc1N0cmVhbScsIHtcbiAgICAgIHN0cmVhbU5hbWU6IGB2ai1hcHAtbG9ncy0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICBzaGFyZENvdW50OiBwcm9wcy5zdGFnZSA9PT0gJ3Byb2QnID8gMiA6IDEsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygyNClcbiAgICB9KTtcblxuICAgIC8vIElBTSByb2xlIGZvciBLaW5lc2lzIEZpcmVob3NlXG4gICAgY29uc3QgZmlyZWhvc2VSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdGaXJlaG9zZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZmlyZWhvc2UuYW1hem9uYXdzLmNvbScpLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgUzNEZWxpdmVyeVBvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCdcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgdGhpcy5sb2dzQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgICBgJHt0aGlzLmxvZ3NCdWNrZXQuYnVja2V0QXJufS8qYFxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIF1cbiAgICAgICAgfSksXG4gICAgICAgIEtpbmVzaXNTb3VyY2VQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2tpbmVzaXM6RGVzY3JpYmVTdHJlYW0nLFxuICAgICAgICAgICAgICAgICdraW5lc2lzOkdldFNoYXJkSXRlcmF0b3InLFxuICAgICAgICAgICAgICAgICdraW5lc2lzOkdldFJlY29yZHMnXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW3RoaXMua2luZXNpc1N0cmVhbS5zdHJlYW1Bcm5dXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIF1cbiAgICAgICAgfSksXG4gICAgICAgIENsb3VkV2F0Y2hMb2dzUG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3Mva2luZXNpc2ZpcmVob3NlLypgXG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgXVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g44Ot44Kw5aSJ5o+b55SoTGFtYmRh6Zai5pWwXG4gICAgY29uc3QgbG9nVHJhbnNmb3JtRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMb2dUcmFuc2Zvcm1GdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHpsaWIgPSByZXF1aXJlKCd6bGliJyk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCBvdXRwdXQgPSBbXTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiBldmVudC5yZWNvcmRzKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAvLyBCYXNlNjTjg4fjgrPjg7zjg4lcbiAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEJ1ZmZlci5mcm9tKHJlY29yZC5kYXRhLCAnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBHemlw5bGV6ZaL77yIQ2xvdWRXYXRjaCBMb2dz44GL44KJ44Gu5aC05ZCI77yJXG4gICAgICAgICAgICAgIGxldCBsb2dEYXRhO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ0RhdGEgPSBKU09OLnBhcnNlKHpsaWIuZ3VuemlwU3luYyhwYXlsb2FkKS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIEd6aXDjgafjgarjgYTloLTlkIjjga/nm7TmjqXjg5Hjg7zjgrlcbiAgICAgICAgICAgICAgICBsb2dEYXRhID0gSlNPTi5wYXJzZShwYXlsb2FkLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyDjg63jgrDjgqTjg5njg7Pjg4jjgpLlh6bnkIZcbiAgICAgICAgICAgICAgY29uc3QgcHJvY2Vzc2VkRXZlbnRzID0gbG9nRGF0YS5sb2dFdmVudHM/Lm1hcChldmVudCA9PiAoe1xuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoZXZlbnQudGltZXN0YW1wKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGV2ZW50Lm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgbG9nR3JvdXA6IGxvZ0RhdGEubG9nR3JvdXAsXG4gICAgICAgICAgICAgICAgbG9nU3RyZWFtOiBsb2dEYXRhLmxvZ1N0cmVhbSxcbiAgICAgICAgICAgICAgICBzdGFnZTogJyR7cHJvcHMuc3RhZ2V9JyxcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbjogJ3ZqLWFwcCdcbiAgICAgICAgICAgICAgfSkpIHx8IFtsb2dEYXRhXTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOWQhOOCpOODmeODs+ODiOOCkuWAi+WIpeOBruODrOOCs+ODvOODieOBqOOBl+OBpuWHuuWKm1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGV2ZW50RGF0YSBvZiBwcm9jZXNzZWRFdmVudHMpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaCh7XG4gICAgICAgICAgICAgICAgICByZWNvcmRJZDogcmVjb3JkLnJlY29yZElkLFxuICAgICAgICAgICAgICAgICAgcmVzdWx0OiAnT2snLFxuICAgICAgICAgICAgICAgICAgZGF0YTogQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkoZXZlbnREYXRhKSArICdcXFxcbicpLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTG9nIHByb2Nlc3NpbmcgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgICBvdXRwdXQucHVzaCh7XG4gICAgICAgICAgICAgICAgcmVjb3JkSWQ6IHJlY29yZC5yZWNvcmRJZCxcbiAgICAgICAgICAgICAgICByZXN1bHQ6ICdQcm9jZXNzaW5nRmFpbGVkJ1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHsgcmVjb3Jkczogb3V0cHV0IH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RBR0U6IHByb3BzLnN0YWdlXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBLaW5lc2lzIERhdGEgRmlyZWhvc2UgZGVsaXZlcnkgc3RyZWFtXG4gICAgdGhpcy5maXJlaG9zZURlbGl2ZXJ5U3RyZWFtID0gbmV3IGtpbmVzaXNmaXJlaG9zZS5DZm5EZWxpdmVyeVN0cmVhbSh0aGlzLCAnTG9nc0RlbGl2ZXJ5U3RyZWFtJywge1xuICAgICAgZGVsaXZlcnlTdHJlYW1OYW1lOiBgdmotYXBwLWxvZ3MtZGVsaXZlcnktJHtwcm9wcy5zdGFnZX1gLFxuICAgICAgZGVsaXZlcnlTdHJlYW1UeXBlOiAnS2luZXNpc1N0cmVhbUFzU291cmNlJyxcbiAgICAgIGtpbmVzaXNTdHJlYW1Tb3VyY2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIGtpbmVzaXNTdHJlYW1Bcm46IHRoaXMua2luZXNpc1N0cmVhbS5zdHJlYW1Bcm4sXG4gICAgICAgIHJvbGVBcm46IGZpcmVob3NlUm9sZS5yb2xlQXJuXG4gICAgICB9LFxuICAgICAgZXh0ZW5kZWRTM0Rlc3RpbmF0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICBidWNrZXRBcm46IHRoaXMubG9nc0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgIHJvbGVBcm46IGZpcmVob3NlUm9sZS5yb2xlQXJuLFxuICAgICAgICBwcmVmaXg6ICdsb2dzL3llYXI9IXt0aW1lc3RhbXA6eXl5eX0vbW9udGg9IXt0aW1lc3RhbXA6TU19L2RheT0he3RpbWVzdGFtcDpkZH0vaG91cj0he3RpbWVzdGFtcDpISH0vJyxcbiAgICAgICAgZXJyb3JPdXRwdXRQcmVmaXg6ICdlcnJvcnMvJyxcbiAgICAgICAgYnVmZmVyaW5nSGludHM6IHtcbiAgICAgICAgICBzaXplSW5NQnM6IDUsXG4gICAgICAgICAgaW50ZXJ2YWxJblNlY29uZHM6IDMwMCAvLyA15YiGXG4gICAgICAgIH0sXG4gICAgICAgIGNvbXByZXNzaW9uRm9ybWF0OiAnR1pJUCcsXG4gICAgICAgIHByb2Nlc3NpbmdDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBwcm9jZXNzb3JzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHR5cGU6ICdMYW1iZGEnLFxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyTmFtZTogJ0xhbWJkYUFybicsXG4gICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJWYWx1ZTogbG9nVHJhbnNmb3JtRnVuY3Rpb24uZnVuY3Rpb25Bcm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgICAgIGNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uczoge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9raW5lc2lzZmlyZWhvc2UvdmotYXBwLWxvZ3MtJHtwcm9wcy5zdGFnZX1gXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYemWouaVsOOBq0ZpcmVob3Nl5a6f6KGM5qip6ZmQ44KS5LuY5LiOXG4gICAgbG9nVHJhbnNmb3JtRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsna2luZXNpczoqJ10sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLmtpbmVzaXNTdHJlYW0uc3RyZWFtQXJuXVxuICAgIH0pKTtcblxuICAgIC8vIOWQhExhbWJkYemWouaVsOOBruODreOCsOOCkktpbmVzaXPjgavpgIHkv6FcbiAgICBwcm9wcy5sYW1iZGFGdW5jdGlvbnMuZm9yRWFjaCgoZnVuYywgaW5kZXgpID0+IHtcbiAgICAgIC8vIENsb3VkV2F0Y2ggTG9nc+Wum+WFiOioreWumlxuICAgICAgY29uc3QgbG9nRGVzdGluYXRpb24gPSBuZXcgZGVzdGluYXRpb25zLktpbmVzaXNEZXN0aW5hdGlvbih0aGlzLmtpbmVzaXNTdHJlYW0pO1xuICAgICAgXG4gICAgICAvLyDjgrXjg5bjgrnjgq/jg6rjg5fjgrfjg6fjg7Pjg5XjgqPjg6vjgr/jg7xcbiAgICAgIG5ldyBsb2dzLlN1YnNjcmlwdGlvbkZpbHRlcih0aGlzLCBgTG9nU3Vic2NyaXB0aW9uJHtpbmRleH1gLCB7XG4gICAgICAgIGxvZ0dyb3VwOiBmdW5jLmxvZ0dyb3VwLFxuICAgICAgICBkZXN0aW5hdGlvbjogbG9nRGVzdGluYXRpb24sXG4gICAgICAgIGZpbHRlclBhdHRlcm46IGxvZ3MuRmlsdGVyUGF0dGVybi5hbGxFdmVudHMoKSxcbiAgICAgICAgZmlsdGVyTmFtZTogYHZqLWFwcC0ke3Byb3BzLnN0YWdlfS0ke2Z1bmMuZnVuY3Rpb25OYW1lfWBcbiAgICAgIH0pO1xuXG4gICAgICAvLyDmp4vpgKDljJbjg63jgrDnlKjjga7nkrDlooPlpInmlbDjgpLov73liqBcbiAgICAgIGZ1bmMuYWRkRW52aXJvbm1lbnQoJ0xPR19MRVZFTCcsIHByb3BzLnN0YWdlID09PSAncHJvZCcgPyAnSU5GTycgOiAnREVCVUcnKTtcbiAgICAgIGZ1bmMuYWRkRW52aXJvbm1lbnQoJ0xPR19GT1JNQVQnLCAnSlNPTicpO1xuICAgICAgZnVuYy5hZGRFbnZpcm9ubWVudCgnQVBQTElDQVRJT05fTkFNRScsICd2ai1hcHAnKTtcbiAgICAgIGZ1bmMuYWRkRW52aXJvbm1lbnQoJ1NUQUdFJywgcHJvcHMuc3RhZ2UpO1xuICAgIH0pO1xuXG4gICAgLy8g44Ot44Kw55uj6KaW55So44GuQ2xvdWRXYXRjaCBMb2cgSW5zaWdodHMg44Kv44Ko44Oq44KS5LqL5YmN5a6a576pXG4gICAgY29uc3QgbG9nSW5zaWdodHNRdWVyaWVzID0gW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnRXJyb3IgQW5hbHlzaXMnLFxuICAgICAgICBxdWVyeTogYFxuICAgICAgICAgIGZpZWxkcyBAdGltZXN0YW1wLCBAbWVzc2FnZSwgQGxvZ1N0cmVhbVxuICAgICAgICAgIHwgZmlsdGVyIEBtZXNzYWdlIGxpa2UgL0VSUk9SL1xuICAgICAgICAgIHwgc29ydCBAdGltZXN0YW1wIGRlc2NcbiAgICAgICAgICB8IGxpbWl0IDEwMFxuICAgICAgICBgXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnUGVyZm9ybWFuY2UgQW5hbHlzaXMnLFxuICAgICAgICBxdWVyeTogYFxuICAgICAgICAgIGZpZWxkcyBAdGltZXN0YW1wLCBAZHVyYXRpb24sIEByZXF1ZXN0SWRcbiAgICAgICAgICB8IGZpbHRlciBAdHlwZSA9IFwiUkVQT1JUXCJcbiAgICAgICAgICB8IHNvcnQgQHRpbWVzdGFtcCBkZXNjXG4gICAgICAgICAgfCBzdGF0cyBhdmcoQGR1cmF0aW9uKSwgbWF4KEBkdXJhdGlvbiksIG1pbihAZHVyYXRpb24pIGJ5IGJpbig1bSlcbiAgICAgICAgYFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1VzZXIgQWN0aXZpdHknLFxuICAgICAgICBxdWVyeTogYFxuICAgICAgICAgIGZpZWxkcyBAdGltZXN0YW1wLCBAbWVzc2FnZVxuICAgICAgICAgIHwgZmlsdGVyIEBtZXNzYWdlIGxpa2UgL3VzZXJfYWN0aW9uL1xuICAgICAgICAgIHwgc29ydCBAdGltZXN0YW1wIGRlc2NcbiAgICAgICAgICB8IHN0YXRzIGNvdW50KCkgYnkgYmluKDFoKVxuICAgICAgICBgXG4gICAgICB9XG4gICAgXTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9nc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5sb2dzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgbG9nIHN0b3JhZ2UnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS2luZXNpc1N0cmVhbU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5raW5lc2lzU3RyZWFtLnN0cmVhbU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0tpbmVzaXMgc3RyZWFtIGZvciByZWFsLXRpbWUgbG9nIHByb2Nlc3NpbmcnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9nSW5zaWdodHNVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2xvZ3NWMjpsb2dzLWluc2lnaHRzYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBMb2dzIEluc2lnaHRzIENvbnNvbGUgVVJMJ1xuICAgIH0pO1xuXG4gICAgbG9nSW5zaWdodHNRdWVyaWVzLmZvckVhY2goKHF1ZXJ5LCBpbmRleCkgPT4ge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYExvZ0luc2lnaHRzUXVlcnkke2luZGV4fWAsIHtcbiAgICAgICAgdmFsdWU6IHF1ZXJ5LnF1ZXJ5LnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUHJlLWRlZmluZWQgcXVlcnk6ICR7cXVlcnkubmFtZX1gXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0FwcGxpY2F0aW9uJywgJ3YxejNyJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFnZScsIHByb3BzLnN0YWdlKTtcbiAgfVxufSJdfQ==