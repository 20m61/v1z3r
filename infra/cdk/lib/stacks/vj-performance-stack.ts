/**
 * Performance and Scalability Infrastructure Stack
 * Implements production-grade performance optimization
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface VjPerformanceStackProps extends cdk.StackProps {
  environment: string;
  vpcId?: string;
  certificateArn?: string;
  domainName?: string;
}

export class VjPerformanceStack extends cdk.Stack {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly cluster: ecs.Cluster;
  public readonly cacheCluster: elasticache.CfnCacheCluster;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: VjPerformanceStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // VPC Configuration
    let vpc: ec2.IVpc;
    if (props.vpcId) {
      vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
        vpcId: props.vpcId,
      });
    } else {
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
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        environment === 'prod' ? ec2.InstanceSize.MEDIUM : ec2.InstanceSize.SMALL
      ),
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

    cacheSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(6379),
      'Allow Redis access'
    );

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

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Response Time',
        left: [cpuMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Memory Utilization',
        left: [memoryMetric],
        width: 12,
        height: 6,
      })
    );

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