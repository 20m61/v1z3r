import * as cdk from 'aws-cdk-lib';
export interface AlarmThreshold {
    metric: string;
    threshold: number;
    evaluationPeriods: number;
    datapointsToAlarm?: number;
    unit?: string;
    description: string;
}
export interface StageAlarmThresholds {
    api: {
        errorRate: AlarmThreshold;
        latency: AlarmThreshold;
        throttleRate: AlarmThreshold;
    };
    lambda: {
        errorCount: AlarmThreshold;
        throttleCount: AlarmThreshold;
        duration: AlarmThreshold;
        concurrentExecutions: AlarmThreshold;
    };
    dynamodb: {
        throttledRequests: AlarmThreshold;
        consumedReadCapacity: AlarmThreshold;
        consumedWriteCapacity: AlarmThreshold;
    };
    cloudfront: {
        errorRate: AlarmThreshold;
        originLatency: AlarmThreshold;
        cacheHitRate: AlarmThreshold;
    };
    websocket: {
        connectionErrors: AlarmThreshold;
        messageErrors: AlarmThreshold;
    };
}
export declare class AlarmThresholds {
    static getThresholds(stage: string): StageAlarmThresholds;
    private static getProdThresholds;
    private static getStagingThresholds;
    private static getDevThresholds;
    static createAlarmProps(metricName: string, threshold: AlarmThreshold, period?: cdk.Duration): any;
    private static getComparisonOperator;
}
