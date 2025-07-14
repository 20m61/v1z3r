import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as destinations from 'aws-cdk-lib/aws-logs-destinations';
import { Construct } from 'constructs';

export interface VjLoggingStackProps extends cdk.StackProps {
  stage: string;
  lambdaFunctions: lambda.Function[];
}

export class VjLoggingStack extends cdk.Stack {
  public readonly logsBucket: s3.Bucket;
  public readonly kinesisStream: kinesis.Stream;
  public readonly firehoseDeliveryStream: kinesisfirehose.CfnDeliveryStream;

  constructor(scope: Construct, id: string, props: VjLoggingStackProps) {
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