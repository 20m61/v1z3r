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
exports.VjMonitoringEnhancedStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
class VjMonitoringEnhancedStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // SNS Topic for alarms
        const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
            topicName: `vj-app-alarms-${props.stage}`,
            displayName: `v1z3r ${props.stage} Alarms`,
        });
        if (props.alarmEmail) {
            alarmTopic.addSubscription(new subscriptions.EmailSubscription(props.alarmEmail));
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
            threshold: 1000,
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
            threshold: 5,
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
                threshold: 80,
                comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
                alarmDescription: 'CDN cache hit rate is below 80%',
            }).addAlarmAction(new actions.SnsAction(alarmTopic));
            // High Origin Latency
            new cloudwatch.Alarm(this, 'HighOriginLatencyAlarm', {
                metric: cdnMetrics.originLatency,
                threshold: 500,
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
exports.VjMonitoringEnhancedStack = VjMonitoringEnhancedStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotbW9uaXRvcmluZy1lbmhhbmNlZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLW1vbml0b3JpbmctZW5oYW5jZWQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQyxpRkFBbUU7QUFDbkUsNEVBQThEO0FBZ0I5RCxNQUFhLHlCQUEwQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3RELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUM7UUFDN0UsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsdUJBQXVCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ25ELFNBQVMsRUFBRSxpQkFBaUIsS0FBSyxDQUFDLEtBQUssRUFBRTtZQUN6QyxXQUFXLEVBQUUsU0FBUyxLQUFLLENBQUMsS0FBSyxTQUFTO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtZQUNwQixVQUFVLENBQUMsZUFBZSxDQUN4QixJQUFJLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQ3RELENBQUM7U0FDSDtRQUVELGNBQWM7UUFDZCxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzNCLFNBQVMsRUFBRSxnQkFBZ0I7Z0JBQzNCLFVBQVUsRUFBRSxPQUFPO2dCQUNuQixhQUFhLEVBQUU7b0JBQ2IsT0FBTyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVc7aUJBQzVDO2dCQUNELFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixPQUFPLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM3QixTQUFTLEVBQUUsZ0JBQWdCO2dCQUMzQixVQUFVLEVBQUUsU0FBUztnQkFDckIsYUFBYSxFQUFFO29CQUNiLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXO2lCQUM1QztnQkFDRCxTQUFTLEVBQUUsU0FBUztnQkFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLGFBQWEsRUFBRTtvQkFDYixPQUFPLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVztpQkFDNUM7Z0JBQ0QsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztZQUNGLFlBQVksRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQ2xDLFNBQVMsRUFBRSxnQkFBZ0I7Z0JBQzNCLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixhQUFhLEVBQUU7b0JBQ2IsT0FBTyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVc7aUJBQzVDO2dCQUNELFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7U0FDSCxDQUFDO1FBRUYsaUJBQWlCO1FBQ2pCLE1BQU0sYUFBYSxHQUFHO1lBQ3BCLFFBQVEsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzlCLFNBQVMsRUFBRSxZQUFZO2dCQUN2QixVQUFVLEVBQUUsVUFBVTtnQkFDdEIsYUFBYSxFQUFFO29CQUNiLFlBQVksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxZQUFZO2lCQUN6RDtnQkFDRCxTQUFTLEVBQUUsU0FBUztnQkFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLFlBQVk7Z0JBQ3ZCLFVBQVUsRUFBRSxRQUFRO2dCQUNwQixhQUFhLEVBQUU7b0JBQ2IsWUFBWSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFlBQVk7aUJBQ3pEO2dCQUNELFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUMvQixTQUFTLEVBQUUsWUFBWTtnQkFDdkIsVUFBVSxFQUFFLFdBQVc7Z0JBQ3ZCLGFBQWEsRUFBRTtvQkFDYixZQUFZLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsWUFBWTtpQkFDekQ7Z0JBQ0QsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztZQUNGLG9CQUFvQixFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDMUMsU0FBUyxFQUFFLFlBQVk7Z0JBQ3ZCLFVBQVUsRUFBRSxzQkFBc0I7Z0JBQ2xDLGFBQWEsRUFBRTtvQkFDYixZQUFZLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsWUFBWTtpQkFDekQ7Z0JBQ0QsU0FBUyxFQUFFLFNBQVM7Z0JBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztTQUNILENBQUM7UUFFRixtQkFBbUI7UUFDbkIsTUFBTSxhQUFhLEdBQUc7WUFDcEIsb0JBQW9CLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUMxQyxTQUFTLEVBQUUsY0FBYztnQkFDekIsVUFBVSxFQUFFLDJCQUEyQjtnQkFDdkMsYUFBYSxFQUFFO29CQUNiLFNBQVMsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxTQUFTO2lCQUNwRDtnQkFDRCxTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YscUJBQXFCLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUMzQyxTQUFTLEVBQUUsY0FBYztnQkFDekIsVUFBVSxFQUFFLDRCQUE0QjtnQkFDeEMsYUFBYSxFQUFFO29CQUNiLFNBQVMsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxTQUFTO2lCQUNwRDtnQkFDRCxTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsaUJBQWlCLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUN2QyxTQUFTLEVBQUUsY0FBYztnQkFDekIsVUFBVSxFQUFFLFlBQVk7Z0JBQ3hCLGFBQWEsRUFBRTtvQkFDYixTQUFTLEVBQUUsS0FBSyxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsU0FBUztpQkFDcEQ7Z0JBQ0QsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztTQUNILENBQUM7UUFFRiwyQkFBMkI7UUFDM0IsSUFBSSxVQUFVLENBQUM7UUFDZixJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7WUFDbEIsVUFBVSxHQUFHO2dCQUNYLFFBQVEsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQzlCLFNBQVMsRUFBRSxnQkFBZ0I7b0JBQzNCLFVBQVUsRUFBRSxVQUFVO29CQUN0QixhQUFhLEVBQUU7d0JBQ2IsY0FBYyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLGNBQWM7d0JBQzFELE1BQU0sRUFBRSxRQUFRO3FCQUNqQjtvQkFDRCxTQUFTLEVBQUUsS0FBSztvQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztpQkFDaEMsQ0FBQztnQkFDRixlQUFlLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNyQyxTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFVLEVBQUUsaUJBQWlCO29CQUM3QixhQUFhLEVBQUU7d0JBQ2IsY0FBYyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLGNBQWM7d0JBQzFELE1BQU0sRUFBRSxRQUFRO3FCQUNqQjtvQkFDRCxTQUFTLEVBQUUsS0FBSztvQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztpQkFDaEMsQ0FBQztnQkFDRixhQUFhLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNuQyxTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFVLEVBQUUsZUFBZTtvQkFDM0IsYUFBYSxFQUFFO3dCQUNiLGNBQWMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxjQUFjO3dCQUMxRCxNQUFNLEVBQUUsUUFBUTtxQkFDakI7b0JBQ0QsU0FBUyxFQUFFLFNBQVM7b0JBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQ2hDLENBQUM7Z0JBQ0YsWUFBWSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDbEMsU0FBUyxFQUFFLGdCQUFnQjtvQkFDM0IsVUFBVSxFQUFFLGNBQWM7b0JBQzFCLGFBQWEsRUFBRTt3QkFDYixjQUFjLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsY0FBYzt3QkFDMUQsTUFBTSxFQUFFLFFBQVE7cUJBQ2pCO29CQUNELFNBQVMsRUFBRSxTQUFTO29CQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUNoQyxDQUFDO2dCQUNGLFNBQVMsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQy9CLFNBQVMsRUFBRSxnQkFBZ0I7b0JBQzNCLFVBQVUsRUFBRSxjQUFjO29CQUMxQixhQUFhLEVBQUU7d0JBQ2IsY0FBYyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLGNBQWM7d0JBQzFELE1BQU0sRUFBRSxRQUFRO3FCQUNqQjtvQkFDRCxTQUFTLEVBQUUsU0FBUztvQkFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztpQkFDaEMsQ0FBQzthQUNILENBQUM7U0FDSDtRQUVELDRCQUE0QjtRQUM1QixNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3BFLGFBQWEsRUFBRSxtQkFBbUIsS0FBSyxDQUFDLEtBQUssRUFBRTtZQUMvQyxPQUFPLEVBQUU7Z0JBQ1A7b0JBQ0Usc0JBQXNCO29CQUN0QixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7d0JBQ3pCLEtBQUssRUFBRSxxQkFBcUI7d0JBQzVCLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQzt3QkFDakMsS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDLFlBQVksQ0FBQzt3QkFDakUsS0FBSyxFQUFFLEVBQUU7d0JBQ1QsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztvQkFDRixvQkFBb0I7b0JBQ3BCLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQzt3QkFDekIsS0FBSyxFQUFFLFlBQVk7d0JBQ25CLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQzt3QkFDL0IsS0FBSyxFQUFFLEVBQUU7d0JBQ1QsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztpQkFDSDtnQkFDRDtvQkFDRSxxQkFBcUI7b0JBQ3JCLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQzt3QkFDekIsS0FBSyxFQUFFLG1CQUFtQjt3QkFDMUIsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQzt3QkFDOUIsS0FBSyxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUMsU0FBUyxDQUFDO3dCQUN0RCxLQUFLLEVBQUUsRUFBRTt3QkFDVCxNQUFNLEVBQUUsQ0FBQztxQkFDVixDQUFDO29CQUNGLHFCQUFxQjtvQkFDckIsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUN6QixLQUFLLEVBQUUsY0FBYzt3QkFDckIsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLG9CQUFvQixDQUFDO3dCQUMxQyxLQUFLLEVBQUUsRUFBRTt3QkFDVCxNQUFNLEVBQUUsQ0FBQztxQkFDVixDQUFDO2lCQUNIO2dCQUNEO29CQUNFLG9CQUFvQjtvQkFDcEIsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUN6QixLQUFLLEVBQUUscUJBQXFCO3dCQUM1QixJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLEVBQUUsYUFBYSxDQUFDLHFCQUFxQixDQUFDO3dCQUMvRSxLQUFLLEVBQUUsQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUM7d0JBQ3hDLEtBQUssRUFBRSxFQUFFO3dCQUNULE1BQU0sRUFBRSxDQUFDO3FCQUNWLENBQUM7aUJBQ0g7Z0JBQ0QsMkJBQTJCO2dCQUMzQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNoQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7NEJBQ3pCLEtBQUssRUFBRSxzQkFBc0I7NEJBQzdCLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLGVBQWUsQ0FBQzs0QkFDdkQsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQzs0QkFDakMsS0FBSyxFQUFFLEVBQUU7NEJBQ1QsTUFBTSxFQUFFLENBQUM7eUJBQ1YsQ0FBQzt3QkFDRixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7NEJBQ3pCLEtBQUssRUFBRSxvQkFBb0I7NEJBQzNCLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUM7NEJBQy9CLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7NEJBQzdCLEtBQUssRUFBRSxFQUFFOzRCQUNULE1BQU0sRUFBRSxDQUFDO3lCQUNWLENBQUM7cUJBQ0gsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7YUFDVDtTQUNGLENBQUMsQ0FBQztRQUVILFNBQVM7UUFDVCxtQkFBbUI7UUFDbkIsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNoRCxNQUFNLEVBQUUsaUJBQWlCLENBQUMsT0FBTztZQUNqQyxTQUFTLEVBQUUsSUFBSTtZQUNmLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7WUFDM0QsZ0JBQWdCLEVBQUUsK0JBQStCO1NBQ2xELENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFFckQsa0JBQWtCO1FBQ2xCLE1BQU0sZUFBZSxHQUFHLElBQUksVUFBVSxDQUFDLGNBQWMsQ0FBQztZQUNwRCxVQUFVLEVBQUUsdUNBQXVDO1lBQ25ELFlBQVksRUFBRTtnQkFDWixNQUFNLEVBQUUsaUJBQWlCLENBQUMsTUFBTTtnQkFDaEMsWUFBWSxFQUFFLGlCQUFpQixDQUFDLFlBQVk7Z0JBQzVDLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxLQUFLO2FBQy9CO1lBQ0QsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQy9DLE1BQU0sRUFBRSxlQUFlO1lBQ3ZCLFNBQVMsRUFBRSxDQUFDO1lBQ1osaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtZQUMzRCxnQkFBZ0IsRUFBRSw0QkFBNEI7U0FDL0MsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUVyRCxnQkFBZ0I7UUFDaEIsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUM5QyxNQUFNLEVBQUUsYUFBYSxDQUFDLE1BQU07WUFDNUIsU0FBUyxFQUFFLEVBQUU7WUFDYixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1lBQzNELGdCQUFnQixFQUFFLHlDQUF5QztTQUM1RCxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRXJELHNCQUFzQjtRQUN0QixJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2xELE1BQU0sRUFBRSxhQUFhLENBQUMsaUJBQWlCO1lBQ3ZDLFNBQVMsRUFBRSxDQUFDO1lBQ1osaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtZQUMzRCxnQkFBZ0IsRUFBRSxtQ0FBbUM7U0FDdEQsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUVyRCwwQkFBMEI7UUFDMUIsSUFBSSxVQUFVLEVBQUU7WUFDZCxxQkFBcUI7WUFDckIsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtnQkFDakQsTUFBTSxFQUFFLFVBQVUsQ0FBQyxZQUFZO2dCQUMvQixTQUFTLEVBQUUsRUFBRTtnQkFDYixrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsbUJBQW1CO2dCQUNyRSxpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtnQkFDM0QsZ0JBQWdCLEVBQUUsaUNBQWlDO2FBQ3BELENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFFckQsc0JBQXNCO1lBQ3RCLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7Z0JBQ25ELE1BQU0sRUFBRSxVQUFVLENBQUMsYUFBYTtnQkFDaEMsU0FBUyxFQUFFLEdBQUc7Z0JBQ2QsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7Z0JBQzNELGdCQUFnQixFQUFFLG1DQUFtQzthQUN0RCxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1NBQ3REO1FBRUQsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSx5REFBeUQsSUFBSSxDQUFDLE1BQU0sb0JBQW9CLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDeEgsV0FBVyxFQUFFLG1DQUFtQztTQUNqRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsVUFBVSxDQUFDLFFBQVE7WUFDMUIsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUFoVkQsOERBZ1ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgVmpBcGlTdGFjayB9IGZyb20gJy4vdmotYXBpLXN0YWNrJztcbmltcG9ydCB7IFZqU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi92ai1zdG9yYWdlLXN0YWNrJztcbmltcG9ydCB7IFZqU3RhdGljSG9zdGluZ1N0YWNrIH0gZnJvbSAnLi92ai1zdGF0aWMtaG9zdGluZy1zdGFjayc7XG5pbXBvcnQgeyBWakNkblN0YWNrIH0gZnJvbSAnLi92ai1jZG4tc3RhY2snO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqTW9uaXRvcmluZ0VuaGFuY2VkU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgYXBpU3RhY2s6IFZqQXBpU3RhY2s7XG4gIHN0b3JhZ2VTdGFjazogVmpTdG9yYWdlU3RhY2s7XG4gIGhvc3RpbmdTdGFjazogVmpTdGF0aWNIb3N0aW5nU3RhY2s7XG4gIGNkblN0YWNrPzogVmpDZG5TdGFjaztcbiAgYWxhcm1FbWFpbD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFZqTW9uaXRvcmluZ0VuaGFuY2VkU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpNb25pdG9yaW5nRW5oYW5jZWRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIGFsYXJtc1xuICAgIGNvbnN0IGFsYXJtVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBbGFybVRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgdmotYXBwLWFsYXJtcy0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICBkaXNwbGF5TmFtZTogYHYxejNyICR7cHJvcHMuc3RhZ2V9IEFsYXJtc2AsXG4gICAgfSk7XG5cbiAgICBpZiAocHJvcHMuYWxhcm1FbWFpbCkge1xuICAgICAgYWxhcm1Ub3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICAgIG5ldyBzdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLmFsYXJtRW1haWwpXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEFQSSBNZXRyaWNzXG4gICAgY29uc3QgYXBpR2F0ZXdheU1ldHJpY3MgPSB7XG4gICAgICBjb3VudDogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQ291bnQnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgQXBpTmFtZTogcHJvcHMuYXBpU3RhY2sucmVzdEFwaS5yZXN0QXBpTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgIH0pLFxuICAgICAgbGF0ZW5jeTogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiBwcm9wcy5hcGlTdGFjay5yZXN0QXBpLnJlc3RBcGlOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgIH0pLFxuICAgICAgZXJyb3JzOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgIG1ldHJpY05hbWU6ICc0WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiBwcm9wcy5hcGlTdGFjay5yZXN0QXBpLnJlc3RBcGlOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgfSksXG4gICAgICBzZXJ2ZXJFcnJvcnM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJzVYWEVycm9yJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEFwaU5hbWU6IHByb3BzLmFwaVN0YWNrLnJlc3RBcGkucmVzdEFwaU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICB9KSxcbiAgICB9O1xuXG4gICAgLy8gTGFtYmRhIE1ldHJpY3NcbiAgICBjb25zdCBsYW1iZGFNZXRyaWNzID0ge1xuICAgICAgZHVyYXRpb246IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRnVuY3Rpb25OYW1lOiBwcm9wcy5hcGlTdGFjay5wcmVzZXRGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgfSksXG4gICAgICBlcnJvcnM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRXJyb3JzJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogcHJvcHMuYXBpU3RhY2sucHJlc2V0RnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgfSksXG4gICAgICB0aHJvdHRsZXM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVGhyb3R0bGVzJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogcHJvcHMuYXBpU3RhY2sucHJlc2V0RnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgfSksXG4gICAgICBjb25jdXJyZW50RXhlY3V0aW9uczogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDb25jdXJyZW50RXhlY3V0aW9ucycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6IHByb3BzLmFwaVN0YWNrLnByZXNldEZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICB9KSxcbiAgICB9O1xuXG4gICAgLy8gRHluYW1vREIgTWV0cmljc1xuICAgIGNvbnN0IGR5bmFtb01ldHJpY3MgPSB7XG4gICAgICBjb25zdW1lZFJlYWRDYXBhY2l0eTogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9wcy5zdG9yYWdlU3RhY2sucHJlc2V0VGFibGUudGFibGVOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgfSksXG4gICAgICBjb25zdW1lZFdyaXRlQ2FwYWNpdHk6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9EeW5hbW9EQicsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBUYWJsZU5hbWU6IHByb3BzLnN0b3JhZ2VTdGFjay5wcmVzZXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICB9KSxcbiAgICAgIHRocm90dGxlZFJlcXVlc3RzOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVXNlckVycm9ycycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBUYWJsZU5hbWU6IHByb3BzLnN0b3JhZ2VTdGFjay5wcmVzZXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICB9KSxcbiAgICB9O1xuXG4gICAgLy8gQ0ROIE1ldHJpY3MgKGlmIGVuYWJsZWQpXG4gICAgbGV0IGNkbk1ldHJpY3M7XG4gICAgaWYgKHByb3BzLmNkblN0YWNrKSB7XG4gICAgICBjZG5NZXRyaWNzID0ge1xuICAgICAgICByZXF1ZXN0czogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1JlcXVlc3RzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBEaXN0cmlidXRpb25JZDogcHJvcHMuY2RuU3RhY2suZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICAgICAgUmVnaW9uOiAnR2xvYmFsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICAgIGJ5dGVzRG93bmxvYWRlZDogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0J5dGVzRG93bmxvYWRlZCcsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgRGlzdHJpYnV0aW9uSWQ6IHByb3BzLmNkblN0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgICAgIFJlZ2lvbjogJ0dsb2JhbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICBvcmlnaW5MYXRlbmN5OiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9DbG91ZEZyb250JyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnT3JpZ2luTGF0ZW5jeScsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgRGlzdHJpYnV0aW9uSWQ6IHByb3BzLmNkblN0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgICAgIFJlZ2lvbjogJ0dsb2JhbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgY2FjaGVIaXRSYXRlOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9DbG91ZEZyb250JyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnQ2FjaGVIaXRSYXRlJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBEaXN0cmlidXRpb25JZDogcHJvcHMuY2RuU3RhY2suZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICAgICAgUmVnaW9uOiAnR2xvYmFsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICBlcnJvclJhdGU6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0Nsb3VkRnJvbnQnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICc0eHhFcnJvclJhdGUnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIERpc3RyaWJ1dGlvbklkOiBwcm9wcy5jZG5TdGFjay5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgICAgICBSZWdpb246ICdHbG9iYWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBFbmhhbmNlZCBEYXNoYm9hcmRcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0VuaGFuY2VkRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYHZqLWFwcC1lbmhhbmNlZC0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICB3aWRnZXRzOiBbXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBBUEkgR2F0ZXdheSBNZXRyaWNzXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdBUEkg44Os44K544Od44Oz44K544K/44Kk44OgICYg44Ko44Op44O8546HJyxcbiAgICAgICAgICAgIGxlZnQ6IFthcGlHYXRld2F5TWV0cmljcy5sYXRlbmN5XSxcbiAgICAgICAgICAgIHJpZ2h0OiBbYXBpR2F0ZXdheU1ldHJpY3MuZXJyb3JzLCBhcGlHYXRld2F5TWV0cmljcy5zZXJ2ZXJFcnJvcnNdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIC8vIEFQSSBSZXF1ZXN0IENvdW50XG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdBUEkg44Oq44Kv44Ko44K544OI5pWwJyxcbiAgICAgICAgICAgIGxlZnQ6IFthcGlHYXRld2F5TWV0cmljcy5jb3VudF0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBMYW1iZGEgUGVyZm9ybWFuY2VcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0xhbWJkYSDlrp/ooYzmmYLplpMgJiDjgqjjg6njg7wnLFxuICAgICAgICAgICAgbGVmdDogW2xhbWJkYU1ldHJpY3MuZHVyYXRpb25dLFxuICAgICAgICAgICAgcmlnaHQ6IFtsYW1iZGFNZXRyaWNzLmVycm9ycywgbGFtYmRhTWV0cmljcy50aHJvdHRsZXNdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIC8vIExhbWJkYSBDb25jdXJyZW5jeVxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTGFtYmRhIOWQjOaZguWun+ihjOaVsCcsXG4gICAgICAgICAgICBsZWZ0OiBbbGFtYmRhTWV0cmljcy5jb25jdXJyZW50RXhlY3V0aW9uc10sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBEeW5hbW9EQiBDYXBhY2l0eVxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnRHluYW1vREIg44Kt44Oj44OR44K344OG44Kj5L2/55So54q25rOBJyxcbiAgICAgICAgICAgIGxlZnQ6IFtkeW5hbW9NZXRyaWNzLmNvbnN1bWVkUmVhZENhcGFjaXR5LCBkeW5hbW9NZXRyaWNzLmNvbnN1bWVkV3JpdGVDYXBhY2l0eV0sXG4gICAgICAgICAgICByaWdodDogW2R5bmFtb01ldHJpY3MudGhyb3R0bGVkUmVxdWVzdHNdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICAvLyBDRE4gTWV0cmljcyAoaWYgZW5hYmxlZClcbiAgICAgICAgLi4uKGNkbk1ldHJpY3MgPyBbW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnQ0ROIOODiOODqeODleOCo+ODg+OCryAmIOODkeODleOCqeODvOODnuODs+OCuScsXG4gICAgICAgICAgICBsZWZ0OiBbY2RuTWV0cmljcy5yZXF1ZXN0cywgY2RuTWV0cmljcy5ieXRlc0Rvd25sb2FkZWRdLFxuICAgICAgICAgICAgcmlnaHQ6IFtjZG5NZXRyaWNzLm9yaWdpbkxhdGVuY3ldLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnQ0ROIOOCreODo+ODg+OCt+ODpeWKueeOhyAmIOOCqOODqeODvOeOhycsXG4gICAgICAgICAgICBsZWZ0OiBbY2RuTWV0cmljcy5jYWNoZUhpdFJhdGVdLFxuICAgICAgICAgICAgcmlnaHQ6IFtjZG5NZXRyaWNzLmVycm9yUmF0ZV0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF1dIDogW10pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFsYXJtc1xuICAgIC8vIEhpZ2ggQVBJIExhdGVuY3lcbiAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaEFwaUxhdGVuY3lBbGFybScsIHtcbiAgICAgIG1ldHJpYzogYXBpR2F0ZXdheU1ldHJpY3MubGF0ZW5jeSxcbiAgICAgIHRocmVzaG9sZDogMTAwMCwgLy8gMSBzZWNvbmRcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIGxhdGVuY3kgaXMgYWJvdmUgMSBzZWNvbmQnLFxuICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBhY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XG5cbiAgICAvLyBIaWdoIEVycm9yIFJhdGVcbiAgICBjb25zdCBlcnJvclJhdGVNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NYXRoRXhwcmVzc2lvbih7XG4gICAgICBleHByZXNzaW9uOiAnKGVycm9ycyArIHNlcnZlckVycm9ycykgLyBjb3VudCAqIDEwMCcsXG4gICAgICB1c2luZ01ldHJpY3M6IHtcbiAgICAgICAgZXJyb3JzOiBhcGlHYXRld2F5TWV0cmljcy5lcnJvcnMsXG4gICAgICAgIHNlcnZlckVycm9yczogYXBpR2F0ZXdheU1ldHJpY3Muc2VydmVyRXJyb3JzLFxuICAgICAgICBjb3VudDogYXBpR2F0ZXdheU1ldHJpY3MuY291bnQsXG4gICAgICB9LFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoRXJyb3JSYXRlQWxhcm0nLCB7XG4gICAgICBtZXRyaWM6IGVycm9yUmF0ZU1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogNSwgLy8gNSVcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIGVycm9yIHJhdGUgaXMgYWJvdmUgNSUnLFxuICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBhY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XG5cbiAgICAvLyBMYW1iZGEgRXJyb3JzXG4gICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0xhbWJkYUVycm9yc0FsYXJtJywge1xuICAgICAgbWV0cmljOiBsYW1iZGFNZXRyaWNzLmVycm9ycyxcbiAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBoYXMgbW9yZSB0aGFuIDEwIGVycm9ycycsXG4gICAgfSkuYWRkQWxhcm1BY3Rpb24obmV3IGFjdGlvbnMuU25zQWN0aW9uKGFsYXJtVG9waWMpKTtcblxuICAgIC8vIER5bmFtb0RCIFRocm90dGxpbmdcbiAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRHluYW1vVGhyb3R0bGluZ0FsYXJtJywge1xuICAgICAgbWV0cmljOiBkeW5hbW9NZXRyaWNzLnRocm90dGxlZFJlcXVlc3RzLFxuICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBpcyBiZWluZyB0aHJvdHRsZWQnLFxuICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBhY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XG5cbiAgICAvLyBDRE4gQWxhcm1zIChpZiBlbmFibGVkKVxuICAgIGlmIChjZG5NZXRyaWNzKSB7XG4gICAgICAvLyBMb3cgQ2FjaGUgSGl0IFJhdGVcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdMb3dDYWNoZUhpdFJhdGVBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiBjZG5NZXRyaWNzLmNhY2hlSGl0UmF0ZSxcbiAgICAgICAgdGhyZXNob2xkOiA4MCwgLy8gODAlXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQ0ROIGNhY2hlIGhpdCByYXRlIGlzIGJlbG93IDgwJScsXG4gICAgICB9KS5hZGRBbGFybUFjdGlvbihuZXcgYWN0aW9ucy5TbnNBY3Rpb24oYWxhcm1Ub3BpYykpO1xuXG4gICAgICAvLyBIaWdoIE9yaWdpbiBMYXRlbmN5XG4gICAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaE9yaWdpbkxhdGVuY3lBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiBjZG5NZXRyaWNzLm9yaWdpbkxhdGVuY3ksXG4gICAgICAgIHRocmVzaG9sZDogNTAwLCAvLyA1MDBtc1xuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdDRE4gb3JpZ2luIGxhdGVuY3kgaXMgYWJvdmUgNTAwbXMnLFxuICAgICAgfSkuYWRkQWxhcm1BY3Rpb24obmV3IGFjdGlvbnMuU25zQWN0aW9uKGFsYXJtVG9waWMpKTtcbiAgICB9XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL2Nsb3Vkd2F0Y2gvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jZGFzaGJvYXJkczpuYW1lPSR7ZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW5oYW5jZWQgQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGFybVRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IGFsYXJtVG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIGFsYXJtcycsXG4gICAgfSk7XG5cbiAgICAvLyBUYWdzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdBcHBsaWNhdGlvbicsICd2MXozcicpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhZ2UnLCBwcm9wcy5zdGFnZSk7XG4gIH1cbn0iXX0=