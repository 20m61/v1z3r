"use strict";
/**
 * Performance and Scalability Infrastructure Stack
 * Implements production-grade performance optimization
 */
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
exports.VjPerformanceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const autoscaling = __importStar(require("aws-cdk-lib/aws-autoscaling"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const elasticache = __importStar(require("aws-cdk-lib/aws-elasticache"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
class VjPerformanceStack extends cdk.Stack {
    loadBalancer;
    cluster;
    cacheCluster;
    distribution;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { environment } = props;
        // VPC Configuration
        let vpc;
        if (props.vpcId) {
            vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
                vpcId: props.vpcId,
            });
        }
        else {
            vpc = new ec2.Vpc(this, 'VjVpc', {
                maxAzs: 3,
                natGateways: environment === 'prod' ? 3 : 1,
                subnetConfiguration: [
                    {
                        cidrMask: 24,
                        name: 'public',
                        subnetType: ec2.SubnetType.PUBLIC,
                    },
                    {
                        cidrMask: 24,
                        name: 'private',
                        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    },
                    {
                        cidrMask: 28,
                        name: 'isolated',
                        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    },
                ],
            });
        }
        // ECS Cluster for containerized application
        this.cluster = new ecs.Cluster(this, 'VjCluster', {
            vpc,
            clusterName: `vj-cluster-${environment}`,
            containerInsights: true,
            enableFargateCapacityProviders: true,
        });
        // Auto Scaling Group for EC2 instances
        const asg = new autoscaling.AutoScalingGroup(this, 'VjAutoScalingGroup', {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, environment === 'prod' ? ec2.InstanceSize.MEDIUM : ec2.InstanceSize.SMALL),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            minCapacity: environment === 'prod' ? 2 : 1,
            maxCapacity: environment === 'prod' ? 20 : 5,
            desiredCapacity: environment === 'prod' ? 3 : 1,
            // Performance optimizations
            spotPrice: environment !== 'prod' ? '0.05' : undefined,
            // Auto Scaling policies
            autoScalingGroupName: `vj-asg-${environment}`,
        });
        // Add capacity to ECS cluster
        const capacityProvider = new ecs.AsgCapacityProvider(this, 'VjCapacityProvider', {
            autoScalingGroup: asg,
            enableManagedScaling: true,
            enableManagedTerminationProtection: false,
            targetCapacityPercent: 80,
            canContainersAccessInstanceRole: true,
        });
        this.cluster.addAsgCapacityProvider(capacityProvider);
        // Application Load Balancer
        this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'VjLoadBalancer', {
            vpc,
            internetFacing: true,
            loadBalancerName: `vj-alb-${environment}`,
            // Performance and security settings
            deletionProtection: environment === 'prod',
            idleTimeout: cdk.Duration.seconds(60),
        });
        // Health check target group
        const healthTargetGroup = new elbv2.ApplicationTargetGroup(this, 'HealthTargetGroup', {
            vpc,
            port: 3000,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targetType: elbv2.TargetType.IP,
            // Health check configuration
            healthCheck: {
                enabled: true,
                path: '/api/health',
                protocol: elbv2.Protocol.HTTP,
                port: '3000',
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(5),
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 3,
                healthyHttpCodes: '200',
            },
            // Target group attributes for performance
            deregistrationDelay: cdk.Duration.seconds(30),
            stickinessCookieDuration: cdk.Duration.hours(1),
        });
        // ElastiCache for Redis caching
        const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
            description: 'Subnet group for Redis cache',
            subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
            cacheSubnetGroupName: `vj-cache-subnet-${environment}`,
        });
        const cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
            vpc,
            description: 'Security group for Redis cache',
            allowAllOutbound: false,
        });
        cacheSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(6379), 'Allow Redis access');
        this.cacheCluster = new elasticache.CfnCacheCluster(this, 'RedisCache', {
            cacheNodeType: environment === 'prod' ? 'cache.t3.medium' : 'cache.t3.micro',
            engine: 'redis',
            numCacheNodes: 1,
            cacheSubnetGroupName: cacheSubnetGroup.cacheSubnetGroupName,
            vpcSecurityGroupIds: [cacheSecurityGroup.securityGroupId],
            // Performance settings
            cacheClusterId: `vj-redis-${environment}`,
            engineVersion: '7.0',
            port: 6379,
            // Backup and maintenance
            preferredMaintenanceWindow: 'sun:03:00-sun:04:00',
            snapshotRetentionLimit: environment === 'prod' ? 7 : 1,
            snapshotWindow: '02:00-03:00',
        });
        // CloudFront Distribution for global CDN
        const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
            bucketName: `vj-assets-${environment}-${this.account}`,
            removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            // Performance optimizations
            transferAcceleration: true,
            intelligentTieringConfigurations: [{
                    id: 'intelligent-tiering',
                    status: s3.IntelligentTieringStatus.ENABLED,
                }],
            // CORS configuration
            cors: [{
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    maxAge: 86400,
                }],
        });
        this.distribution = new cloudfront.Distribution(this, 'VjDistribution', {
            defaultBehavior: {
                origin: new cloudfront.HttpOrigin(this.loadBalancer.loadBalancerDnsName, {
                    httpPort: 80,
                    httpsPort: 443,
                    protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
                }),
                // Caching behavior for dynamic content
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                // Compression
                compress: true,
            },
            // Static assets behavior
            additionalBehaviors: {
                '/static/*': {
                    origin: new cloudfront.S3Origin(assetsBucket),
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    compress: true,
                },
                '/_next/static/*': {
                    origin: new cloudfront.S3Origin(assetsBucket),
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED_FOR_UNCOMPRESSED_OBJECTS,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    compress: true,
                },
            },
            // Distribution settings
            enabled: true,
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            priceClass: environment === 'prod' ? cloudfront.PriceClass.PRICE_CLASS_ALL : cloudfront.PriceClass.PRICE_CLASS_100,
            // Certificate and domain
            ...(props.certificateArn && props.domainName && {
                certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn),
                domainNames: [props.domainName],
            }),
        });
        // CloudWatch Dashboard for monitoring
        const dashboard = new cloudwatch.Dashboard(this, 'PerformanceDashboard', {
            dashboardName: `vj-performance-${environment}`,
        });
        // Performance metrics
        const cpuMetric = new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'TargetResponseTime',
            dimensionsMap: {
                LoadBalancer: this.loadBalancer.loadBalancerFullName,
            },
            statistic: 'Average',
        });
        const memoryMetric = new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
                ClusterName: this.cluster.clusterName,
            },
            statistic: 'Average',
        });
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Response Time',
            left: [cpuMetric],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Memory Utilization',
            left: [memoryMetric],
            width: 12,
            height: 6,
        }));
        // Auto Scaling based on performance metrics
        const responseTimeScaling = asg.scaleOnMetric('ResponseTimeScaling', {
            metric: cpuMetric,
            scalingSteps: [
                { upper: 200, change: -1 },
                { lower: 500, change: +1 },
                { lower: 1000, change: +2 },
            ],
            adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
            cooldown: cdk.Duration.minutes(3),
        });
        // Memory-based scaling
        const memoryScaling = asg.scaleOnMetric('MemoryScaling', {
            metric: memoryMetric,
            scalingSteps: [
                { upper: 50, change: -1 },
                { lower: 80, change: +1 },
                { lower: 90, change: +2 },
            ],
            adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
            cooldown: cdk.Duration.minutes(5),
        });
        // Outputs
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: this.loadBalancer.loadBalancerDnsName,
            description: 'Application Load Balancer DNS name',
        });
        new cdk.CfnOutput(this, 'CloudFrontDomain', {
            value: this.distribution.distributionDomainName,
            description: 'CloudFront distribution domain name',
        });
        new cdk.CfnOutput(this, 'RedisEndpoint', {
            value: this.cacheCluster.attrRedisEndpointAddress,
            description: 'Redis cache endpoint',
        });
        // Tags
        cdk.Tags.of(this).add('Environment', environment);
        cdk.Tags.of(this).add('Project', 'v1z3r');
        cdk.Tags.of(this).add('Stack', 'Performance');
    }
}
exports.VjPerformanceStack = VjPerformanceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotcGVyZm9ybWFuY2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2ai1wZXJmb3JtYW5jZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDhFQUFnRTtBQUNoRSx5RUFBMkQ7QUFDM0QsdUVBQXlEO0FBQ3pELHlFQUEyRDtBQUUzRCx1RUFBeUQ7QUFDekQsdURBQXlDO0FBRXpDLHdFQUEwRDtBQVUxRCxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQy9CLFlBQVksQ0FBZ0M7SUFDNUMsT0FBTyxDQUFjO0lBQ3JCLFlBQVksQ0FBOEI7SUFDMUMsWUFBWSxDQUEwQjtJQUV0RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQThCO1FBQ3RFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFOUIsb0JBQW9CO1FBQ3BCLElBQUksR0FBYSxDQUFDO1FBQ2xCLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRTtZQUNmLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO2dCQUM1QyxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7YUFDbkIsQ0FBQyxDQUFDO1NBQ0o7YUFBTTtZQUNMLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtnQkFDL0IsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsV0FBVyxFQUFFLFdBQVcsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsbUJBQW1CLEVBQUU7b0JBQ25CO3dCQUNFLFFB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QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyx3QkFBd0I7WUFDakQsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUNGO0FBOVNELGdEQThTQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGVyZm9ybWFuY2UgYW5kIFNjYWxhYmlsaXR5IEluZnJhc3RydWN0dXJlIFN0YWNrXG4gKiBJbXBsZW1lbnRzIHByb2R1Y3Rpb24tZ3JhZGUgcGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGVjcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzJztcbmltcG9ydCAqIGFzIGVsYnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lbGFzdGljbG9hZGJhbGFuY2luZ3YyJztcbmltcG9ydCAqIGFzIGF1dG9zY2FsaW5nIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hdXRvc2NhbGluZyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGVsYXN0aWNhY2hlIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lbGFzdGljYWNoZSc7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqUGVyZm9ybWFuY2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICB2cGNJZD86IHN0cmluZztcbiAgY2VydGlmaWNhdGVBcm4/OiBzdHJpbmc7XG4gIGRvbWFpbk5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBWalBlcmZvcm1hbmNlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgbG9hZEJhbGFuY2VyOiBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcjtcbiAgcHVibGljIHJlYWRvbmx5IGNsdXN0ZXI6IGVjcy5DbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgY2FjaGVDbHVzdGVyOiBlbGFzdGljYWNoZS5DZm5DYWNoZUNsdXN0ZXI7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWalBlcmZvcm1hbmNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCB9ID0gcHJvcHM7XG5cbiAgICAvLyBWUEMgQ29uZmlndXJhdGlvblxuICAgIGxldCB2cGM6IGVjMi5JVnBjO1xuICAgIGlmIChwcm9wcy52cGNJZCkge1xuICAgICAgdnBjID0gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdFeGlzdGluZ1ZwYycsIHtcbiAgICAgICAgdnBjSWQ6IHByb3BzLnZwY0lkLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdWalZwYycsIHtcbiAgICAgICAgbWF4QXpzOiAzLFxuICAgICAgICBuYXRHYXRld2F5czogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDMgOiAxLFxuICAgICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgICAgbmFtZTogJ3B1YmxpYycsXG4gICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgICBuYW1lOiAncHJpdmF0ZScsXG4gICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2lkck1hc2s6IDI4LFxuICAgICAgICAgICAgbmFtZTogJ2lzb2xhdGVkJyxcbiAgICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEVDUyBDbHVzdGVyIGZvciBjb250YWluZXJpemVkIGFwcGxpY2F0aW9uXG4gICAgdGhpcy5jbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdWakNsdXN0ZXInLCB7XG4gICAgICB2cGMsXG4gICAgICBjbHVzdGVyTmFtZTogYHZqLWNsdXN0ZXItJHtlbnZpcm9ubWVudH1gLFxuICAgICAgY29udGFpbmVySW5zaWdodHM6IHRydWUsXG4gICAgICBlbmFibGVGYXJnYXRlQ2FwYWNpdHlQcm92aWRlcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBdXRvIFNjYWxpbmcgR3JvdXAgZm9yIEVDMiBpbnN0YW5jZXNcbiAgICBjb25zdCBhc2cgPSBuZXcgYXV0b3NjYWxpbmcuQXV0b1NjYWxpbmdHcm91cCh0aGlzLCAnVmpBdXRvU2NhbGluZ0dyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgaW5zdGFuY2VUeXBlOiBlYzIuSW5zdGFuY2VUeXBlLm9mKFxuICAgICAgICBlYzIuSW5zdGFuY2VDbGFzcy5UMyxcbiAgICAgICAgZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGVjMi5JbnN0YW5jZVNpemUuTUVESVVNIDogZWMyLkluc3RhbmNlU2l6ZS5TTUFMTFxuICAgICAgKSxcbiAgICAgIG1hY2hpbmVJbWFnZTogZWNzLkVjc09wdGltaXplZEltYWdlLmFtYXpvbkxpbnV4MigpLFxuICAgICAgbWluQ2FwYWNpdHk6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAyIDogMSxcbiAgICAgIG1heENhcGFjaXR5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gMjAgOiA1LFxuICAgICAgZGVzaXJlZENhcGFjaXR5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gMyA6IDEsXG4gICAgICBcbiAgICAgIC8vIFBlcmZvcm1hbmNlIG9wdGltaXphdGlvbnNcbiAgICAgIHNwb3RQcmljZTogZW52aXJvbm1lbnQgIT09ICdwcm9kJyA/ICcwLjA1JyA6IHVuZGVmaW5lZCxcbiAgICAgIFxuICAgICAgLy8gQXV0byBTY2FsaW5nIHBvbGljaWVzXG4gICAgICBhdXRvU2NhbGluZ0dyb3VwTmFtZTogYHZqLWFzZy0ke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY2FwYWNpdHkgdG8gRUNTIGNsdXN0ZXJcbiAgICBjb25zdCBjYXBhY2l0eVByb3ZpZGVyID0gbmV3IGVjcy5Bc2dDYXBhY2l0eVByb3ZpZGVyKHRoaXMsICdWakNhcGFjaXR5UHJvdmlkZXInLCB7XG4gICAgICBhdXRvU2NhbGluZ0dyb3VwOiBhc2csXG4gICAgICBlbmFibGVNYW5hZ2VkU2NhbGluZzogdHJ1ZSxcbiAgICAgIGVuYWJsZU1hbmFnZWRUZXJtaW5hdGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgdGFyZ2V0Q2FwYWNpdHlQZXJjZW50OiA4MCxcbiAgICAgIGNhbkNvbnRhaW5lcnNBY2Nlc3NJbnN0YW5jZVJvbGU6IHRydWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLmNsdXN0ZXIuYWRkQXNnQ2FwYWNpdHlQcm92aWRlcihjYXBhY2l0eVByb3ZpZGVyKTtcblxuICAgIC8vIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXJcbiAgICB0aGlzLmxvYWRCYWxhbmNlciA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcih0aGlzLCAnVmpMb2FkQmFsYW5jZXInLCB7XG4gICAgICB2cGMsXG4gICAgICBpbnRlcm5ldEZhY2luZzogdHJ1ZSxcbiAgICAgIGxvYWRCYWxhbmNlck5hbWU6IGB2ai1hbGItJHtlbnZpcm9ubWVudH1gLFxuICAgICAgXG4gICAgICAvLyBQZXJmb3JtYW5jZSBhbmQgc2VjdXJpdHkgc2V0dGluZ3NcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIGlkbGVUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgfSk7XG5cbiAgICAvLyBIZWFsdGggY2hlY2sgdGFyZ2V0IGdyb3VwXG4gICAgY29uc3QgaGVhbHRoVGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnSGVhbHRoVGFyZ2V0R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBwb3J0OiAzMDAwLFxuICAgICAgcHJvdG9jb2w6IGVsYnYyLkFwcGxpY2F0aW9uUHJvdG9jb2wuSFRUUCxcbiAgICAgIHRhcmdldFR5cGU6IGVsYnYyLlRhcmdldFR5cGUuSVAsXG4gICAgICBcbiAgICAgIC8vIEhlYWx0aCBjaGVjayBjb25maWd1cmF0aW9uXG4gICAgICBoZWFsdGhDaGVjazoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBwYXRoOiAnL2FwaS9oZWFsdGgnLFxuICAgICAgICBwcm90b2NvbDogZWxidjIuUHJvdG9jb2wuSFRUUCxcbiAgICAgICAgcG9ydDogJzMwMDAnLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgICAgaGVhbHRoeVRocmVzaG9sZENvdW50OiAyLFxuICAgICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMyxcbiAgICAgICAgaGVhbHRoeUh0dHBDb2RlczogJzIwMCcsXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBUYXJnZXQgZ3JvdXAgYXR0cmlidXRlcyBmb3IgcGVyZm9ybWFuY2VcbiAgICAgIGRlcmVnaXN0cmF0aW9uRGVsYXk6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIHN0aWNraW5lc3NDb29raWVEdXJhdGlvbjogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgIH0pO1xuXG4gICAgLy8gRWxhc3RpQ2FjaGUgZm9yIFJlZGlzIGNhY2hpbmdcbiAgICBjb25zdCBjYWNoZVN1Ym5ldEdyb3VwID0gbmV3IGVsYXN0aWNhY2hlLkNmblN1Ym5ldEdyb3VwKHRoaXMsICdDYWNoZVN1Ym5ldEdyb3VwJywge1xuICAgICAgZGVzY3JpcHRpb246ICdTdWJuZXQgZ3JvdXAgZm9yIFJlZGlzIGNhY2hlJyxcbiAgICAgIHN1Ym5ldElkczogdnBjLnByaXZhdGVTdWJuZXRzLm1hcChzdWJuZXQgPT4gc3VibmV0LnN1Ym5ldElkKSxcbiAgICAgIGNhY2hlU3VibmV0R3JvdXBOYW1lOiBgdmotY2FjaGUtc3VibmV0LSR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNhY2hlU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQ2FjaGVTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgUmVkaXMgY2FjaGUnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBjYWNoZVNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5hbnlJcHY0KCksXG4gICAgICBlYzIuUG9ydC50Y3AoNjM3OSksXG4gICAgICAnQWxsb3cgUmVkaXMgYWNjZXNzJ1xuICAgICk7XG5cbiAgICB0aGlzLmNhY2hlQ2x1c3RlciA9IG5ldyBlbGFzdGljYWNoZS5DZm5DYWNoZUNsdXN0ZXIodGhpcywgJ1JlZGlzQ2FjaGUnLCB7XG4gICAgICBjYWNoZU5vZGVUeXBlOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJ2NhY2hlLnQzLm1lZGl1bScgOiAnY2FjaGUudDMubWljcm8nLFxuICAgICAgZW5naW5lOiAncmVkaXMnLFxuICAgICAgbnVtQ2FjaGVOb2RlczogMSxcbiAgICAgIGNhY2hlU3VibmV0R3JvdXBOYW1lOiBjYWNoZVN1Ym5ldEdyb3VwLmNhY2hlU3VibmV0R3JvdXBOYW1lLFxuICAgICAgdnBjU2VjdXJpdHlHcm91cElkczogW2NhY2hlU2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWRdLFxuICAgICAgXG4gICAgICAvLyBQZXJmb3JtYW5jZSBzZXR0aW5nc1xuICAgICAgY2FjaGVDbHVzdGVySWQ6IGB2ai1yZWRpcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBlbmdpbmVWZXJzaW9uOiAnNy4wJyxcbiAgICAgIHBvcnQ6IDYzNzksXG4gICAgICBcbiAgICAgIC8vIEJhY2t1cCBhbmQgbWFpbnRlbmFuY2VcbiAgICAgIHByZWZlcnJlZE1haW50ZW5hbmNlV2luZG93OiAnc3VuOjAzOjAwLXN1bjowNDowMCcsXG4gICAgICBzbmFwc2hvdFJldGVudGlvbkxpbWl0OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gNyA6IDEsXG4gICAgICBzbmFwc2hvdFdpbmRvdzogJzAyOjAwLTAzOjAwJyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIGZvciBnbG9iYWwgQ0ROXG4gICAgY29uc3QgYXNzZXRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQXNzZXRzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLWFzc2V0cy0ke2Vudmlyb25tZW50fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBcbiAgICAgIC8vIFBlcmZvcm1hbmNlIG9wdGltaXphdGlvbnNcbiAgICAgIHRyYW5zZmVyQWNjZWxlcmF0aW9uOiB0cnVlLFxuICAgICAgaW50ZWxsaWdlbnRUaWVyaW5nQ29uZmlndXJhdGlvbnM6IFt7XG4gICAgICAgIGlkOiAnaW50ZWxsaWdlbnQtdGllcmluZycsXG4gICAgICAgIHN0YXR1czogczMuSW50ZWxsaWdlbnRUaWVyaW5nU3RhdHVzLkVOQUJMRUQsXG4gICAgICB9XSxcbiAgICAgIFxuICAgICAgLy8gQ09SUyBjb25maWd1cmF0aW9uXG4gICAgICBjb3JzOiBbe1xuICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuSEVBRF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBtYXhBZ2U6IDg2NDAwLFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnVmpEaXN0cmlidXRpb24nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgY2xvdWRmcm9udC5IdHRwT3JpZ2luKHRoaXMubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWUsIHtcbiAgICAgICAgICBodHRwUG9ydDogODAsXG4gICAgICAgICAgaHR0cHNQb3J0OiA0NDMsXG4gICAgICAgICAgcHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUHJvdG9jb2xQb2xpY3kuSFRUUF9PTkxZLFxuICAgICAgICB9KSxcbiAgICAgICAgXG4gICAgICAgIC8vIENhY2hpbmcgYmVoYXZpb3IgZm9yIGR5bmFtaWMgY29udGVudFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBcbiAgICAgICAgLy8gQ29tcHJlc3Npb25cbiAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBTdGF0aWMgYXNzZXRzIGJlaGF2aW9yXG4gICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICcvc3RhdGljLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgY2xvdWRmcm9udC5TM09yaWdpbihhc3NldHNCdWNrZXQpLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL19uZXh0L3N0YXRpYy8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IGNsb3VkZnJvbnQuUzNPcmlnaW4oYXNzZXRzQnVja2V0KSxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRF9GT1JfVU5DT01QUkVTU0VEX09CSkVDVFMsXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBEaXN0cmlidXRpb24gc2V0dGluZ3NcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBodHRwVmVyc2lvbjogY2xvdWRmcm9udC5IdHRwVmVyc2lvbi5IVFRQMl9BTkRfMyxcbiAgICAgIHByaWNlQ2xhc3M6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfQUxMIDogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzEwMCxcbiAgICAgIFxuICAgICAgLy8gQ2VydGlmaWNhdGUgYW5kIGRvbWFpblxuICAgICAgLi4uKHByb3BzLmNlcnRpZmljYXRlQXJuICYmIHByb3BzLmRvbWFpbk5hbWUgJiYge1xuICAgICAgICBjZXJ0aWZpY2F0ZTogYWNtLkNlcnRpZmljYXRlLmZyb21DZXJ0aWZpY2F0ZUFybih0aGlzLCAnQ2VydGlmaWNhdGUnLCBwcm9wcy5jZXJ0aWZpY2F0ZUFybiksXG4gICAgICAgIGRvbWFpbk5hbWVzOiBbcHJvcHMuZG9tYWluTmFtZV0sXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRGFzaGJvYXJkIGZvciBtb25pdG9yaW5nXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdQZXJmb3JtYW5jZURhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGB2ai1wZXJmb3JtYW5jZS0ke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICAvLyBQZXJmb3JtYW5jZSBtZXRyaWNzXG4gICAgY29uc3QgY3B1TWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBsaWNhdGlvbkVMQicsXG4gICAgICBtZXRyaWNOYW1lOiAnVGFyZ2V0UmVzcG9uc2VUaW1lJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgTG9hZEJhbGFuY2VyOiB0aGlzLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJGdWxsTmFtZSxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG1lbW9yeU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvRUNTJyxcbiAgICAgIG1ldHJpY05hbWU6ICdNZW1vcnlVdGlsaXphdGlvbicsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIENsdXN0ZXJOYW1lOiB0aGlzLmNsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgfSk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdSZXNwb25zZSBUaW1lJyxcbiAgICAgICAgbGVmdDogW2NwdU1ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnTWVtb3J5IFV0aWxpemF0aW9uJyxcbiAgICAgICAgbGVmdDogW21lbW9yeU1ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQXV0byBTY2FsaW5nIGJhc2VkIG9uIHBlcmZvcm1hbmNlIG1ldHJpY3NcbiAgICBjb25zdCByZXNwb25zZVRpbWVTY2FsaW5nID0gYXNnLnNjYWxlT25NZXRyaWMoJ1Jlc3BvbnNlVGltZVNjYWxpbmcnLCB7XG4gICAgICBtZXRyaWM6IGNwdU1ldHJpYyxcbiAgICAgIHNjYWxpbmdTdGVwczogW1xuICAgICAgICB7IHVwcGVyOiAyMDAsIGNoYW5nZTogLTEgfSxcbiAgICAgICAgeyBsb3dlcjogNTAwLCBjaGFuZ2U6ICsxIH0sXG4gICAgICAgIHsgbG93ZXI6IDEwMDAsIGNoYW5nZTogKzIgfSxcbiAgICAgIF0sXG4gICAgICBhZGp1c3RtZW50VHlwZTogYXV0b3NjYWxpbmcuQWRqdXN0bWVudFR5cGUuQ0hBTkdFX0lOX0NBUEFDSVRZLFxuICAgICAgY29vbGRvd246IGNkay5EdXJhdGlvbi5taW51dGVzKDMpLFxuICAgIH0pO1xuXG4gICAgLy8gTWVtb3J5LWJhc2VkIHNjYWxpbmdcbiAgICBjb25zdCBtZW1vcnlTY2FsaW5nID0gYXNnLnNjYWxlT25NZXRyaWMoJ01lbW9yeVNjYWxpbmcnLCB7XG4gICAgICBtZXRyaWM6IG1lbW9yeU1ldHJpYyxcbiAgICAgIHNjYWxpbmdTdGVwczogW1xuICAgICAgICB7IHVwcGVyOiA1MCwgY2hhbmdlOiAtMSB9LFxuICAgICAgICB7IGxvd2VyOiA4MCwgY2hhbmdlOiArMSB9LFxuICAgICAgICB7IGxvd2VyOiA5MCwgY2hhbmdlOiArMiB9LFxuICAgICAgXSxcbiAgICAgIGFkanVzdG1lbnRUeXBlOiBhdXRvc2NhbGluZy5BZGp1c3RtZW50VHlwZS5DSEFOR0VfSU5fQ0FQQUNJVFksXG4gICAgICBjb29sZG93bjogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvYWRCYWxhbmNlckROUycsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyIEROUyBuYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RG9tYWluJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGRvbWFpbiBuYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWRpc0VuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IHRoaXMuY2FjaGVDbHVzdGVyLmF0dHJSZWRpc0VuZHBvaW50QWRkcmVzcyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVkaXMgY2FjaGUgZW5kcG9pbnQnLFxuICAgIH0pO1xuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ3YxejNyJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFjaycsICdQZXJmb3JtYW5jZScpO1xuICB9XG59Il19