import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { VjApiStack } from './vj-api-stack';
import { VjStorageStack } from './vj-storage-stack';
import { VjStaticHostingStack } from './vj-static-hosting-stack';
import { VjCdnStack } from './vj-cdn-stack';

export interface VjMonitoringEnhancedStackProps extends cdk.StackProps {
  stage: string;
  apiStack: VjApiStack;
  storageStack: VjStorageStack;
  hostingStack: VjStaticHostingStack;
  cdnStack?: VjCdnStack;
  alarmEmail?: string;
}

export class VjMonitoringEnhancedStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VjMonitoringEnhancedStackProps) {
    super(scope, id, props);

    // SNS Topic for alarms
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `vj-app-alarms-${props.stage}`,
      displayName: `v1z3r ${props.stage} Alarms`,
    });

    if (props.alarmEmail) {
      alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alarmEmail)
      );
    }

    // API Metrics
    const apiGatewayMetrics = {
      count: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        dimensionsMap: {
          ApiName: props.apiStack.restApi.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      latency: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: props.apiStack.restApi.restApiName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      errors: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: props.apiStack.restApi.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      serverErrors: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: props.apiStack.restApi.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
    };

    // Lambda Metrics
    const lambdaMetrics = {
      duration: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Duration',
        dimensionsMap: {
          FunctionName: props.apiStack.presetFunction.functionName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      errors: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: props.apiStack.presetFunction.functionName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      throttles: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Throttles',
        dimensionsMap: {
          FunctionName: props.apiStack.presetFunction.functionName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      concurrentExecutions: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        dimensionsMap: {
          FunctionName: props.apiStack.presetFunction.functionName,
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
    };

    // DynamoDB Metrics
    const dynamoMetrics = {
      consumedReadCapacity: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        dimensionsMap: {
          TableName: props.storageStack.presetTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      consumedWriteCapacity: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedWriteCapacityUnits',
        dimensionsMap: {
          TableName: props.storageStack.presetTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      throttledRequests: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'UserErrors',
        dimensionsMap: {
          TableName: props.storageStack.presetTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
    };

    // CDN Metrics (if enabled)
    let cdnMetrics;
    if (props.cdnStack) {
      cdnMetrics = {
        requests: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'Requests',
          dimensionsMap: {
            DistributionId: props.cdnStack.distribution.distributionId,
            Region: 'Global',
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        bytesDownloaded: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'BytesDownloaded',
          dimensionsMap: {
            DistributionId: props.cdnStack.distribution.distributionId,
            Region: 'Global',
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        originLatency: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'OriginLatency',
          dimensionsMap: {
            DistributionId: props.cdnStack.distribution.distributionId,
            Region: 'Global',
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        cacheHitRate: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'CacheHitRate',
          dimensionsMap: {
            DistributionId: props.cdnStack.distribution.distributionId,
            Region: 'Global',
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        errorRate: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: '4xxErrorRate',
          dimensionsMap: {
            DistributionId: props.cdnStack.distribution.distributionId,
            Region: 'Global',
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
      };
    }

    // Create Enhanced Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'EnhancedDashboard', {
      dashboardName: `vj-app-enhanced-${props.stage}`,
      widgets: [
        [
          // API Gateway Metrics
          new cloudwatch.GraphWidget({
            title: 'API レスポンスタイム & エラー率',
            left: [apiGatewayMetrics.latency],
            right: [apiGatewayMetrics.errors, apiGatewayMetrics.serverErrors],
            width: 12,
            height: 6,
          }),
          // API Request Count
          new cloudwatch.GraphWidget({
            title: 'API リクエスト数',
            left: [apiGatewayMetrics.count],
            width: 12,
            height: 6,
          }),
        ],
        [
          // Lambda Performance
          new cloudwatch.GraphWidget({
            title: 'Lambda 実行時間 & エラー',
            left: [lambdaMetrics.duration],
            right: [lambdaMetrics.errors, lambdaMetrics.throttles],
            width: 12,
            height: 6,
          }),
          // Lambda Concurrency
          new cloudwatch.GraphWidget({
            title: 'Lambda 同時実行数',
            left: [lambdaMetrics.concurrentExecutions],
            width: 12,
            height: 6,
          }),
        ],
        [
          // DynamoDB Capacity
          new cloudwatch.GraphWidget({
            title: 'DynamoDB キャパシティ使用状況',
            left: [dynamoMetrics.consumedReadCapacity, dynamoMetrics.consumedWriteCapacity],
            right: [dynamoMetrics.throttledRequests],
            width: 12,
            height: 6,
          }),
        ],
        // CDN Metrics (if enabled)
        ...(cdnMetrics ? [[
          new cloudwatch.GraphWidget({
            title: 'CDN トラフィック & パフォーマンス',
            left: [cdnMetrics.requests, cdnMetrics.bytesDownloaded],
            right: [cdnMetrics.originLatency],
            width: 12,
            height: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'CDN キャッシュ効率 & エラー率',
            left: [cdnMetrics.cacheHitRate],
            right: [cdnMetrics.errorRate],
            width: 12,
            height: 6,
          }),
        ]] : []),
      ],
    });

    // Alarms
    // High API Latency
    new cloudwatch.Alarm(this, 'HighApiLatencyAlarm', {
      metric: apiGatewayMetrics.latency,
      threshold: 1000, // 1 second
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API latency is above 1 second',
    }).addAlarmAction(new actions.SnsAction(alarmTopic));

    // High Error Rate
    const errorRateMetric = new cloudwatch.MathExpression({
      expression: '(errors + serverErrors) / count * 100',
      usingMetrics: {
        errors: apiGatewayMetrics.errors,
        serverErrors: apiGatewayMetrics.serverErrors,
        count: apiGatewayMetrics.count,
      },
      period: cdk.Duration.minutes(5),
    });

    new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: errorRateMetric,
      threshold: 5, // 5%
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API error rate is above 5%',
    }).addAlarmAction(new actions.SnsAction(alarmTopic));

    // Lambda Errors
    new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
      metric: lambdaMetrics.errors,
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Lambda function has more than 10 errors',
    }).addAlarmAction(new actions.SnsAction(alarmTopic));

    // DynamoDB Throttling
    new cloudwatch.Alarm(this, 'DynamoThrottlingAlarm', {
      metric: dynamoMetrics.throttledRequests,
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'DynamoDB table is being throttled',
    }).addAlarmAction(new actions.SnsAction(alarmTopic));

    // CDN Alarms (if enabled)
    if (cdnMetrics) {
      // Low Cache Hit Rate
      new cloudwatch.Alarm(this, 'LowCacheHitRateAlarm', {
        metric: cdnMetrics.cacheHitRate,
        threshold: 80, // 80%
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'CDN cache hit rate is below 80%',
      }).addAlarmAction(new actions.SnsAction(alarmTopic));

      // High Origin Latency
      new cloudwatch.Alarm(this, 'HighOriginLatencyAlarm', {
        metric: cdnMetrics.originLatency,
        threshold: 500, // 500ms
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'CDN origin latency is above 500ms',
      }).addAlarmAction(new actions.SnsAction(alarmTopic));
    }

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'Enhanced CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
    });

    // Tags
    cdk.Tags.of(this).add('Application', 'v1z3r');
    cdk.Tags.of(this).add('Stage', props.stage);
  }
}