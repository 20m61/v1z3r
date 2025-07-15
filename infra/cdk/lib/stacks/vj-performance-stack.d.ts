/**
 * Performance and Scalability Infrastructure Stack
 * Implements production-grade performance optimization
 */
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
export interface VjPerformanceStackProps extends cdk.StackProps {
    environment: string;
    vpcId?: string;
    certificateArn?: string;
    domainName?: string;
}
export declare class VjPerformanceStack extends cdk.Stack {
    readonly loadBalancer: elbv2.ApplicationLoadBalancer;
    readonly cluster: ecs.Cluster;
    readonly cacheCluster: elasticache.CfnCacheCluster;
    readonly distribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: VjPerformanceStackProps);
}
