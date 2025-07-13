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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotbW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLW1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELHNGQUF3RTtBQUN4RSwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLG9GQUFzRTtBQUN0RSwrREFBaUQ7QUFDakQsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCx5REFBMkM7QUFtQjNDLE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUIsU0FBUyxDQUF1QjtJQUNoQyxVQUFVLENBQVk7SUFFdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RSx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsYUFBYSxLQUFLLEVBQUU7WUFDL0IsV0FBVyxFQUFFLDJCQUEyQixLQUFLLEVBQUU7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRTtZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FDN0IsSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUMxRCxDQUFDO1NBQ0g7UUFFRCxtQ0FBbUM7UUFDbkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDekQsWUFBWSxFQUFFLDBCQUEwQixLQUFLLEVBQUU7WUFDL0MsU0FBUyxFQUFFLEtBQUssS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7U0FDekYsQ0FBQyxDQUFDO1FBRUgsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3JFLFlBQVksRUFBRSxnQ0FBZ0MsS0FBSyxFQUFFO1lBQ3JELFNBQVMsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ3pGLENBQUMsQ0FBQztRQUVILHVCQUF1QjtRQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQzNELGFBQWEsRUFBRSxrQkFBa0IsS0FBSyxFQUFFO1NBQ3pDLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixNQUFNLGVBQWUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDNUMsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixVQUFVLEVBQUUsT0FBTztZQUNuQixhQUFhLEVBQUU7Z0JBQ2IsT0FBTyxFQUFFLFVBQVUsS0FBSyxFQUFFO2FBQzNCO1lBQ0QsU0FBUyxFQUFFLEtBQUs7WUFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDdkMsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixVQUFVLEVBQUUsU0FBUztZQUNyQixhQUFhLEVBQUU7Z0JBQ2IsT0FBTyxFQUFFLFVBQVUsS0FBSyxFQUFFO2FBQzNCO1lBQ0QsU0FBUyxFQUFFLFNBQVM7WUFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUM7UUFFSCxNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDdEMsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixVQUFVLEVBQUUsVUFBVTtZQUN0QixhQUFhLEVBQUU7Z0JBQ2IsT0FBTyxFQUFFLFVBQVUsS0FBSyxFQUFFO2FBQzNCO1lBQ0QsU0FBUyxFQUFFLEtBQUs7WUFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDNUMsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixVQUFVLEVBQUUsVUFBVTtZQUN0QixhQUFhLEVBQUU7Z0JBQ2IsT0FBTyxFQUFFLFVBQVUsS0FBSyxFQUFFO2FBQzNCO1lBQ0QsU0FBUyxFQUFFLEtBQUs7WUFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUM7UUFFSCxvQkFBb0I7UUFDcEIsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDakQsU0FBUyxFQUFFLGtCQUFrQjtZQUM3QixVQUFVLEVBQUUsY0FBYztZQUMxQixhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSzthQUNuQztZQUNELFNBQVMsRUFBRSxLQUFLO1lBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDOUMsU0FBUyxFQUFFLGtCQUFrQjtZQUM3QixVQUFVLEVBQUUsY0FBYztZQUMxQixhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSzthQUNuQztZQUNELFNBQVMsRUFBRSxLQUFLO1lBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CO1FBQ25CLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQzlDLFNBQVMsRUFBRSxjQUFjO1lBQ3pCLFVBQVUsRUFBRSwyQkFBMkI7WUFDdkMsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVM7YUFDL0M7WUFDRCxTQUFTLEVBQUUsS0FBSztZQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2hDLENBQUMsQ0FBQztRQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQy9DLFNBQVMsRUFBRSxjQUFjO1lBQ3pCLFVBQVUsRUFBRSw0QkFBNEI7WUFDeEMsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVM7YUFDL0M7WUFDRCxTQUFTLEVBQUUsS0FBSztZQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2hDLENBQUMsQ0FBQztRQUVILE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQzdDLFNBQVMsRUFBRSxjQUFjO1lBQ3pCLFVBQVUsRUFBRSwyQkFBMkI7WUFDdkMsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxZQUFZLENBQUMsV0FBVyxDQUFDLFNBQVM7YUFDOUM7WUFDRCxTQUFTLEVBQUUsS0FBSztZQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2hDLENBQUMsQ0FBQztRQUVILGtDQUFrQztRQUNsQyxJQUFJLGtCQUFpRCxDQUFDO1FBQ3RELElBQUksbUJBQWtELENBQUM7UUFFdkQsSUFBSSxZQUFZLENBQUMsWUFBWSxFQUFFO1lBQzdCLGtCQUFrQixHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDekMsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLGFBQWEsRUFBRTtvQkFDYixjQUFjLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxjQUFjO2lCQUN6RDtnQkFDRCxTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDLENBQUM7WUFFSCxtQkFBbUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzFDLFNBQVMsRUFBRSxnQkFBZ0I7Z0JBQzNCLFVBQVUsRUFBRSxjQUFjO2dCQUMxQixhQUFhLEVBQUU7b0JBQ2IsY0FBYyxFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsY0FBYztpQkFDekQ7Z0JBQ0QsU0FBUyxFQUFFLFNBQVM7Z0JBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVO1FBQ3ZCLGtCQUFrQjtRQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLHdCQUF3QjtZQUMvQixJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUM7WUFDdkIsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUMsRUFDRixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLHVCQUF1QjtZQUM5QixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUM7WUFDbEIsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUMsQ0FDSCxDQUFDO1FBRUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQ3ZCLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsc0JBQXNCO1lBQzdCLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUM7WUFDbEMsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUMsQ0FDSCxDQUFDO1FBRUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVO1FBQ3ZCLGdCQUFnQjtRQUNoQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLHlCQUF5QjtZQUNoQyxJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztZQUM1QixLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsc0JBQXNCO1lBQzdCLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDO1lBQ3pCLEtBQUssRUFBRSxFQUFFO1lBQ1QsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVTtRQUN2QixlQUFlO1FBQ2YsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3pCLEtBQUssRUFBRSwwQkFBMEI7WUFDakMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUM7WUFDM0MsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUMsRUFDRixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLDJCQUEyQjtZQUNsQyxJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztZQUMxQixLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxDQUNILENBQUM7UUFFRixrQ0FBa0M7UUFDbEMsSUFBSSxrQkFBa0IsSUFBSSxtQkFBbUIsRUFBRTtZQUM3QyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FDdkIsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO2dCQUN6QixLQUFLLEVBQUUsdUJBQXVCO2dCQUM5QixJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztnQkFDMUIsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsTUFBTSxFQUFFLENBQUM7YUFDVixDQUFDLEVBQ0YsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO2dCQUN6QixLQUFLLEVBQUUseUJBQXlCO2dCQUNoQyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztnQkFDM0IsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsTUFBTSxFQUFFLENBQUM7YUFDVixDQUFDLENBQ0gsQ0FBQztTQUNIO1FBRUQsU0FBUztRQUNULE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUMxRSxNQUFNLEVBQUUsZUFBZTtZQUN2QixTQUFTLEVBQUUsQ0FBQztZQUNaLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7WUFDM0QsZ0JBQWdCLEVBQUUseUNBQXlDO1lBQzNELFNBQVMsRUFBRSxzQkFBc0IsS0FBSyxFQUFFO1NBQ3pDLENBQUMsQ0FBQztRQUVILGtCQUFrQixDQUFDLGNBQWMsQ0FDL0IsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUNqRCxDQUFDO1FBRUYsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3RFLE1BQU0sRUFBRSxVQUFVO1lBQ2xCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtZQUMzRCxnQkFBZ0IsRUFBRSxzQ0FBc0M7WUFDeEQsU0FBUyxFQUFFLG1CQUFtQixLQUFLLEVBQUU7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsY0FBYyxDQUM3QixJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQ2pELENBQUM7UUFFRixpQ0FBaUM7UUFDakMsTUFBTSxlQUFlLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUNuRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxpQkFBaUI7WUFDMUIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQStDNUIsQ0FBQztZQUNGLFdBQVcsRUFBRTtnQkFDWCxrQkFBa0IsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVM7Z0JBQ3ZELGlCQUFpQixFQUFFLFlBQVksQ0FBQyxXQUFXLENBQUMsU0FBUzthQUN0RDtZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7U0FDakMsQ0FBQyxDQUFDO1FBRUgseUNBQXlDO1FBQ3pDLFlBQVksQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pELFlBQVksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3hELGVBQWUsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RELE9BQU8sRUFBRSxDQUFDLDBCQUEwQixDQUFDO1lBQ3JDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLG1EQUFtRDtRQUNuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzNELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2RCxXQUFXLEVBQUUsdUNBQXVDO1NBQ3JELENBQUMsQ0FBQztRQUVILFdBQVcsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFFbkUseUJBQXlCO1FBQ3pCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ2pELFNBQVMsRUFBRSxnQkFBZ0I7WUFDM0IsVUFBVSxFQUFFLGdCQUFnQjtZQUM1QixTQUFTLEVBQUUsU0FBUztZQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2hDLENBQUMsQ0FBQztRQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQy9DLFNBQVMsRUFBRSxnQkFBZ0I7WUFDM0IsVUFBVSxFQUFFLGNBQWM7WUFDMUIsU0FBUyxFQUFFLFNBQVM7WUFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FDdkIsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUM7WUFDL0IsS0FBSyxFQUFFLGlCQUFpQjtZQUN4QixPQUFPLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztZQUMvQixLQUFLLEVBQUUsQ0FBQztZQUNSLE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDO1lBQy9CLEtBQUssRUFBRSxlQUFlO1lBQ3RCLE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1lBQzdCLEtBQUssRUFBRSxDQUFDO1lBQ1IsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLEVBQ0YsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3pCLEtBQUssRUFBRSxtQkFBbUI7WUFDMUIsSUFBSSxFQUFFLENBQUMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUM7WUFDaEQsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUMsQ0FDSCxDQUFDO1FBRUYsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxXQUFXLElBQUksQ0FBQyxNQUFNLGtEQUFrRCxJQUFJLENBQUMsTUFBTSxvQkFBb0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDNUksV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsa0JBQWtCLEtBQUssRUFBRTtTQUN0QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRO1lBQy9CLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLG1CQUFtQixLQUFLLEVBQUU7U0FDdkMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBaFlELDhDQWdZQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hBY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzbnNTdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFZqQXBpU3RhY2sgfSBmcm9tICcuL3ZqLWFwaS1zdGFjayc7XG5pbXBvcnQgeyBWalN0b3JhZ2VTdGFjayB9IGZyb20gJy4vdmotc3RvcmFnZS1zdGFjayc7XG5pbXBvcnQgeyBWalN0YXRpY0hvc3RpbmdTdGFjayB9IGZyb20gJy4vdmotc3RhdGljLWhvc3Rpbmctc3RhY2snO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqTW9uaXRvcmluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgICBlbmFibGVBdXRoOiBib29sZWFuO1xuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gICAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xuICB9O1xuICBhcGlTdGFjazogVmpBcGlTdGFjaztcbiAgc3RvcmFnZVN0YWNrOiBWalN0b3JhZ2VTdGFjaztcbiAgaG9zdGluZ1N0YWNrOiBWalN0YXRpY0hvc3RpbmdTdGFjaztcbn1cblxuZXhwb3J0IGNsYXNzIFZqTW9uaXRvcmluZ1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhc2hib2FyZDogY2xvdWR3YXRjaC5EYXNoYm9hcmQ7XG4gIHB1YmxpYyByZWFkb25seSBhbGVydFRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZywgYXBpU3RhY2ssIHN0b3JhZ2VTdGFjaywgaG9zdGluZ1N0YWNrIH0gPSBwcm9wcztcblxuICAgIC8vIFNOUyB0b3BpYyBmb3IgYWxlcnRzXG4gICAgdGhpcy5hbGVydFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQWxlcnRUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYHZqLWFsZXJ0cy0ke3N0YWdlfWAsXG4gICAgICBkaXNwbGF5TmFtZTogYFZKIEFwcGxpY2F0aW9uIEFsZXJ0cyAtICR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBlbWFpbCBzdWJzY3JpcHRpb24gZm9yIHByb2R1Y3Rpb25cbiAgICBpZiAoc3RhZ2UgPT09ICdwcm9kJykge1xuICAgICAgdGhpcy5hbGVydFRvcGljLmFkZFN1YnNjcmlwdGlvbihcbiAgICAgICAgbmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24oJ2FkbWluQHNjNHBlLm5ldCcpXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEN1c3RvbSBsb2cgZ3JvdXBzIHdpdGggcmV0ZW50aW9uXG4gICAgY29uc3QgYXBpTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQXBpTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2FwaWdhdGV3YXkvdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIHJldGVudGlvbjogc3RhZ2UgPT09ICdwcm9kJyA/IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEggOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICBjb25zdCB3ZWJzb2NrZXRMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdXZWJTb2NrZXRMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYXBpZ2F0ZXdheS92ai13ZWJzb2NrZXQtJHtzdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uOiBzdGFnZSA9PT0gJ3Byb2QnID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRGFzaGJvYXJkXG4gICAgdGhpcy5kYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0Rhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGBWSi1BcHBsaWNhdGlvbi0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBtZXRyaWNzXG4gICAgY29uc3QgYXBpUmVxdWVzdENvdW50ID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb3VudCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaU5hbWU6IGB2ai1hcGktJHtzdGFnZX1gLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBpTGF0ZW5jeSA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaU5hbWU6IGB2ai1hcGktJHtzdGFnZX1gLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaUVycm9ycyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICBtZXRyaWNOYW1lOiAnNFhYRXJyb3InLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaVNlcnZlckVycm9ycyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlOYW1lOiBgdmotYXBpLSR7c3RhZ2V9YCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBtZXRyaWNzXG4gICAgY29uc3Qgd2Vic29ja2V0Q29ubmVjdGlvbnMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXlWMicsXG4gICAgICBtZXRyaWNOYW1lOiAnQ29ubmVjdENvdW50JyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpSWQ6IGFwaVN0YWNrLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdlYnNvY2tldE1lc3NhZ2VzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5VjInLFxuICAgICAgbWV0cmljTmFtZTogJ01lc3NhZ2VDb3VudCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaUlkOiBhcGlTdGFjay53ZWJzb2NrZXRBcGkuYXBpSWQsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBtZXRyaWNzXG4gICAgY29uc3Qgc2Vzc2lvblRhYmxlUmVhZHMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgVGFibGVOYW1lOiBzdG9yYWdlU3RhY2suc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNlc3Npb25UYWJsZVdyaXRlcyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgbWV0cmljTmFtZTogJ0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgVGFibGVOYW1lOiBzdG9yYWdlU3RhY2suc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByZXNldFRhYmxlUmVhZHMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgVGFibGVOYW1lOiBzdG9yYWdlU3RhY2sucHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBtZXRyaWNzIChpZiBlbmFibGVkKVxuICAgIGxldCBjbG91ZGZyb250UmVxdWVzdHM6IGNsb3Vkd2F0Y2guTWV0cmljIHwgdW5kZWZpbmVkO1xuICAgIGxldCBjbG91ZGZyb250RXJyb3JSYXRlOiBjbG91ZHdhdGNoLk1ldHJpYyB8IHVuZGVmaW5lZDtcblxuICAgIGlmIChob3N0aW5nU3RhY2suZGlzdHJpYnV0aW9uKSB7XG4gICAgICBjbG91ZGZyb250UmVxdWVzdHMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgIG1ldHJpY05hbWU6ICdSZXF1ZXN0cycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBEaXN0cmlidXRpb25JZDogaG9zdGluZ1N0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICBjbG91ZGZyb250RXJyb3JSYXRlID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0Nsb3VkRnJvbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNHh4RXJyb3JSYXRlJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIERpc3RyaWJ1dGlvbklkOiBob3N0aW5nU3RhY2suZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIERhc2hib2FyZCB3aWRnZXRzXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIEFQSSBHYXRld2F5IHJvd1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IC0gUmVxdWVzdHMnLFxuICAgICAgICBsZWZ0OiBbYXBpUmVxdWVzdENvdW50XSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSAtIExhdGVuY3knLFxuICAgICAgICBsZWZ0OiBbYXBpTGF0ZW5jeV0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSAtIEVycm9ycycsXG4gICAgICAgIGxlZnQ6IFthcGlFcnJvcnMsIGFwaVNlcnZlckVycm9yc10sXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIFdlYlNvY2tldCByb3dcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdXZWJTb2NrZXQgLSBDb25uZWN0aW9ucycsXG4gICAgICAgIGxlZnQ6IFt3ZWJzb2NrZXRDb25uZWN0aW9uc10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnV2ViU29ja2V0IC0gTWVzc2FnZXMnLFxuICAgICAgICBsZWZ0OiBbd2Vic29ja2V0TWVzc2FnZXNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBEeW5hbW9EQiByb3dcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIFJlYWQgQ2FwYWNpdHknLFxuICAgICAgICBsZWZ0OiBbc2Vzc2lvblRhYmxlUmVhZHMsIHByZXNldFRhYmxlUmVhZHNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0R5bmFtb0RCIC0gV3JpdGUgQ2FwYWNpdHknLFxuICAgICAgICBsZWZ0OiBbc2Vzc2lvblRhYmxlV3JpdGVzXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDbG91ZEZyb250IHdpZGdldHMgKGlmIGVuYWJsZWQpXG4gICAgaWYgKGNsb3VkZnJvbnRSZXF1ZXN0cyAmJiBjbG91ZGZyb250RXJyb3JSYXRlKSB7XG4gICAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdDbG91ZEZyb250IC0gUmVxdWVzdHMnLFxuICAgICAgICAgIGxlZnQ6IFtjbG91ZGZyb250UmVxdWVzdHNdLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdDbG91ZEZyb250IC0gRXJyb3IgUmF0ZScsXG4gICAgICAgICAgbGVmdDogW2Nsb3VkZnJvbnRFcnJvclJhdGVdLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEFsYXJtc1xuICAgIGNvbnN0IGhpZ2hFcnJvclJhdGVBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoRXJyb3JSYXRlQWxhcm0nLCB7XG4gICAgICBtZXRyaWM6IGFwaVNlcnZlckVycm9ycyxcbiAgICAgIHRocmVzaG9sZDogNSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBlcnJvciByYXRlIGRldGVjdGVkIGluIEFQSSBHYXRld2F5JyxcbiAgICAgIGFsYXJtTmFtZTogYHZqLWhpZ2gtZXJyb3ItcmF0ZS0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBoaWdoRXJyb3JSYXRlQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxlcnRUb3BpYylcbiAgICApO1xuXG4gICAgY29uc3QgaGlnaExhdGVuY3lBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoTGF0ZW5jeUFsYXJtJywge1xuICAgICAgbWV0cmljOiBhcGlMYXRlbmN5LFxuICAgICAgdGhyZXNob2xkOiA1MDAwLCAvLyA1IHNlY29uZHNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBsYXRlbmN5IGRldGVjdGVkIGluIEFQSSBHYXRld2F5JyxcbiAgICAgIGFsYXJtTmFtZTogYHZqLWhpZ2gtbGF0ZW5jeS0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBoaWdoTGF0ZW5jeUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIEN1c3RvbSBtZXRyaWNzIExhbWJkYSBmdW5jdGlvblxuICAgIGNvbnN0IG1ldHJpY3NGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01ldHJpY3NGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ21ldHJpY3MuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBjbG91ZHdhdGNoID0gbmV3IEFXUy5DbG91ZFdhdGNoKCk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHNlc3Npb24gY291bnRcbiAgICAgICAgICAgIGNvbnN0IHNlc3Npb25Db3VudCA9IGF3YWl0IGR5bmFtb2RiLnNjYW4oe1xuICAgICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlNFU1NJT05fVEFCTEVfTkFNRSxcbiAgICAgICAgICAgICAgU2VsZWN0OiAnQ09VTlQnXG4gICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBwcmVzZXQgY291bnRcbiAgICAgICAgICAgIGNvbnN0IHByZXNldENvdW50ID0gYXdhaXQgZHluYW1vZGIuc2Nhbih7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUFJFU0VUX1RBQkxFX05BTUUsXG4gICAgICAgICAgICAgIFNlbGVjdDogJ0NPVU5UJ1xuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTZW5kIGN1c3RvbSBtZXRyaWNzXG4gICAgICAgICAgICBhd2FpdCBjbG91ZHdhdGNoLnB1dE1ldHJpY0RhdGEoe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdWSi9BcHBsaWNhdGlvbicsXG4gICAgICAgICAgICAgIE1ldHJpY0RhdGE6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnQWN0aXZlU2Vzc2lvbnMnLFxuICAgICAgICAgICAgICAgICAgVmFsdWU6IHNlc3Npb25Db3VudC5Db3VudCB8fCAwLFxuICAgICAgICAgICAgICAgICAgVW5pdDogJ0NvdW50JyxcbiAgICAgICAgICAgICAgICAgIFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ1RvdGFsUHJlc2V0cycsXG4gICAgICAgICAgICAgICAgICBWYWx1ZTogcHJlc2V0Q291bnQuQ291bnQgfHwgMCxcbiAgICAgICAgICAgICAgICAgIFVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ3VzdG9tIG1ldHJpY3MgcHVibGlzaGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBwdWJsaXNoIG1ldHJpY3M6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTRVNTSU9OX1RBQkxFX05BTUU6IHN0b3JhZ2VTdGFjay5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUkVTRVRfVEFCTEVfTkFNRTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciBtZXRyaWNzIGZ1bmN0aW9uXG4gICAgc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZS5ncmFudFJlYWREYXRhKG1ldHJpY3NGdW5jdGlvbik7XG4gICAgc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLmdyYW50UmVhZERhdGEobWV0cmljc0Z1bmN0aW9uKTtcbiAgICBtZXRyaWNzRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIFNjaGVkdWxlIG1ldHJpY3MgZnVuY3Rpb24gdG8gcnVuIGV2ZXJ5IDUgbWludXRlc1xuICAgIGNvbnN0IG1ldHJpY3NSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdNZXRyaWNzU2NoZWR1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkpLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaXNoIGN1c3RvbSBWSiBhcHBsaWNhdGlvbiBtZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIG1ldHJpY3NSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihtZXRyaWNzRnVuY3Rpb24pKTtcblxuICAgIC8vIEN1c3RvbSBtZXRyaWNzIHdpZGdldHNcbiAgICBjb25zdCBhY3RpdmVTZXNzaW9uc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdWSi9BcHBsaWNhdGlvbicsXG4gICAgICBtZXRyaWNOYW1lOiAnQWN0aXZlU2Vzc2lvbnMnLFxuICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdG90YWxQcmVzZXRzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ1ZKL0FwcGxpY2F0aW9uJyxcbiAgICAgIG1ldHJpY05hbWU6ICdUb3RhbFByZXNldHMnLFxuICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBY3RpdmUgU2Vzc2lvbnMnLFxuICAgICAgICBtZXRyaWNzOiBbYWN0aXZlU2Vzc2lvbnNNZXRyaWNdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVG90YWwgUHJlc2V0cycsXG4gICAgICAgIG1ldHJpY3M6IFt0b3RhbFByZXNldHNNZXRyaWNdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQXBwbGljYXRpb24gVXNhZ2UnLFxuICAgICAgICBsZWZ0OiBbYWN0aXZlU2Vzc2lvbnNNZXRyaWMsIHRvdGFsUHJlc2V0c01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke3RoaXMuZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWakRhc2hib2FyZFVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIGFsZXJ0cycsXG4gICAgICBleHBvcnROYW1lOiBgVmpBbGVydFRvcGljQXJuLSR7c3RhZ2V9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==