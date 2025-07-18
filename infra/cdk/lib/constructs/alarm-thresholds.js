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
exports.AlarmThresholds = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
class AlarmThresholds {
    static getThresholds(stage) {
        switch (stage) {
            case 'prod':
                return this.getProdThresholds();
            case 'staging':
                return this.getStagingThresholds();
            default:
                return this.getDevThresholds();
        }
    }
    static getProdThresholds() {
        return {
            api: {
                errorRate: {
                    metric: '4XXError',
                    threshold: 5,
                    evaluationPeriods: 2,
                    datapointsToAlarm: 2,
                    unit: 'Percent',
                    description: 'API 4XX error rate exceeds 5%'
                },
                latency: {
                    metric: 'Latency',
                    threshold: 3000,
                    evaluationPeriods: 3,
                    datapointsToAlarm: 2,
                    unit: 'Milliseconds',
                    description: 'API latency exceeds 3 seconds'
                },
                throttleRate: {
                    metric: 'ThrottleCount',
                    threshold: 10,
                    evaluationPeriods: 1,
                    unit: 'Count',
                    description: 'API throttling detected'
                }
            },
            lambda: {
                errorCount: {
                    metric: 'Errors',
                    threshold: 10,
                    evaluationPeriods: 2,
                    datapointsToAlarm: 2,
                    unit: 'Count',
                    description: 'Lambda errors exceed 10 in 10 minutes'
                },
                throttleCount: {
                    metric: 'Throttles',
                    threshold: 5,
                    evaluationPeriods: 1,
                    unit: 'Count',
                    description: 'Lambda throttling detected'
                },
                duration: {
                    metric: 'Duration',
                    threshold: 10000,
                    evaluationPeriods: 3,
                    datapointsToAlarm: 2,
                    unit: 'Milliseconds',
                    description: 'Lambda duration exceeds 10 seconds'
                },
                concurrentExecutions: {
                    metric: 'ConcurrentExecutions',
                    threshold: 900,
                    evaluationPeriods: 2,
                    unit: 'Count',
                    description: 'Lambda concurrent executions near limit'
                }
            },
            dynamodb: {
                throttledRequests: {
                    metric: 'UserErrors',
                    threshold: 1,
                    evaluationPeriods: 2,
                    unit: 'Count',
                    description: 'DynamoDB throttling detected'
                },
                consumedReadCapacity: {
                    metric: 'ConsumedReadCapacityUnits',
                    threshold: 80,
                    evaluationPeriods: 2,
                    unit: 'Percent',
                    description: 'DynamoDB read capacity usage high'
                },
                consumedWriteCapacity: {
                    metric: 'ConsumedWriteCapacityUnits',
                    threshold: 80,
                    evaluationPeriods: 2,
                    unit: 'Percent',
                    description: 'DynamoDB write capacity usage high'
                }
            },
            cloudfront: {
                errorRate: {
                    metric: '4xxErrorRate',
                    threshold: 5,
                    evaluationPeriods: 2,
                    datapointsToAlarm: 2,
                    unit: 'Percent',
                    description: 'CloudFront 4XX error rate exceeds 5%'
                },
                originLatency: {
                    metric: 'OriginLatency',
                    threshold: 5000,
                    evaluationPeriods: 3,
                    datapointsToAlarm: 2,
                    unit: 'Milliseconds',
                    description: 'CloudFront origin latency exceeds 5 seconds'
                },
                cacheHitRate: {
                    metric: 'CacheHitRate',
                    threshold: 70,
                    evaluationPeriods: 3,
                    unit: 'Percent',
                    description: 'CloudFront cache hit rate below 70%'
                }
            },
            websocket: {
                connectionErrors: {
                    metric: 'ConnectionErrors',
                    threshold: 10,
                    evaluationPeriods: 2,
                    unit: 'Count',
                    description: 'WebSocket connection errors exceed 10'
                },
                messageErrors: {
                    metric: 'MessageErrors',
                    threshold: 20,
                    evaluationPeriods: 2,
                    unit: 'Count',
                    description: 'WebSocket message errors exceed 20'
                }
            }
        };
    }
    static getStagingThresholds() {
        const prodThresholds = this.getProdThresholds();
        // Staging has more relaxed thresholds
        return {
            api: {
                ...prodThresholds.api,
                errorRate: { ...prodThresholds.api.errorRate, threshold: 10 },
                latency: { ...prodThresholds.api.latency, threshold: 5000 }, // 5 seconds
            },
            lambda: {
                ...prodThresholds.lambda,
                errorCount: { ...prodThresholds.lambda.errorCount, threshold: 20 },
                duration: { ...prodThresholds.lambda.duration, threshold: 15000 }, // 15 seconds
            },
            dynamodb: {
                ...prodThresholds.dynamodb,
                throttledRequests: { ...prodThresholds.dynamodb.throttledRequests, threshold: 5 },
            },
            cloudfront: {
                ...prodThresholds.cloudfront,
                errorRate: { ...prodThresholds.cloudfront.errorRate, threshold: 10 },
                cacheHitRate: { ...prodThresholds.cloudfront.cacheHitRate, threshold: 50 }, // 50%
            },
            websocket: {
                ...prodThresholds.websocket,
                connectionErrors: { ...prodThresholds.websocket.connectionErrors, threshold: 20 },
                messageErrors: { ...prodThresholds.websocket.messageErrors, threshold: 50 },
            }
        };
    }
    static getDevThresholds() {
        const prodThresholds = this.getProdThresholds();
        // Dev has very relaxed thresholds (mostly for testing)
        return {
            api: {
                ...prodThresholds.api,
                errorRate: { ...prodThresholds.api.errorRate, threshold: 20 },
                latency: { ...prodThresholds.api.latency, threshold: 10000 },
                throttleRate: { ...prodThresholds.api.throttleRate, threshold: 50 },
            },
            lambda: {
                ...prodThresholds.lambda,
                errorCount: { ...prodThresholds.lambda.errorCount, threshold: 50 },
                duration: { ...prodThresholds.lambda.duration, threshold: 30000 },
                concurrentExecutions: { ...prodThresholds.lambda.concurrentExecutions, threshold: 100 },
            },
            dynamodb: {
                ...prodThresholds.dynamodb,
                throttledRequests: { ...prodThresholds.dynamodb.throttledRequests, threshold: 10 },
                consumedReadCapacity: { ...prodThresholds.dynamodb.consumedReadCapacity, threshold: 95 },
                consumedWriteCapacity: { ...prodThresholds.dynamodb.consumedWriteCapacity, threshold: 95 },
            },
            cloudfront: {
                ...prodThresholds.cloudfront,
                errorRate: { ...prodThresholds.cloudfront.errorRate, threshold: 20 },
                originLatency: { ...prodThresholds.cloudfront.originLatency, threshold: 10000 },
                cacheHitRate: { ...prodThresholds.cloudfront.cacheHitRate, threshold: 30 }, // 30%
            },
            websocket: {
                ...prodThresholds.websocket,
                connectionErrors: { ...prodThresholds.websocket.connectionErrors, threshold: 100 },
                messageErrors: { ...prodThresholds.websocket.messageErrors, threshold: 200 },
            }
        };
    }
    // Helper method to create alarm props
    static createAlarmProps(metricName, threshold, period = cdk.Duration.minutes(5)) {
        return {
            threshold: threshold.threshold,
            evaluationPeriods: threshold.evaluationPeriods,
            datapointsToAlarm: threshold.datapointsToAlarm,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
            comparisonOperator: this.getComparisonOperator(metricName),
            alarmDescription: threshold.description,
            period,
        };
    }
    static getComparisonOperator(metricName) {
        // For metrics where lower is better (like cache hit rate)
        if (metricName.toLowerCase().includes('hitrate')) {
            return cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD;
        }
        // Default: higher is worse
        return cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD;
    }
}
exports.AlarmThresholds = AlarmThresholds;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxhcm0tdGhyZXNob2xkcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFsYXJtLXRocmVzaG9sZHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUF1Q25DLE1BQWEsZUFBZTtJQUNuQixNQUFNLENBQUMsYUFBYSxDQUFDLEtBQWE7UUFDdkMsUUFBUSxLQUFLLEVBQUU7WUFDYixLQUFLLE1BQU07Z0JBQ1QsT0FBTyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUNsQyxLQUFLLFNBQVM7Z0JBQ1osT0FBTyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNyQztnQkFDRSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1NBQ2xDO0lBQ0gsQ0FBQztJQUVPLE1BQU0sQ0FBQyxpQkFBaUI7UUFDOUIsT0FBTztZQUNMLEdBQUcsRUFBRTtnQkFDSCxTQUFTLEVBQUU7b0JBQ1QsTUFBTSxFQUFFLFVBQVU7b0JBQ2xCLFNBQVMsRUFBRSxDQUFDO29CQUNaLGlCQUFpQixFQUFFLENBQUM7b0JBQ3BCLGlCQUFpQixFQUFFLENBQUM7b0JBQ3BCLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSwrQkFBK0I7aUJBQzdDO2dCQUNELE9BQU8sRUFBRTtvQkFDUCxNQUFNLEVBQUUsU0FBUztvQkFDakIsU0FBUyxFQUFFLElBQUk7b0JBQ2YsaUJBQWlCLEVBQUUsQ0FBQztvQkFDcEIsaUJBQWlCLEVBQUUsQ0FBQztvQkFDcEIsSUFBSSxFQUFFLGNBQWM7b0JBQ3BCLFdBQVcsRUFBRSwrQkFBK0I7aUJBQzdDO2dCQUNELFlBQVksRUFBRTtvQkFDWixNQUFNLEVBQUUsZUFBZTtvQkFDdkIsU0FBUyxFQUFFLEVBQUU7b0JBQ2IsaUJBQWlCLEVBQUUsQ0FBQztvQkFDcEIsSUFBSSxFQUFFLE9BQU87b0JBQ2IsV0FBVyxFQUFFLHlCQUF5QjtpQkFDdkM7YUFDRjtZQUNELE1B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UyxDQUFDLFNBQVM7WUFDOUIsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLGlCQUFpQjtZQUM5QyxpQkFBaUIsRUFBRSxTQUFTLENBQUMsaUJBQWlCO1lBQzlDLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtZQUNuRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsVUFBVSxDQUFDO1lBQzFELGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxXQUFXO1lBQ3ZDLE1BQU07U0FDUCxDQUFDO0lBQ0osQ0FBQztJQUVPLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxVQUFrQjtRQUNyRCwwREFBMEQ7UUFDMUQsSUFBSSxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ2hELE9BQU8sR0FBRyxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxtQkFBbUIsQ0FBQztTQUNsRTtRQUNELDJCQUEyQjtRQUMzQixPQUFPLEdBQUcsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsc0JBQXNCLENBQUM7SUFDdEUsQ0FBQztDQUNGO0FBeE9ELDBDQXdPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQWxhcm1UaHJlc2hvbGQge1xuICBtZXRyaWM6IHN0cmluZztcbiAgdGhyZXNob2xkOiBudW1iZXI7XG4gIGV2YWx1YXRpb25QZXJpb2RzOiBudW1iZXI7XG4gIGRhdGFwb2ludHNUb0FsYXJtPzogbnVtYmVyO1xuICB1bml0Pzogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YWdlQWxhcm1UaHJlc2hvbGRzIHtcbiAgYXBpOiB7XG4gICAgZXJyb3JSYXRlOiBBbGFybVRocmVzaG9sZDtcbiAgICBsYXRlbmN5OiBBbGFybVRocmVzaG9sZDtcbiAgICB0aHJvdHRsZVJhdGU6IEFsYXJtVGhyZXNob2xkO1xuICB9O1xuICBsYW1iZGE6IHtcbiAgICBlcnJvckNvdW50OiBBbGFybVRocmVzaG9sZDtcbiAgICB0aHJvdHRsZUNvdW50OiBBbGFybVRocmVzaG9sZDtcbiAgICBkdXJhdGlvbjogQWxhcm1UaHJlc2hvbGQ7XG4gICAgY29uY3VycmVudEV4ZWN1dGlvbnM6IEFsYXJtVGhyZXNob2xkO1xuICB9O1xuICBkeW5hbW9kYjoge1xuICAgIHRocm90dGxlZFJlcXVlc3RzOiBBbGFybVRocmVzaG9sZDtcbiAgICBjb25zdW1lZFJlYWRDYXBhY2l0eTogQWxhcm1UaHJlc2hvbGQ7XG4gICAgY29uc3VtZWRXcml0ZUNhcGFjaXR5OiBBbGFybVRocmVzaG9sZDtcbiAgfTtcbiAgY2xvdWRmcm9udDoge1xuICAgIGVycm9yUmF0ZTogQWxhcm1UaHJlc2hvbGQ7XG4gICAgb3JpZ2luTGF0ZW5jeTogQWxhcm1UaHJlc2hvbGQ7XG4gICAgY2FjaGVIaXRSYXRlOiBBbGFybVRocmVzaG9sZDtcbiAgfTtcbiAgd2Vic29ja2V0OiB7XG4gICAgY29ubmVjdGlvbkVycm9yczogQWxhcm1UaHJlc2hvbGQ7XG4gICAgbWVzc2FnZUVycm9yczogQWxhcm1UaHJlc2hvbGQ7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBBbGFybVRocmVzaG9sZHMge1xuICBwdWJsaWMgc3RhdGljIGdldFRocmVzaG9sZHMoc3RhZ2U6IHN0cmluZyk6IFN0YWdlQWxhcm1UaHJlc2hvbGRzIHtcbiAgICBzd2l0Y2ggKHN0YWdlKSB7XG4gICAgICBjYXNlICdwcm9kJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJvZFRocmVzaG9sZHMoKTtcbiAgICAgIGNhc2UgJ3N0YWdpbmcnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRTdGFnaW5nVGhyZXNob2xkcygpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0RGV2VGhyZXNob2xkcygpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGdldFByb2RUaHJlc2hvbGRzKCk6IFN0YWdlQWxhcm1UaHJlc2hvbGRzIHtcbiAgICByZXR1cm4ge1xuICAgICAgYXBpOiB7XG4gICAgICAgIGVycm9yUmF0ZToge1xuICAgICAgICAgIG1ldHJpYzogJzRYWEVycm9yJyxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDUsIC8vIDUlIGVycm9yIHJhdGVcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgICAgICB1bml0OiAnUGVyY2VudCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgNFhYIGVycm9yIHJhdGUgZXhjZWVkcyA1JSdcbiAgICAgICAgfSxcbiAgICAgICAgbGF0ZW5jeToge1xuICAgICAgICAgIG1ldHJpYzogJ0xhdGVuY3knLFxuICAgICAgICAgIHRocmVzaG9sZDogMzAwMCwgLy8gMyBzZWNvbmRzXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDIsXG4gICAgICAgICAgdW5pdDogJ01pbGxpc2Vjb25kcycsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgbGF0ZW5jeSBleGNlZWRzIDMgc2Vjb25kcydcbiAgICAgICAgfSxcbiAgICAgICAgdGhyb3R0bGVSYXRlOiB7XG4gICAgICAgICAgbWV0cmljOiAnVGhyb3R0bGVDb3VudCcsXG4gICAgICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgICB1bml0OiAnQ291bnQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIHRocm90dGxpbmcgZGV0ZWN0ZWQnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBsYW1iZGE6IHtcbiAgICAgICAgZXJyb3JDb3VudDoge1xuICAgICAgICAgIG1ldHJpYzogJ0Vycm9ycycsXG4gICAgICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgICAgICB1bml0OiAnQ291bnQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGVycm9ycyBleGNlZWQgMTAgaW4gMTAgbWludXRlcydcbiAgICAgICAgfSxcbiAgICAgICAgdGhyb3R0bGVDb3VudDoge1xuICAgICAgICAgIG1ldHJpYzogJ1Rocm90dGxlcycsXG4gICAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICAgIHVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgdGhyb3R0bGluZyBkZXRlY3RlZCdcbiAgICAgICAgfSxcbiAgICAgICAgZHVyYXRpb246IHtcbiAgICAgICAgICBtZXRyaWM6ICdEdXJhdGlvbicsXG4gICAgICAgICAgdGhyZXNob2xkOiAxMDAwMCwgLy8gMTAgc2Vjb25kc1xuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgICAgIGRhdGFwb2ludHNUb0FsYXJtOiAyLFxuICAgICAgICAgIHVuaXQ6ICdNaWxsaXNlY29uZHMnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGR1cmF0aW9uIGV4Y2VlZHMgMTAgc2Vjb25kcydcbiAgICAgICAgfSxcbiAgICAgICAgY29uY3VycmVudEV4ZWN1dGlvbnM6IHtcbiAgICAgICAgICBtZXRyaWM6ICdDb25jdXJyZW50RXhlY3V0aW9ucycsXG4gICAgICAgICAgdGhyZXNob2xkOiA5MDAsIC8vIDkwJSBvZiAxMDAwIGxpbWl0XG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgdW5pdDogJ0NvdW50JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBjb25jdXJyZW50IGV4ZWN1dGlvbnMgbmVhciBsaW1pdCdcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGR5bmFtb2RiOiB7XG4gICAgICAgIHRocm90dGxlZFJlcXVlc3RzOiB7XG4gICAgICAgICAgbWV0cmljOiAnVXNlckVycm9ycycsXG4gICAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0aHJvdHRsaW5nIGRldGVjdGVkJ1xuICAgICAgICB9LFxuICAgICAgICBjb25zdW1lZFJlYWRDYXBhY2l0eToge1xuICAgICAgICAgIG1ldHJpYzogJ0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMnLFxuICAgICAgICAgIHRocmVzaG9sZDogODAsIC8vIDgwJSBvZiBwcm92aXNpb25lZFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHVuaXQ6ICdQZXJjZW50JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHJlYWQgY2FwYWNpdHkgdXNhZ2UgaGlnaCdcbiAgICAgICAgfSxcbiAgICAgICAgY29uc3VtZWRXcml0ZUNhcGFjaXR5OiB7XG4gICAgICAgICAgbWV0cmljOiAnQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMnLFxuICAgICAgICAgIHRocmVzaG9sZDogODAsIC8vIDgwJSBvZiBwcm92aXNpb25lZFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHVuaXQ6ICdQZXJjZW50JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHdyaXRlIGNhcGFjaXR5IHVzYWdlIGhpZ2gnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjbG91ZGZyb250OiB7XG4gICAgICAgIGVycm9yUmF0ZToge1xuICAgICAgICAgIG1ldHJpYzogJzR4eEVycm9yUmF0ZScsXG4gICAgICAgICAgdGhyZXNob2xkOiA1LCAvLyA1JSBlcnJvciByYXRlXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDIsXG4gICAgICAgICAgdW5pdDogJ1BlcmNlbnQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCA0WFggZXJyb3IgcmF0ZSBleGNlZWRzIDUlJ1xuICAgICAgICB9LFxuICAgICAgICBvcmlnaW5MYXRlbmN5OiB7XG4gICAgICAgICAgbWV0cmljOiAnT3JpZ2luTGF0ZW5jeScsXG4gICAgICAgICAgdGhyZXNob2xkOiA1MDAwLCAvLyA1IHNlY29uZHNcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgICAgICB1bml0OiAnTWlsbGlzZWNvbmRzJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgb3JpZ2luIGxhdGVuY3kgZXhjZWVkcyA1IHNlY29uZHMnXG4gICAgICAgIH0sXG4gICAgICAgIGNhY2hlSGl0UmF0ZToge1xuICAgICAgICAgIG1ldHJpYzogJ0NhY2hlSGl0UmF0ZScsXG4gICAgICAgICAgdGhyZXNob2xkOiA3MCwgLy8gQmVsb3cgNzAlIGNhY2hlIGhpdCByYXRlXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICAgICAgdW5pdDogJ1BlcmNlbnQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBjYWNoZSBoaXQgcmF0ZSBiZWxvdyA3MCUnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB3ZWJzb2NrZXQ6IHtcbiAgICAgICAgY29ubmVjdGlvbkVycm9yczoge1xuICAgICAgICAgIG1ldHJpYzogJ0Nvbm5lY3Rpb25FcnJvcnMnLFxuICAgICAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgdW5pdDogJ0NvdW50JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBjb25uZWN0aW9uIGVycm9ycyBleGNlZWQgMTAnXG4gICAgICAgIH0sXG4gICAgICAgIG1lc3NhZ2VFcnJvcnM6IHtcbiAgICAgICAgICBtZXRyaWM6ICdNZXNzYWdlRXJyb3JzJyxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDIwLFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgbWVzc2FnZSBlcnJvcnMgZXhjZWVkIDIwJ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGdldFN0YWdpbmdUaHJlc2hvbGRzKCk6IFN0YWdlQWxhcm1UaHJlc2hvbGRzIHtcbiAgICBjb25zdCBwcm9kVGhyZXNob2xkcyA9IHRoaXMuZ2V0UHJvZFRocmVzaG9sZHMoKTtcbiAgICBcbiAgICAvLyBTdGFnaW5nIGhhcyBtb3JlIHJlbGF4ZWQgdGhyZXNob2xkc1xuICAgIHJldHVybiB7XG4gICAgICBhcGk6IHtcbiAgICAgICAgLi4ucHJvZFRocmVzaG9sZHMuYXBpLFxuICAgICAgICBlcnJvclJhdGU6IHsgLi4ucHJvZFRocmVzaG9sZHMuYXBpLmVycm9yUmF0ZSwgdGhyZXNob2xkOiAxMCB9LCAvLyAxMCVcbiAgICAgICAgbGF0ZW5jeTogeyAuLi5wcm9kVGhyZXNob2xkcy5hcGkubGF0ZW5jeSwgdGhyZXNob2xkOiA1MDAwIH0sIC8vIDUgc2Vjb25kc1xuICAgICAgfSxcbiAgICAgIGxhbWJkYToge1xuICAgICAgICAuLi5wcm9kVGhyZXNob2xkcy5sYW1iZGEsXG4gICAgICAgIGVycm9yQ291bnQ6IHsgLi4ucHJvZFRocmVzaG9sZHMubGFtYmRhLmVycm9yQ291bnQsIHRocmVzaG9sZDogMjAgfSxcbiAgICAgICAgZHVyYXRpb246IHsgLi4ucHJvZFRocmVzaG9sZHMubGFtYmRhLmR1cmF0aW9uLCB0aHJlc2hvbGQ6IDE1MDAwIH0sIC8vIDE1IHNlY29uZHNcbiAgICAgIH0sXG4gICAgICBkeW5hbW9kYjoge1xuICAgICAgICAuLi5wcm9kVGhyZXNob2xkcy5keW5hbW9kYixcbiAgICAgICAgdGhyb3R0bGVkUmVxdWVzdHM6IHsgLi4ucHJvZFRocmVzaG9sZHMuZHluYW1vZGIudGhyb3R0bGVkUmVxdWVzdHMsIHRocmVzaG9sZDogNSB9LFxuICAgICAgfSxcbiAgICAgIGNsb3VkZnJvbnQ6IHtcbiAgICAgICAgLi4ucHJvZFRocmVzaG9sZHMuY2xvdWRmcm9udCxcbiAgICAgICAgZXJyb3JSYXRlOiB7IC4uLnByb2RUaHJlc2hvbGRzLmNsb3VkZnJvbnQuZXJyb3JSYXRlLCB0aHJlc2hvbGQ6IDEwIH0sIC8vIDEwJVxuICAgICAgICBjYWNoZUhpdFJhdGU6IHsgLi4ucHJvZFRocmVzaG9sZHMuY2xvdWRmcm9udC5jYWNoZUhpdFJhdGUsIHRocmVzaG9sZDogNTAgfSwgLy8gNTAlXG4gICAgICB9LFxuICAgICAgd2Vic29ja2V0OiB7XG4gICAgICAgIC4uLnByb2RUaHJlc2hvbGRzLndlYnNvY2tldCxcbiAgICAgICAgY29ubmVjdGlvbkVycm9yczogeyAuLi5wcm9kVGhyZXNob2xkcy53ZWJzb2NrZXQuY29ubmVjdGlvbkVycm9ycywgdGhyZXNob2xkOiAyMCB9LFxuICAgICAgICBtZXNzYWdlRXJyb3JzOiB7IC4uLnByb2RUaHJlc2hvbGRzLndlYnNvY2tldC5tZXNzYWdlRXJyb3JzLCB0aHJlc2hvbGQ6IDUwIH0sXG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGdldERldlRocmVzaG9sZHMoKTogU3RhZ2VBbGFybVRocmVzaG9sZHMge1xuICAgIGNvbnN0IHByb2RUaHJlc2hvbGRzID0gdGhpcy5nZXRQcm9kVGhyZXNob2xkcygpO1xuICAgIFxuICAgIC8vIERldiBoYXMgdmVyeSByZWxheGVkIHRocmVzaG9sZHMgKG1vc3RseSBmb3IgdGVzdGluZylcbiAgICByZXR1cm4ge1xuICAgICAgYXBpOiB7XG4gICAgICAgIC4uLnByb2RUaHJlc2hvbGRzLmFwaSxcbiAgICAgICAgZXJyb3JSYXRlOiB7IC4uLnByb2RUaHJlc2hvbGRzLmFwaS5lcnJvclJhdGUsIHRocmVzaG9sZDogMjAgfSwgLy8gMjAlXG4gICAgICAgIGxhdGVuY3k6IHsgLi4ucHJvZFRocmVzaG9sZHMuYXBpLmxhdGVuY3ksIHRocmVzaG9sZDogMTAwMDAgfSwgLy8gMTAgc2Vjb25kc1xuICAgICAgICB0aHJvdHRsZVJhdGU6IHsgLi4ucHJvZFRocmVzaG9sZHMuYXBpLnRocm90dGxlUmF0ZSwgdGhyZXNob2xkOiA1MCB9LFxuICAgICAgfSxcbiAgICAgIGxhbWJkYToge1xuICAgICAgICAuLi5wcm9kVGhyZXNob2xkcy5sYW1iZGEsXG4gICAgICAgIGVycm9yQ291bnQ6IHsgLi4ucHJvZFRocmVzaG9sZHMubGFtYmRhLmVycm9yQ291bnQsIHRocmVzaG9sZDogNTAgfSxcbiAgICAgICAgZHVyYXRpb246IHsgLi4ucHJvZFRocmVzaG9sZHMubGFtYmRhLmR1cmF0aW9uLCB0aHJlc2hvbGQ6IDMwMDAwIH0sIC8vIDMwIHNlY29uZHNcbiAgICAgICAgY29uY3VycmVudEV4ZWN1dGlvbnM6IHsgLi4ucHJvZFRocmVzaG9sZHMubGFtYmRhLmNvbmN1cnJlbnRFeGVjdXRpb25zLCB0aHJlc2hvbGQ6IDEwMCB9LFxuICAgICAgfSxcbiAgICAgIGR5bmFtb2RiOiB7XG4gICAgICAgIC4uLnByb2RUaHJlc2hvbGRzLmR5bmFtb2RiLFxuICAgICAgICB0aHJvdHRsZWRSZXF1ZXN0czogeyAuLi5wcm9kVGhyZXNob2xkcy5keW5hbW9kYi50aHJvdHRsZWRSZXF1ZXN0cywgdGhyZXNob2xkOiAxMCB9LFxuICAgICAgICBjb25zdW1lZFJlYWRDYXBhY2l0eTogeyAuLi5wcm9kVGhyZXNob2xkcy5keW5hbW9kYi5jb25zdW1lZFJlYWRDYXBhY2l0eSwgdGhyZXNob2xkOiA5NSB9LFxuICAgICAgICBjb25zdW1lZFdyaXRlQ2FwYWNpdHk6IHsgLi4ucHJvZFRocmVzaG9sZHMuZHluYW1vZGIuY29uc3VtZWRXcml0ZUNhcGFjaXR5LCB0aHJlc2hvbGQ6IDk1IH0sXG4gICAgICB9LFxuICAgICAgY2xvdWRmcm9udDoge1xuICAgICAgICAuLi5wcm9kVGhyZXNob2xkcy5jbG91ZGZyb250LFxuICAgICAgICBlcnJvclJhdGU6IHsgLi4ucHJvZFRocmVzaG9sZHMuY2xvdWRmcm9udC5lcnJvclJhdGUsIHRocmVzaG9sZDogMjAgfSwgLy8gMjAlXG4gICAgICAgIG9yaWdpbkxhdGVuY3k6IHsgLi4ucHJvZFRocmVzaG9sZHMuY2xvdWRmcm9udC5vcmlnaW5MYXRlbmN5LCB0aHJlc2hvbGQ6IDEwMDAwIH0sIC8vIDEwIHNlY29uZHNcbiAgICAgICAgY2FjaGVIaXRSYXRlOiB7IC4uLnByb2RUaHJlc2hvbGRzLmNsb3VkZnJvbnQuY2FjaGVIaXRSYXRlLCB0aHJlc2hvbGQ6IDMwIH0sIC8vIDMwJVxuICAgICAgfSxcbiAgICAgIHdlYnNvY2tldDoge1xuICAgICAgICAuLi5wcm9kVGhyZXNob2xkcy53ZWJzb2NrZXQsXG4gICAgICAgIGNvbm5lY3Rpb25FcnJvcnM6IHsgLi4ucHJvZFRocmVzaG9sZHMud2Vic29ja2V0LmNvbm5lY3Rpb25FcnJvcnMsIHRocmVzaG9sZDogMTAwIH0sXG4gICAgICAgIG1lc3NhZ2VFcnJvcnM6IHsgLi4ucHJvZFRocmVzaG9sZHMud2Vic29ja2V0Lm1lc3NhZ2VFcnJvcnMsIHRocmVzaG9sZDogMjAwIH0sXG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8vIEhlbHBlciBtZXRob2QgdG8gY3JlYXRlIGFsYXJtIHByb3BzXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlQWxhcm1Qcm9wcyhcbiAgICBtZXRyaWNOYW1lOiBzdHJpbmcsXG4gICAgdGhyZXNob2xkOiBBbGFybVRocmVzaG9sZCxcbiAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbiA9IGNkay5EdXJhdGlvbi5taW51dGVzKDUpXG4gICk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRocmVzaG9sZDogdGhyZXNob2xkLnRocmVzaG9sZCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiB0aHJlc2hvbGQuZXZhbHVhdGlvblBlcmlvZHMsXG4gICAgICBkYXRhcG9pbnRzVG9BbGFybTogdGhyZXNob2xkLmRhdGFwb2ludHNUb0FsYXJtLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogdGhpcy5nZXRDb21wYXJpc29uT3BlcmF0b3IobWV0cmljTmFtZSksXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiB0aHJlc2hvbGQuZGVzY3JpcHRpb24sXG4gICAgICBwZXJpb2QsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGdldENvbXBhcmlzb25PcGVyYXRvcihtZXRyaWNOYW1lOiBzdHJpbmcpOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yIHtcbiAgICAvLyBGb3IgbWV0cmljcyB3aGVyZSBsb3dlciBpcyBiZXR0ZXIgKGxpa2UgY2FjaGUgaGl0IHJhdGUpXG4gICAgaWYgKG1ldHJpY05hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGl0cmF0ZScpKSB7XG4gICAgICByZXR1cm4gY2RrLmF3c19jbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5MRVNTX1RIQU5fVEhSRVNIT0xEO1xuICAgIH1cbiAgICAvLyBEZWZhdWx0OiBoaWdoZXIgaXMgd29yc2VcbiAgICByZXR1cm4gY2RrLmF3c19jbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xEO1xuICB9XG59Il19