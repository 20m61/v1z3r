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

export class AlarmThresholds {
  public static getThresholds(stage: string): StageAlarmThresholds {
    switch (stage) {
      case 'prod':
        return this.getProdThresholds();
      case 'staging':
        return this.getStagingThresholds();
      default:
        return this.getDevThresholds();
    }
  }

  private static getProdThresholds(): StageAlarmThresholds {
    return {
      api: {
        errorRate: {
          metric: '4XXError',
          threshold: 5, // 5% error rate
          evaluationPeriods: 2,
          datapointsToAlarm: 2,
          unit: 'Percent',
          description: 'API 4XX error rate exceeds 5%'
        },
        latency: {
          metric: 'Latency',
          threshold: 3000, // 3 seconds
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
          threshold: 10000, // 10 seconds
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
          unit: 'Milliseconds',
          description: 'Lambda duration exceeds 10 seconds'
        },
        concurrentExecutions: {
          metric: 'ConcurrentExecutions',
          threshold: 900, // 90% of 1000 limit
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
          threshold: 80, // 80% of provisioned
          evaluationPeriods: 2,
          unit: 'Percent',
          description: 'DynamoDB read capacity usage high'
        },
        consumedWriteCapacity: {
          metric: 'ConsumedWriteCapacityUnits',
          threshold: 80, // 80% of provisioned
          evaluationPeriods: 2,
          unit: 'Percent',
          description: 'DynamoDB write capacity usage high'
        }
      },
      cloudfront: {
        errorRate: {
          metric: '4xxErrorRate',
          threshold: 5, // 5% error rate
          evaluationPeriods: 2,
          datapointsToAlarm: 2,
          unit: 'Percent',
          description: 'CloudFront 4XX error rate exceeds 5%'
        },
        originLatency: {
          metric: 'OriginLatency',
          threshold: 5000, // 5 seconds
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
          unit: 'Milliseconds',
          description: 'CloudFront origin latency exceeds 5 seconds'
        },
        cacheHitRate: {
          metric: 'CacheHitRate',
          threshold: 70, // Below 70% cache hit rate
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

  private static getStagingThresholds(): StageAlarmThresholds {
    const prodThresholds = this.getProdThresholds();
    
    // Staging has more relaxed thresholds
    return {
      api: {
        ...prodThresholds.api,
        errorRate: { ...prodThresholds.api.errorRate, threshold: 10 }, // 10%
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
        errorRate: { ...prodThresholds.cloudfront.errorRate, threshold: 10 }, // 10%
        cacheHitRate: { ...prodThresholds.cloudfront.cacheHitRate, threshold: 50 }, // 50%
      },
      websocket: {
        ...prodThresholds.websocket,
        connectionErrors: { ...prodThresholds.websocket.connectionErrors, threshold: 20 },
        messageErrors: { ...prodThresholds.websocket.messageErrors, threshold: 50 },
      }
    };
  }

  private static getDevThresholds(): StageAlarmThresholds {
    const prodThresholds = this.getProdThresholds();
    
    // Dev has very relaxed thresholds (mostly for testing)
    return {
      api: {
        ...prodThresholds.api,
        errorRate: { ...prodThresholds.api.errorRate, threshold: 20 }, // 20%
        latency: { ...prodThresholds.api.latency, threshold: 10000 }, // 10 seconds
        throttleRate: { ...prodThresholds.api.throttleRate, threshold: 50 },
      },
      lambda: {
        ...prodThresholds.lambda,
        errorCount: { ...prodThresholds.lambda.errorCount, threshold: 50 },
        duration: { ...prodThresholds.lambda.duration, threshold: 30000 }, // 30 seconds
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
        errorRate: { ...prodThresholds.cloudfront.errorRate, threshold: 20 }, // 20%
        originLatency: { ...prodThresholds.cloudfront.originLatency, threshold: 10000 }, // 10 seconds
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
  public static createAlarmProps(
    metricName: string,
    threshold: AlarmThreshold,
    period: cdk.Duration = cdk.Duration.minutes(5)
  ): any {
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

  private static getComparisonOperator(metricName: string): cdk.aws_cloudwatch.ComparisonOperator {
    // For metrics where lower is better (like cache hit rate)
    if (metricName.toLowerCase().includes('hitrate')) {
      return cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD;
    }
    // Default: higher is worse
    return cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD;
  }
}