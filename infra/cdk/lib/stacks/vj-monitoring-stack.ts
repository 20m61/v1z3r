import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { VjApiStack } from './vj-api-stack';
import { VjStorageStack } from './vj-storage-stack';
import { VjStaticHostingStack } from './vj-static-hosting-stack';

export interface VjMonitoringStackProps extends cdk.StackProps {
  stage: string;
  config: {
    domainName: string;
    enableAuth: boolean;
    enableCloudFront: boolean;
    enableBackup: boolean;
  };
  apiStack: VjApiStack;
  storageStack: VjStorageStack;
  hostingStack: VjStaticHostingStack;
}

export class VjMonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: VjMonitoringStackProps) {
    super(scope, id, props);

    const { stage, config, apiStack, storageStack, hostingStack } = props;

    // SNS topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `vj-alerts-${stage}`,
      displayName: `VJ Application Alerts - ${stage}`,
    });

    // Add email subscription for production
    if (stage === 'prod') {
      this.alertTopic.addSubscription(
        new snsSubscriptions.EmailSubscription('admin@sc4pe.net')
      );
    }

    // Custom log groups with retention
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/vj-api-${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    const websocketLogGroup = new logs.LogGroup(this, 'WebSocketLogGroup', {
      logGroupName: `/aws/apigateway/vj-websocket-${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `VJ-Application-${stage}`,
    });

    // API Gateway metrics
    const apiRequestCount = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: `vj-api-${stage}`,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatency = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: `vj-api-${stage}`,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const apiErrors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: `vj-api-${stage}`,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiServerErrors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: `vj-api-${stage}`,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // WebSocket metrics
    const websocketConnections = new cloudwatch.Metric({
      namespace: 'AWS/ApiGatewayV2',
      metricName: 'ConnectCount',
      dimensionsMap: {
        ApiId: apiStack.websocketApi.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const websocketMessages = new cloudwatch.Metric({
      namespace: 'AWS/ApiGatewayV2',
      metricName: 'MessageCount',
      dimensionsMap: {
        ApiId: apiStack.websocketApi.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // DynamoDB metrics
    const sessionTableReads = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedReadCapacityUnits',
      dimensionsMap: {
        TableName: storageStack.sessionTable.tableName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const sessionTableWrites = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedWriteCapacityUnits',
      dimensionsMap: {
        TableName: storageStack.sessionTable.tableName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const presetTableReads = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedReadCapacityUnits',
      dimensionsMap: {
        TableName: storageStack.presetTable.tableName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // CloudFront metrics (if enabled)
    let cloudfrontRequests: cloudwatch.Metric | undefined;
    let cloudfrontErrorRate: cloudwatch.Metric | undefined;

    if (hostingStack.distribution) {
      cloudfrontRequests = new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: 'Requests',
        dimensionsMap: {
          DistributionId: hostingStack.distribution.distributionId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      cloudfrontErrorRate = new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: '4xxErrorRate',
        dimensionsMap: {
          DistributionId: hostingStack.distribution.distributionId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });
    }

    // Dashboard widgets
    this.dashboard.addWidgets(
      // API Gateway row
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Requests',
        left: [apiRequestCount],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Latency',
        left: [apiLatency],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Errors',
        left: [apiErrors, apiServerErrors],
        width: 24,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      // WebSocket row
      new cloudwatch.GraphWidget({
        title: 'WebSocket - Connections',
        left: [websocketConnections],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'WebSocket - Messages',
        left: [websocketMessages],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      // DynamoDB row
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Read Capacity',
        left: [sessionTableReads, presetTableReads],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Write Capacity',
        left: [sessionTableWrites],
        width: 12,
        height: 6,
      })
    );

    // CloudFront widgets (if enabled)
    if (cloudfrontRequests && cloudfrontErrorRate) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'CloudFront - Requests',
          left: [cloudfrontRequests],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'CloudFront - Error Rate',
          left: [cloudfrontErrorRate],
          width: 12,
          height: 6,
        })
      );
    }

    // Alarms
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: apiServerErrors,
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'High error rate detected in API Gateway',
      alarmName: `vj-high-error-rate-${stage}`,
    });

    highErrorRateAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alertTopic)
    );

    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      metric: apiLatency,
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'High latency detected in API Gateway',
      alarmName: `vj-high-latency-${stage}`,
    });

    highLatencyAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alertTopic)
    );

    // Custom metrics Lambda function
    const metricsFunction = new lambda.Function(this, 'MetricsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'metrics.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const cloudwatch = new AWS.CloudWatch();
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
          const timestamp = new Date();
          
          try {
            // Get session count
            const sessionCount = await dynamodb.scan({
              TableName: process.env.SESSION_TABLE_NAME,
              Select: 'COUNT'
            }).promise();
            
            // Get preset count
            const presetCount = await dynamodb.scan({
              TableName: process.env.PRESET_TABLE_NAME,
              Select: 'COUNT'
            }).promise();
            
            // Send custom metrics
            await cloudwatch.putMetricData({
              Namespace: 'VJ/Application',
              MetricData: [
                {
                  MetricName: 'ActiveSessions',
                  Value: sessionCount.Count || 0,
                  Unit: 'Count',
                  Timestamp: timestamp,
                },
                {
                  MetricName: 'TotalPresets',
                  Value: presetCount.Count || 0,
                  Unit: 'Count',
                  Timestamp: timestamp,
                },
              ],
            }).promise();
            
            console.log('Custom metrics published successfully');
            return { statusCode: 200 };
          } catch (error) {
            console.error('Failed to publish metrics:', error);
            throw error;
          }
        };
      `),
      environment: {
        SESSION_TABLE_NAME: storageStack.sessionTable.tableName,
        PRESET_TABLE_NAME: storageStack.presetTable.tableName,
      },
      timeout: cdk.Duration.minutes(1),
    });

    // Grant permissions for metrics function
    storageStack.sessionTable.grantReadData(metricsFunction);
    storageStack.presetTable.grantReadData(metricsFunction);
    metricsFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // Schedule metrics function to run every 5 minutes
    const metricsRule = new events.Rule(this, 'MetricsSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Publish custom VJ application metrics',
    });

    metricsRule.addTarget(new targets.LambdaFunction(metricsFunction));

    // Custom metrics widgets
    const activeSessionsMetric = new cloudwatch.Metric({
      namespace: 'VJ/Application',
      metricName: 'ActiveSessions',
      statistic: 'Maximum',
      period: cdk.Duration.minutes(5),
    });

    const totalPresetsMetric = new cloudwatch.Metric({
      namespace: 'VJ/Application',
      metricName: 'TotalPresets',
      statistic: 'Maximum',
      period: cdk.Duration.minutes(5),
    });

    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Active Sessions',
        metrics: [activeSessionsMetric],
        width: 6,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Total Presets',
        metrics: [totalPresetsMetric],
        width: 6,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Application Usage',
        left: [activeSessionsMetric, totalPresetsMetric],
        width: 12,
        height: 6,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `VjDashboardUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS Topic ARN for alerts',
      exportName: `VjAlertTopicArn-${stage}`,
    });
  }
}