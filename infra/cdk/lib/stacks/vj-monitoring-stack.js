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
exports.VjMonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
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
            this.alertTopic.addSubscription(new snsSubscriptions.EmailSubscription('admin@v1z3r.app'));
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
        highErrorRateAlarm.addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));
        const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
            metric: apiLatency,
            threshold: 5000, // 5 seconds
            evaluationPeriods: 3,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            alarmDescription: 'High latency detected in API Gateway',
            alarmName: `vj-high-latency-${stage}`,
        });
        highLatencyAlarm.addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotbW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLW1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLG9GQUFzRTtBQUN0RSwrREFBaUQ7QUFDakQsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCx5REFBMkM7QUFtQjNDLE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUIsU0FBUyxDQUF1QjtJQUNoQyxVQUFVLENBQVk7SUFFdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RSx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsYUFBYSxLQUFLLEVBQUU7WUFDL0IsV0FBVyxFQUFFLDJCQUEyQixLQUFLLEVBQUU7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUM3QixJQUFJLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixDQUFDLENBQzFELENBQUM7UUFDSixDQUFDO1FBRUQsbUNBQW1DO1FBQ25DLE1BQU0sV0FBVyxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsYUFBYSxF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QUFLLEVBQUUsQ0FBQztZQUNSLE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsbUJBQW1CO1lBQzFCLElBQUksRUFBRSxDQUFDLG9CQUFvQixFQUFFLGtCQUFrQixDQUFDO1lBQ2hELEtBQUssRUFBRSxFQUFFO1lBQ1QsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsV0FBVyxJQUFJLENBQUMsTUFBTSxrREFBa0QsSUFBSSxDQUFDLE1BQU0sb0JBQW9CLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO1lBQzVJLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLGtCQUFrQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUTtZQUMvQixXQUFXLEVBQUUsMEJBQTBCO1lBQ3ZDLFVBQVUsRUFBRSxtQkFBbUIsS0FBSyxFQUFFO1NBQ3ZDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWhZRCw4Q0FnWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgVmpBcGlTdGFjayB9IGZyb20gJy4vdmotYXBpLXN0YWNrJztcbmltcG9ydCB7IFZqU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi92ai1zdG9yYWdlLXN0YWNrJztcbmltcG9ydCB7IFZqU3RhdGljSG9zdGluZ1N0YWNrIH0gZnJvbSAnLi92ai1zdGF0aWMtaG9zdGluZy1zdGFjayc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmpNb25pdG9yaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgY29uZmlnOiB7XG4gICAgZG9tYWluTmFtZTogc3RyaW5nO1xuICAgIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gICAgZW5hYmxlQ2xvdWRGcm9udDogYm9vbGVhbjtcbiAgICBlbmFibGVCYWNrdXA6IGJvb2xlYW47XG4gIH07XG4gIGFwaVN0YWNrOiBWakFwaVN0YWNrO1xuICBzdG9yYWdlU3RhY2s6IFZqU3RvcmFnZVN0YWNrO1xuICBob3N0aW5nU3RhY2s6IFZqU3RhdGljSG9zdGluZ1N0YWNrO1xufVxuXG5leHBvcnQgY2xhc3MgVmpNb25pdG9yaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcbiAgcHVibGljIHJlYWRvbmx5IGFsZXJ0VG9waWM6IHNucy5Ub3BpYztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpNb25pdG9yaW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnLCBhcGlTdGFjaywgc3RvcmFnZVN0YWNrLCBob3N0aW5nU3RhY2sgfSA9IHByb3BzO1xuXG4gICAgLy8gU05TIHRvcGljIGZvciBhbGVydHNcbiAgICB0aGlzLmFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgdmotYWxlcnRzLSR7c3RhZ2V9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiBgVkogQXBwbGljYXRpb24gQWxlcnRzIC0gJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGVtYWlsIHN1YnNjcmlwdGlvbiBmb3IgcHJvZHVjdGlvblxuICAgIGlmIChzdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICB0aGlzLmFsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgICBuZXcgc25zU3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbignYWRtaW5AdjF6M3IuYXBwJylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ3VzdG9tIGxvZyBncm91cHMgd2l0aCByZXRlbnRpb25cbiAgICBjb25zdCBhcGlMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBcGlMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYXBpZ2F0ZXdheS92ai1hcGktJHtzdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uOiBzdGFnZSA9PT0gJ3Byb2QnID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdlYnNvY2tldExvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ1dlYlNvY2tldExvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5L3ZqLXdlYnNvY2tldC0ke3N0YWdlfWAsXG4gICAgICByZXRlbnRpb246IHN0YWdlID09PSAncHJvZCcgPyBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIIDogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBEYXNoYm9hcmRcbiAgICB0aGlzLmRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYFZKLUFwcGxpY2F0aW9uLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IG1ldHJpY3NcbiAgICBjb25zdCBhcGlSZXF1ZXN0Q291bnQgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgbWV0cmljTmFtZTogJ0NvdW50JyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpTmFtZTogYHZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlMYXRlbmN5ID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpTmFtZTogYHZqLWFwaS0ke3N0YWdlfWAsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBpRXJyb3JzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICc0WFhFcnJvcicsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaU5hbWU6IGB2ai1hcGktJHtzdGFnZX1gLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBpU2VydmVyRXJyb3JzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICc1WFhFcnJvcicsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaU5hbWU6IGB2ai1hcGktJHtzdGFnZX1gLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IG1ldHJpY3NcbiAgICBjb25zdCB3ZWJzb2NrZXRDb25uZWN0aW9ucyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheVYyJyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb25uZWN0Q291bnQnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlJZDogYXBpU3RhY2sud2Vic29ja2V0QXBpLmFwaUlkLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgd2Vic29ja2V0TWVzc2FnZXMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXlWMicsXG4gICAgICBtZXRyaWNOYW1lOiAnTWVzc2FnZUNvdW50JyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpSWQ6IGFwaVN0YWNrLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RCIG1ldHJpY3NcbiAgICBjb25zdCBzZXNzaW9uVGFibGVSZWFkcyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgbWV0cmljTmFtZTogJ0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBUYWJsZU5hbWU6IHN0b3JhZ2VTdGFjay5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2Vzc2lvblRhYmxlV3JpdGVzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9EeW5hbW9EQicsXG4gICAgICBtZXRyaWNOYW1lOiAnQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBUYWJsZU5hbWU6IHN0b3JhZ2VTdGFjay5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJlc2V0VGFibGVSZWFkcyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgbWV0cmljTmFtZTogJ0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBUYWJsZU5hbWU6IHN0b3JhZ2VTdGFjay5wcmVzZXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IG1ldHJpY3MgKGlmIGVuYWJsZWQpXG4gICAgbGV0IGNsb3VkZnJvbnRSZXF1ZXN0czogY2xvdWR3YXRjaC5NZXRyaWMgfCB1bmRlZmluZWQ7XG4gICAgbGV0IGNsb3VkZnJvbnRFcnJvclJhdGU6IGNsb3Vkd2F0Y2guTWV0cmljIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKGhvc3RpbmdTdGFjay5kaXN0cmlidXRpb24pIHtcbiAgICAgIGNsb3VkZnJvbnRSZXF1ZXN0cyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9DbG91ZEZyb250JyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1JlcXVlc3RzJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIERpc3RyaWJ1dGlvbklkOiBob3N0aW5nU3RhY2suZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNsb3VkZnJvbnRFcnJvclJhdGUgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgIG1ldHJpY05hbWU6ICc0eHhFcnJvclJhdGUnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRGlzdHJpYnV0aW9uSWQ6IGhvc3RpbmdTdGFjay5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gRGFzaGJvYXJkIHdpZGdldHNcbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgLy8gQVBJIEdhdGV3YXkgcm93XG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgLSBSZXF1ZXN0cycsXG4gICAgICAgIGxlZnQ6IFthcGlSZXF1ZXN0Q291bnRdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IC0gTGF0ZW5jeScsXG4gICAgICAgIGxlZnQ6IFthcGlMYXRlbmN5XSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IC0gRXJyb3JzJyxcbiAgICAgICAgbGVmdDogW2FwaUVycm9ycywgYXBpU2VydmVyRXJyb3JzXSxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgLy8gV2ViU29ja2V0IHJvd1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1dlYlNvY2tldCAtIENvbm5lY3Rpb25zJyxcbiAgICAgICAgbGVmdDogW3dlYnNvY2tldENvbm5lY3Rpb25zXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdXZWJTb2NrZXQgLSBNZXNzYWdlcycsXG4gICAgICAgIGxlZnQ6IFt3ZWJzb2NrZXRNZXNzYWdlc10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIER5bmFtb0RCIHJvd1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0R5bmFtb0RCIC0gUmVhZCBDYXBhY2l0eScsXG4gICAgICAgIGxlZnQ6IFtzZXNzaW9uVGFibGVSZWFkcywgcHJlc2V0VGFibGVSZWFkc10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnRHluYW1vREIgLSBXcml0ZSBDYXBhY2l0eScsXG4gICAgICAgIGxlZnQ6IFtzZXNzaW9uVGFibGVXcml0ZXNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENsb3VkRnJvbnQgd2lkZ2V0cyAoaWYgZW5hYmxlZClcbiAgICBpZiAoY2xvdWRmcm9udFJlcXVlc3RzICYmIGNsb3VkZnJvbnRFcnJvclJhdGUpIHtcbiAgICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0Nsb3VkRnJvbnQgLSBSZXF1ZXN0cycsXG4gICAgICAgICAgbGVmdDogW2Nsb3VkZnJvbnRSZXF1ZXN0c10sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0Nsb3VkRnJvbnQgLSBFcnJvciBSYXRlJyxcbiAgICAgICAgICBsZWZ0OiBbY2xvdWRmcm9udEVycm9yUmF0ZV0sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQWxhcm1zXG4gICAgY29uc3QgaGlnaEVycm9yUmF0ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0hpZ2hFcnJvclJhdGVBbGFybScsIHtcbiAgICAgIG1ldHJpYzogYXBpU2VydmVyRXJyb3JzLFxuICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIGVycm9yIHJhdGUgZGV0ZWN0ZWQgaW4gQVBJIEdhdGV3YXknLFxuICAgICAgYWxhcm1OYW1lOiBgdmotaGlnaC1lcnJvci1yYXRlLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIGhpZ2hFcnJvclJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIGNvbnN0IGhpZ2hMYXRlbmN5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaExhdGVuY3lBbGFybScsIHtcbiAgICAgIG1ldHJpYzogYXBpTGF0ZW5jeSxcbiAgICAgIHRocmVzaG9sZDogNTAwMCwgLy8gNSBzZWNvbmRzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggbGF0ZW5jeSBkZXRlY3RlZCBpbiBBUEkgR2F0ZXdheScsXG4gICAgICBhbGFybU5hbWU6IGB2ai1oaWdoLWxhdGVuY3ktJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaGlnaExhdGVuY3lBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIEN1c3RvbSBtZXRyaWNzIExhbWJkYSBmdW5jdGlvblxuICAgIGNvbnN0IG1ldHJpY3NGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01ldHJpY3NGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ21ldHJpY3MuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBjbG91ZHdhdGNoID0gbmV3IEFXUy5DbG91ZFdhdGNoKCk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHNlc3Npb24gY291bnRcbiAgICAgICAgICAgIGNvbnN0IHNlc3Npb25Db3VudCA9IGF3YWl0IGR5bmFtb2RiLnNjYW4oe1xuICAgICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlNFU1NJT05fVEFCTEVfTkFNRSxcbiAgICAgICAgICAgICAgU2VsZWN0OiAnQ09VTlQnXG4gICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBwcmVzZXQgY291bnRcbiAgICAgICAgICAgIGNvbnN0IHByZXNldENvdW50ID0gYXdhaXQgZHluYW1vZGIuc2Nhbih7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUFJFU0VUX1RBQkxFX05BTUUsXG4gICAgICAgICAgICAgIFNlbGVjdDogJ0NPVU5UJ1xuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTZW5kIGN1c3RvbSBtZXRyaWNzXG4gICAgICAgICAgICBhd2FpdCBjbG91ZHdhdGNoLnB1dE1ldHJpY0RhdGEoe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdWSi9BcHBsaWNhdGlvbicsXG4gICAgICAgICAgICAgIE1ldHJpY0RhdGE6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnQWN0aXZlU2Vzc2lvbnMnLFxuICAgICAgICAgICAgICAgICAgVmFsdWU6IHNlc3Npb25Db3VudC5Db3VudCB8fCAwLFxuICAgICAgICAgICAgICAgICAgVW5pdDogJ0NvdW50JyxcbiAgICAgICAgICAgICAgICAgIFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ1RvdGFsUHJlc2V0cycsXG4gICAgICAgICAgICAgICAgICBWYWx1ZTogcHJlc2V0Q291bnQuQ291bnQgfHwgMCxcbiAgICAgICAgICAgICAgICAgIFVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ3VzdG9tIG1ldHJpY3MgcHVibGlzaGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBwdWJsaXNoIG1ldHJpY3M6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTRVNTSU9OX1RBQkxFX05BTUU6IHN0b3JhZ2VTdGFjay5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUkVTRVRfVEFCTEVfTkFNRTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciBtZXRyaWNzIGZ1bmN0aW9uXG4gICAgc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZS5ncmFudFJlYWREYXRhKG1ldHJpY3NGdW5jdGlvbik7XG4gICAgc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLmdyYW50UmVhZERhdGEobWV0cmljc0Z1bmN0aW9uKTtcbiAgICBtZXRyaWNzRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIFNjaGVkdWxlIG1ldHJpY3MgZnVuY3Rpb24gdG8gcnVuIGV2ZXJ5IDUgbWludXRlc1xuICAgIGNvbnN0IG1ldHJpY3NSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdNZXRyaWNzU2NoZWR1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkpLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaXNoIGN1c3RvbSBWSiBhcHBsaWNhdGlvbiBtZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIG1ldHJpY3NSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihtZXRyaWNzRnVuY3Rpb24pKTtcblxuICAgIC8vIEN1c3RvbSBtZXRyaWNzIHdpZGdldHNcbiAgICBjb25zdCBhY3RpdmVTZXNzaW9uc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdWSi9BcHBsaWNhdGlvbicsXG4gICAgICBtZXRyaWNOYW1lOiAnQWN0aXZlU2Vzc2lvbnMnLFxuICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdG90YWxQcmVzZXRzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ1ZKL0FwcGxpY2F0aW9uJyxcbiAgICAgIG1ldHJpY05hbWU6ICdUb3RhbFByZXNldHMnLFxuICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBY3RpdmUgU2Vzc2lvbnMnLFxuICAgICAgICBtZXRyaWNzOiBbYWN0aXZlU2Vzc2lvbnNNZXRyaWNdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVG90YWwgUHJlc2V0cycsXG4gICAgICAgIG1ldHJpY3M6IFt0b3RhbFByZXNldHNNZXRyaWNdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQXBwbGljYXRpb24gVXNhZ2UnLFxuICAgICAgICBsZWZ0OiBbYWN0aXZlU2Vzc2lvbnNNZXRyaWMsIHRvdGFsUHJlc2V0c01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke3RoaXMuZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWakRhc2hib2FyZFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIGFsZXJ0cycsXG4gICAgICBleHBvcnROYW1lOiBgVmpBbGVydFRvcGljQXJuLSR7c3RhZ2V9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==