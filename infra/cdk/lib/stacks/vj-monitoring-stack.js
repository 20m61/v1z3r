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
exports.VjMonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class VjMonitoringStack extends cdk.Stack {
    dashboard;
    alertTopic;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, config, apiStack, storageStack, hostingStack } = props;
        // SNS topic for alerts
        this.alertTopic = new sns.Topic(this, 'AlertTopic', {
            topicName: `vj-alerts-${stage}`,
            displayName: `VJ Application Alerts - ${stage}`,
        });
        // Add email subscription for production
        if (stage === 'prod') {
            this.alertTopic.addSubscription(new snsSubscriptions.EmailSubscription('admin@sc4pe.net'));
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
        let cloudfrontRequests;
        let cloudfrontErrorRate;
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
        }), new cloudwatch.GraphWidget({
            title: 'API Gateway - Latency',
            left: [apiLatency],
            width: 12,
            height: 6,
        }));
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway - Errors',
            left: [apiErrors, apiServerErrors],
            width: 24,
            height: 6,
        }));
        this.dashboard.addWidgets(
        // WebSocket row
        new cloudwatch.GraphWidget({
            title: 'WebSocket - Connections',
            left: [websocketConnections],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'WebSocket - Messages',
            left: [websocketMessages],
            width: 12,
            height: 6,
        }));
        this.dashboard.addWidgets(
        // DynamoDB row
        new cloudwatch.GraphWidget({
            title: 'DynamoDB - Read Capacity',
            left: [sessionTableReads, presetTableReads],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'DynamoDB - Write Capacity',
            left: [sessionTableWrites],
            width: 12,
            height: 6,
        }));
        // CloudFront widgets (if enabled)
        if (cloudfrontRequests && cloudfrontErrorRate) {
            this.dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'CloudFront - Requests',
                left: [cloudfrontRequests],
                width: 12,
                height: 6,
            }), new cloudwatch.GraphWidget({
                title: 'CloudFront - Error Rate',
                left: [cloudfrontErrorRate],
                width: 12,
                height: 6,
            }));
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
        highErrorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
            metric: apiLatency,
            threshold: 5000,
            evaluationPeriods: 3,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            alarmDescription: 'High latency detected in API Gateway',
            alarmName: `vj-high-latency-${stage}`,
        });
        highLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        // Custom metrics Lambda function
        const metricsFunction = new lambda.Function(this, 'MetricsFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'metrics.handler',
            code: lambda.Code.fromInline(`
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
        
        const cloudwatch = new CloudWatchClient({});
        const dynamodbClient = new DynamoDBClient({});
        const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
        
        exports.handler = async (event) => {
          const timestamp = new Date();
          
          try {
            // Get session count
            const sessionCount = await dynamodb.send(new ScanCommand({
              TableName: process.env.SESSION_TABLE_NAME,
              Select: 'COUNT'
            }));
            
            // Get preset count
            const presetCount = await dynamodb.send(new ScanCommand({
              TableName: process.env.PRESET_TABLE_NAME,
              Select: 'COUNT'
            }));
            
            // Send custom metrics
            await cloudwatch.send(new PutMetricDataCommand({
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
            }));
            
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
        this.dashboard.addWidgets(new cloudwatch.SingleValueWidget({
            title: 'Active Sessions',
            metrics: [activeSessionsMetric],
            width: 6,
            height: 6,
        }), new cloudwatch.SingleValueWidget({
            title: 'Total Presets',
            metrics: [totalPresetsMetric],
            width: 6,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Application Usage',
            left: [activeSessionsMetric, totalPresetsMetric],
            width: 12,
            height: 6,
        }));
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
exports.VjMonitoringStack = VjMonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotbW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLW1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELHNGQUF3RTtBQUN4RSwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLG9GQUFzRTtBQUN0RSwrREFBaUQ7QUFDakQsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCx5REFBMkM7QUFtQjNDLE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUIsU0FBUyxDQUF1QjtJQUNoQyxVQUFVLENBQVk7SUFFdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RSx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsYUFBYSxLQUFLLEVBQUU7WUFDL0IsV0FBVyxFQUFFLDJCQUEyQixLQUFLLEVBQUU7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRTtZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FDN0IsSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUMxRCxDQUFDO1NBQ0g7UUFFRCxtQ0FBbUM7UUFDbkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFD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QUFDO1NBQ1YsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsbUJBQW1CO1lBQzFCLElBQUksRUFBRSxDQUFDLG9CQUFvQixFQUFFLGtCQUFrQixDQUFDO1lBQ2hELEtBQUssRUFBRSxFQUFFO1lBQ1QsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsV0FBVyxJQUFJLENBQUMsTUFBTSxrREFBa0QsSUFBSSxDQUFDLE1BQU0sb0JBQW9CLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO1lBQzVJLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLGtCQUFrQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUTtZQUMvQixXQUFXLEVBQUUsMEJBQTBCO1lBQ3ZDLFVBQVUsRUFBRSxtQkFBbUIsS0FBSyxFQUFFO1NBQ3ZDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXBZRCw4Q0FvWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoQWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc25zU3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBWakFwaVN0YWNrIH0gZnJvbSAnLi92ai1hcGktc3RhY2snO1xuaW1wb3J0IHsgVmpTdG9yYWdlU3RhY2sgfSBmcm9tICcuL3ZqLXN0b3JhZ2Utc3RhY2snO1xuaW1wb3J0IHsgVmpTdGF0aWNIb3N0aW5nU3RhY2sgfSBmcm9tICcuL3ZqLXN0YXRpYy1ob3N0aW5nLXN0YWNrJztcblxuZXhwb3J0IGludGVyZmFjZSBWak1vbml0b3JpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgYXBpU3RhY2s6IFZqQXBpU3RhY2s7XG4gIHN0b3JhZ2VTdGFjazogVmpTdG9yYWdlU3RhY2s7XG4gIGhvc3RpbmdTdGFjazogVmpTdGF0aWNIb3N0aW5nU3RhY2s7XG59XG5cbmV4cG9ydCBjbGFzcyBWak1vbml0b3JpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBkYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxlcnRUb3BpYzogc25zLlRvcGljO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWak1vbml0b3JpbmdTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBjb25maWcsIGFwaVN0YWNrLCBzdG9yYWdlU3RhY2ssIGhvc3RpbmdTdGFjayB9ID0gcHJvcHM7XG5cbiAgICAvLyBTTlMgdG9waWMgZm9yIGFsZXJ0c1xuICAgIHRoaXMuYWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0FsZXJ0VG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6IGB2ai1hbGVydHMtJHtzdGFnZX1gLFxuICAgICAgZGlzcGxheU5hbWU6IGBWSiBBcHBsaWNhdGlvbiBBbGVydHMgLSAke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgZW1haWwgc3Vic2NyaXB0aW9uIGZvciBwcm9kdWN0aW9uXG4gICAgaWYgKHN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIHRoaXMuYWxlcnRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICAgIG5ldyBzbnNTdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKCdhZG1pbkBzYzRwZS5uZXQnKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDdXN0b20gbG9nIGdyb3VwcyB3aXRoIHJldGVudGlvblxuICAgIGNvbnN0IGFwaUxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FwaUxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5L3ZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICByZXRlbnRpb246IHN0YWdlID09PSAncHJvZCcgPyBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIIDogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgd2Vic29ja2V0TG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnV2ViU29ja2V0TG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2FwaWdhdGV3YXkvdmotd2Vic29ja2V0LSR7c3RhZ2V9YCxcbiAgICAgIHJldGVudGlvbjogc3RhZ2UgPT09ICdwcm9kJyA/IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEggOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIERhc2hib2FyZFxuICAgIHRoaXMuZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiBgVkotQXBwbGljYXRpb24tJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgbWV0cmljc1xuICAgIGNvbnN0IGFwaVJlcXVlc3RDb3VudCA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICBtZXRyaWNOYW1lOiAnQ291bnQnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaUxhdGVuY3kgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlFcnJvcnMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpTmFtZTogYHZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlTZXJ2ZXJFcnJvcnMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgbWV0cmljTmFtZTogJzVYWEVycm9yJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpTmFtZTogYHZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBXZWJTb2NrZXQgbWV0cmljc1xuICAgIGNvbnN0IHdlYnNvY2tldENvbm5lY3Rpb25zID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5VjInLFxuICAgICAgbWV0cmljTmFtZTogJ0Nvbm5lY3RDb3VudCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaUlkOiBhcGlTdGFjay53ZWJzb2NrZXRBcGkuYXBpSWQsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCB3ZWJzb2NrZXRNZXNzYWdlcyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheVYyJyxcbiAgICAgIG1ldHJpY05hbWU6ICdNZXNzYWdlQ291bnQnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlJZDogYXBpU3RhY2sud2Vic29ja2V0QXBpLmFwaUlkLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgbWV0cmljc1xuICAgIGNvbnN0IHNlc3Npb25UYWJsZVJlYWRzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9EeW5hbW9EQicsXG4gICAgICBtZXRyaWNOYW1lOiAnQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cycsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIFRhYmxlTmFtZTogc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZXNzaW9uVGFibGVXcml0ZXMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cycsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIFRhYmxlTmFtZTogc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcmVzZXRUYWJsZVJlYWRzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9EeW5hbW9EQicsXG4gICAgICBtZXRyaWNOYW1lOiAnQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cycsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIFRhYmxlTmFtZTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgbWV0cmljcyAoaWYgZW5hYmxlZClcbiAgICBsZXQgY2xvdWRmcm9udFJlcXVlc3RzOiBjbG91ZHdhdGNoLk1ldHJpYyB8IHVuZGVmaW5lZDtcbiAgICBsZXQgY2xvdWRmcm9udEVycm9yUmF0ZTogY2xvdWR3YXRjaC5NZXRyaWMgfCB1bmRlZmluZWQ7XG5cbiAgICBpZiAoaG9zdGluZ1N0YWNrLmRpc3RyaWJ1dGlvbikge1xuICAgICAgY2xvdWRmcm9udFJlcXVlc3RzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0Nsb3VkRnJvbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnUmVxdWVzdHMnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRGlzdHJpYnV0aW9uSWQ6IGhvc3RpbmdTdGFjay5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcblxuICAgICAgY2xvdWRmcm9udEVycm9yUmF0ZSA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9DbG91ZEZyb250JyxcbiAgICAgICAgbWV0cmljTmFtZTogJzR4eEVycm9yUmF0ZScsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBEaXN0cmlidXRpb25JZDogaG9zdGluZ1N0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBEYXNoYm9hcmQgd2lkZ2V0c1xuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBBUEkgR2F0ZXdheSByb3dcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSAtIFJlcXVlc3RzJyxcbiAgICAgICAgbGVmdDogW2FwaVJlcXVlc3RDb3VudF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgLSBMYXRlbmN5JyxcbiAgICAgICAgbGVmdDogW2FwaUxhdGVuY3ldLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgLSBFcnJvcnMnLFxuICAgICAgICBsZWZ0OiBbYXBpRXJyb3JzLCBhcGlTZXJ2ZXJFcnJvcnNdLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBXZWJTb2NrZXQgcm93XG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnV2ViU29ja2V0IC0gQ29ubmVjdGlvbnMnLFxuICAgICAgICBsZWZ0OiBbd2Vic29ja2V0Q29ubmVjdGlvbnNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1dlYlNvY2tldCAtIE1lc3NhZ2VzJyxcbiAgICAgICAgbGVmdDogW3dlYnNvY2tldE1lc3NhZ2VzXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgLy8gRHluYW1vREIgcm93XG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnRHluYW1vREIgLSBSZWFkIENhcGFjaXR5JyxcbiAgICAgICAgbGVmdDogW3Nlc3Npb25UYWJsZVJlYWRzLCBwcmVzZXRUYWJsZVJlYWRzXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIFdyaXRlIENhcGFjaXR5JyxcbiAgICAgICAgbGVmdDogW3Nlc3Npb25UYWJsZVdyaXRlc10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ2xvdWRGcm9udCB3aWRnZXRzIChpZiBlbmFibGVkKVxuICAgIGlmIChjbG91ZGZyb250UmVxdWVzdHMgJiYgY2xvdWRmcm9udEVycm9yUmF0ZSkge1xuICAgICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnQ2xvdWRGcm9udCAtIFJlcXVlc3RzJyxcbiAgICAgICAgICBsZWZ0OiBbY2xvdWRmcm9udFJlcXVlc3RzXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnQ2xvdWRGcm9udCAtIEVycm9yIFJhdGUnLFxuICAgICAgICAgIGxlZnQ6IFtjbG91ZGZyb250RXJyb3JSYXRlXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBBbGFybXNcbiAgICBjb25zdCBoaWdoRXJyb3JSYXRlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaEVycm9yUmF0ZUFsYXJtJywge1xuICAgICAgbWV0cmljOiBhcGlTZXJ2ZXJFcnJvcnMsXG4gICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggZXJyb3IgcmF0ZSBkZXRlY3RlZCBpbiBBUEkgR2F0ZXdheScsXG4gICAgICBhbGFybU5hbWU6IGB2ai1oaWdoLWVycm9yLXJhdGUtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaGlnaEVycm9yUmF0ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIGNvbnN0IGhpZ2hMYXRlbmN5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaExhdGVuY3lBbGFybScsIHtcbiAgICAgIG1ldHJpYzogYXBpTGF0ZW5jeSxcbiAgICAgIHRocmVzaG9sZDogNTAwMCwgLy8gNSBzZWNvbmRzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggbGF0ZW5jeSBkZXRlY3RlZCBpbiBBUEkgR2F0ZXdheScsXG4gICAgICBhbGFybU5hbWU6IGB2ai1oaWdoLWxhdGVuY3ktJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaGlnaExhdGVuY3lBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBDdXN0b20gbWV0cmljcyBMYW1iZGEgZnVuY3Rpb25cbiAgICBjb25zdCBtZXRyaWNzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNZXRyaWNzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdtZXRyaWNzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHsgQ2xvdWRXYXRjaENsaWVudCwgUHV0TWV0cmljRGF0YUNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZHdhdGNoJyk7XG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJDbGllbnQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYicpO1xuICAgICAgICBjb25zdCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFNjYW5Db21tYW5kIH0gPSByZXF1aXJlKCdAYXdzLXNkay9saWItZHluYW1vZGInKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNsb3Vkd2F0Y2ggPSBuZXcgQ2xvdWRXYXRjaENsaWVudCh7fSk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oZHluYW1vZGJDbGllbnQpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHNlc3Npb24gY291bnRcbiAgICAgICAgICAgIGNvbnN0IHNlc3Npb25Db3VudCA9IGF3YWl0IGR5bmFtb2RiLnNlbmQobmV3IFNjYW5Db21tYW5kKHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5TRVNTSU9OX1RBQkxFX05BTUUsXG4gICAgICAgICAgICAgIFNlbGVjdDogJ0NPVU5UJ1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgcHJlc2V0IGNvdW50XG4gICAgICAgICAgICBjb25zdCBwcmVzZXRDb3VudCA9IGF3YWl0IGR5bmFtb2RiLnNlbmQobmV3IFNjYW5Db21tYW5kKHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5QUkVTRVRfVEFCTEVfTkFNRSxcbiAgICAgICAgICAgICAgU2VsZWN0OiAnQ09VTlQnXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFNlbmQgY3VzdG9tIG1ldHJpY3NcbiAgICAgICAgICAgIGF3YWl0IGNsb3Vkd2F0Y2guc2VuZChuZXcgUHV0TWV0cmljRGF0YUNvbW1hbmQoe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdWSi9BcHBsaWNhdGlvbicsXG4gICAgICAgICAgICAgIE1ldHJpY0RhdGE6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnQWN0aXZlU2Vzc2lvbnMnLFxuICAgICAgICAgICAgICAgICAgVmFsdWU6IHNlc3Npb25Db3VudC5Db3VudCB8fCAwLFxuICAgICAgICAgICAgICAgICAgVW5pdDogJ0NvdW50JyxcbiAgICAgICAgICAgICAgICAgIFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ1RvdGFsUHJlc2V0cycsXG4gICAgICAgICAgICAgICAgICBWYWx1ZTogcHJlc2V0Q291bnQuQ291bnQgfHwgMCxcbiAgICAgICAgICAgICAgICAgIFVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ3VzdG9tIG1ldHJpY3MgcHVibGlzaGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBwdWJsaXNoIG1ldHJpY3M6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTRVNTSU9OX1RBQkxFX05BTUU6IHN0b3JhZ2VTdGFjay5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUkVTRVRfVEFCTEVfTkFNRTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciBtZXRyaWNzIGZ1bmN0aW9uXG4gICAgc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZS5ncmFudFJlYWREYXRhKG1ldHJpY3NGdW5jdGlvbik7XG4gICAgc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLmdyYW50UmVhZERhdGEobWV0cmljc0Z1bmN0aW9uKTtcbiAgICBtZXRyaWNzRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIFNjaGVkdWxlIG1ldHJpY3MgZnVuY3Rpb24gdG8gcnVuIGV2ZXJ5IDUgbWludXRlc1xuICAgIGNvbnN0IG1ldHJpY3NSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdNZXRyaWNzU2NoZWR1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkpLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaXNoIGN1c3RvbSBWSiBhcHBsaWNhdGlvbiBtZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIG1ldHJpY3NSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihtZXRyaWNzRnVuY3Rpb24pKTtcblxuICAgIC8vIEN1c3RvbSBtZXRyaWNzIHdpZGdldHNcbiAgICBjb25zdCBhY3RpdmVTZXNzaW9uc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdWSi9BcHBsaWNhdGlvbicsXG4gICAgICBtZXRyaWNOYW1lOiAnQWN0aXZlU2Vzc2lvbnMnLFxuICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdG90YWxQcmVzZXRzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ1ZKL0FwcGxpY2F0aW9uJyxcbiAgICAgIG1ldHJpY05hbWU6ICdUb3RhbFByZXNldHMnLFxuICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBY3RpdmUgU2Vzc2lvbnMnLFxuICAgICAgICBtZXRyaWNzOiBbYWN0aXZlU2Vzc2lvbnNNZXRyaWNdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVG90YWwgUHJlc2V0cycsXG4gICAgICAgIG1ldHJpY3M6IFt0b3RhbFByZXNldHNNZXRyaWNdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQXBwbGljYXRpb24gVXNhZ2UnLFxuICAgICAgICBsZWZ0OiBbYWN0aXZlU2Vzc2lvbnNNZXRyaWMsIHRvdGFsUHJlc2V0c01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke3RoaXMuZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWakRhc2hib2FyZFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIGFsZXJ0cycsXG4gICAgICBleHBvcnROYW1lOiBgVmpBbGVydFRvcGljQXJuLSR7c3RhZ2V9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==