import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface VjStaticHostingStackProps extends cdk.StackProps {
  stage: string;
  config: {
    domainName: string;
    enableAuth: boolean;
    enableCloudFront: boolean;
    enableBackup: boolean;
  };
  apiUrl: string;
  websocketUrl: string;
}

export class VjStaticHostingStack extends cdk.Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution?: cloudfront.Distribution;
  public readonly siteUrl: string;

  constructor(scope: Construct, id: string, props: VjStaticHostingStackProps) {
    super(scope, id, props);

    const { stage, config, apiUrl, websocketUrl } = props;

    // S3 bucket for static website hosting
    this.siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `vj-frontend-${stage}-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: !config.enableCloudFront, // Only public if not using CloudFront
      blockPublicAccess: config.enableCloudFront 
        ? s3.BlockPublicAccess.BLOCK_ALL 
        : new s3.BlockPublicAccess({
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
          }),
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Add tags after creation
    cdk.Tags.of(this.siteBucket).add('Name', `VJ Frontend Bucket - ${stage}`);
    cdk.Tags.of(this.siteBucket).add('Purpose', 'Static website hosting');

    let certificate: acm.Certificate | undefined;
    
    // SSL certificate (only for production with custom domain)
    if (config.enableCloudFront && stage === 'prod' && config.domainName !== 'localhost:3000') {
      certificate = new acm.Certificate(this, 'SiteCertificate', {
        domainName: config.domainName,
        subjectAlternativeNames: [`www.${config.domainName}`],
        validation: acm.CertificateValidation.fromDns(),
      });
    }

    // CloudFront distribution (optional)
    if (config.enableCloudFront) {
      const oai = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
        comment: `OAI for VJ App ${stage}`,
      });

      // Grant CloudFront access to S3 bucket
      this.siteBucket.grantRead(oai);

      this.distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
        domainNames: certificate ? [config.domainName] : undefined,
        certificate: certificate,
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(30),
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(30),
          },
        ],
        defaultBehavior: {
          origin: new origins.S3Origin(this.siteBucket, {
            originAccessIdentity: oai,
          }),
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        },
        additionalBehaviors: apiUrl ? {
          '/api/*': {
            origin: new origins.HttpOrigin(apiUrl.replace('https://', '').replace('http://', '').split('/')[0]),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          },
          '/static/*': {
            origin: new origins.S3Origin(this.siteBucket, {
              originAccessIdentity: oai,
            }),
            compress: true,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
              cachePolicyName: `vj-static-assets-${stage}`,
              defaultTtl: cdk.Duration.days(1),
              maxTtl: cdk.Duration.days(365),
              minTtl: cdk.Duration.seconds(0),
              headerBehavior: cloudfront.CacheHeaderBehavior.none(),
              queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
              cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            }),
          },
        } : {},
        priceClass: stage === 'prod' 
          ? cloudfront.PriceClass.PRICE_CLASS_ALL 
          : cloudfront.PriceClass.PRICE_CLASS_100,
        enableLogging: true,
        logBucket: (() => {
          const logsBucket = new s3.Bucket(this, 'LogsBucket', {
            bucketName: `vj-cloudfront-logs-${stage}-${this.account}`,
            lifecycleRules: [
              {
                id: 'DeleteOldLogs',
                expiration: cdk.Duration.days(90),
              },
            ],
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: stage !== 'prod',
          });
          cdk.Tags.of(logsBucket).add('Name', `VJ CloudFront Logs - ${stage}`);
          cdk.Tags.of(logsBucket).add('Purpose', 'CloudFront access logs');
          return logsBucket;
        })(),
        logFilePrefix: 'cloudfront-logs/',
        comment: `VJ Application Distribution - ${stage}`,
      });

      this.siteUrl = certificate ? `https://${config.domainName}` : `https://${this.distribution.distributionDomainName}`;

      // Route 53 DNS (only for production with custom domain)
      if (certificate && stage === 'prod') {
        const zone = route53.HostedZone.fromLookup(this, 'Zone', {
          domainName: config.domainName,
        });

        new route53.ARecord(this, 'SiteAliasRecord', {
          recordName: config.domainName,
          target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
          zone,
        });

        new route53.ARecord(this, 'WwwSiteAliasRecord', {
          recordName: `www.${config.domainName}`,
          target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
          zone,
        });
      }
    } else {
      // Direct S3 website hosting
      this.siteUrl = this.siteBucket.bucketWebsiteUrl;
    }

    // Environment configuration file for the frontend
    // For dev environment, use static URLs since we can't reference cross-stack
    const envConfig = stage === 'dev' ? {
      NEXT_PUBLIC_API_URL: 'https://jej6yzkbeb.execute-api.ap-northeast-1.amazonaws.com/dev/',
      NEXT_PUBLIC_WEBSOCKET_URL: 'wss://c3xs5dzz4a.execute-api.ap-northeast-1.amazonaws.com/dev',
      NEXT_PUBLIC_STAGE: stage,
      NEXT_PUBLIC_DOMAIN: config.domainName,
      NEXT_PUBLIC_ENABLE_AUTH: config.enableAuth.toString(),
      NEXT_PUBLIC_VERSION: '1.0.0',
      NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    } : {
      NEXT_PUBLIC_API_URL: apiUrl,
      NEXT_PUBLIC_WEBSOCKET_URL: websocketUrl,
      NEXT_PUBLIC_STAGE: stage,
      NEXT_PUBLIC_DOMAIN: config.domainName,
      NEXT_PUBLIC_ENABLE_AUTH: config.enableAuth.toString(),
      NEXT_PUBLIC_VERSION: '1.0.0',
      NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    };

    // Deploy environment configuration
    if (this.distribution) {
      new s3deploy.BucketDeployment(this, 'DeployEnvConfig', {
        sources: [
          s3deploy.Source.jsonData('env-config.json', envConfig),
        ],
        destinationBucket: this.siteBucket,
        destinationKeyPrefix: 'config/',
        distribution: this.distribution,
        distributionPaths: ['/config/*'],
      });
    } else {
      new s3deploy.BucketDeployment(this, 'DeployEnvConfig', {
        sources: [
          s3deploy.Source.jsonData('env-config.json', envConfig),
        ],
        destinationBucket: this.siteBucket,
        destinationKeyPrefix: 'config/',
      });
    }

    // Build and deployment user (for CI/CD)
    const deployUser = new iam.User(this, 'DeployUser', {
      userName: `vj-deploy-user-${stage}`,
    });

    const deployPolicy = new iam.Policy(this, 'DeployPolicy', {
      policyName: `vj-deploy-policy-${stage}`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:PutObject',
            's3:PutObjectAcl',
            's3:GetObject',
            's3:DeleteObject',
            's3:ListBucket',
          ],
          resources: [
            this.siteBucket.bucketArn,
            `${this.siteBucket.bucketArn}/*`,
          ],
        }),
        ...(this.distribution ? [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cloudfront:CreateInvalidation',
              'cloudfront:GetInvalidation',
              'cloudfront:ListInvalidations',
            ],
            resources: [
              `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
            ],
          }),
        ] : []),
      ],
    });

    deployUser.attachInlinePolicy(deployPolicy);

    // Access key for deployment user
    const deployAccessKey = new iam.AccessKey(this, 'DeployAccessKey', {
      user: deployUser,
    });

    // Outputs
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: this.siteUrl,
      description: 'Website URL',
      exportName: `VjSiteUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: this.siteBucket.bucketName,
      description: 'S3 bucket name for website',
      exportName: `VjSiteBucket-${stage}`,
    });

    if (this.distribution) {
      new cdk.CfnOutput(this, 'DistributionId', {
        value: this.distribution.distributionId,
        description: 'CloudFront distribution ID',
        exportName: `VjDistributionId-${stage}`,
      });

      new cdk.CfnOutput(this, 'DistributionDomainName', {
        value: this.distribution.distributionDomainName,
        description: 'CloudFront distribution domain name',
        exportName: `VjDistributionDomain-${stage}`,
      });
    }

    new cdk.CfnOutput(this, 'DeployUserAccessKeyId', {
      value: deployAccessKey.accessKeyId,
      description: 'Access Key ID for deployment user',
    });

    new cdk.CfnOutput(this, 'DeployUserSecretAccessKey', {
      value: deployAccessKey.secretAccessKey.unsafeUnwrap(),
      description: 'Secret Access Key for deployment user (sensitive)',
    });

    new cdk.CfnOutput(this, 'EnvConfig', {
      value: JSON.stringify(envConfig, null, 2),
      description: 'Environment configuration for frontend',
    });
  }
}