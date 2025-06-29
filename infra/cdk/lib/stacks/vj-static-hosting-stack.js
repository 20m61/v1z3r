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
exports.VjStaticHostingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class VjStaticHostingStack extends cdk.Stack {
    siteBucket;
    distribution;
    siteUrl;
    constructor(scope, id, props) {
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
                : s3.BlockPublicAccess.BLOCK_ACLS,
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
            tags: {
                Name: `VJ Frontend Bucket - ${stage}`,
                Purpose: 'Static website hosting',
            },
        });
        let certificate;
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
                additionalBehaviors: {
                    '/api/*': {
                        origin: new origins.HttpOrigin(apiUrl.replace('https://', '').replace('http://', '')),
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
                },
                priceClass: stage === 'prod'
                    ? cloudfront.PriceClass.PRICE_CLASS_ALL
                    : cloudfront.PriceClass.PRICE_CLASS_100,
                enableLogging: true,
                logBucket: new s3.Bucket(this, 'LogsBucket', {
                    bucketName: `vj-cloudfront-logs-${stage}-${this.account}`,
                    lifecycleRules: [
                        {
                            id: 'DeleteOldLogs',
                            expiration: cdk.Duration.days(90),
                        },
                    ],
                    removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
                    autoDeleteObjects: stage !== 'prod',
                }),
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
        }
        else {
            // Direct S3 website hosting
            this.siteUrl = this.siteBucket.bucketWebsiteUrl;
        }
        // Environment configuration file for the frontend
        const envConfig = {
            NEXT_PUBLIC_API_URL: apiUrl,
            NEXT_PUBLIC_WEBSOCKET_URL: websocketUrl,
            NEXT_PUBLIC_STAGE: stage,
            NEXT_PUBLIC_DOMAIN: config.domainName,
            NEXT_PUBLIC_ENABLE_AUTH: config.enableAuth.toString(),
            NEXT_PUBLIC_VERSION: '1.0.0',
            NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
        };
        // Deploy environment configuration
        new s3deploy.BucketDeployment(this, 'DeployEnvConfig', {
            sources: [
                s3deploy.Source.jsonData('env-config.json', envConfig),
            ],
            destinationBucket: this.siteBucket,
            destinationKeyPrefix: 'config/',
            distribution: this.distribution,
            distributionPaths: ['/config/*'],
        });
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
exports.VjStaticHostingStack = VjStaticHostingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RhdGljLWhvc3Rpbmctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2ai1zdGF0aWMtaG9zdGluZy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHdFQUEwRDtBQUMxRCx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELHdFQUEwRDtBQUMxRCxpRUFBbUQ7QUFDbkQseUVBQTJEO0FBQzNELHlEQUEyQztBQWUzQyxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pDLFVBQVUsQ0FBWTtJQUN0QixZQUFZLENBQTJCO0lBQ3ZDLE9BQU8sQ0FBUztJQUVoQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdDO1FBQ3hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFdEQsdUNBQXVDO1FBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbEQsVUFBVSxFQUFFLGVBQWUsS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDbEQsb0JBQW9CLEVBQUUsWUFBWTtZQUNsQyxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLHNDQUFzQztZQUNsRixpQkFBaUIsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO2dCQUN4QyxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7Z0JBQ2hDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsVUFBVTtZQUNuQyxhQUFhLEVBQUUs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RSxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWM7Z0JBQ3ZDLFdBQVcsRUFBRSw0QkFBNEI7Z0JBQ3pDLFVBQVUsRUFBRSxvQkFBb0IsS0FBSyxFQUFFO2FBQ3hDLENBQUMsQ0FBQztZQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7Z0JBQ2hELEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQjtnQkFDL0MsV0FBVyxFQUFFLHFDQUFxQztnQkFDbEQsVUFBVSxFQUFFLHdCQUF3QixLQUFLLEVBQUU7YUFDNUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLGVBQWUsQ0FBQyxXQUFXO1lBQ2xDLFdBQVcsRUFBRSxtQ0FBbUM7U0FDakQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRTtZQUNuRCxLQUFLLEVBQUUsZUFBZSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUU7WUFDckQsV0FBVyxFQUFFLG1EQUFtRDtTQUNqRSxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN6QyxXQUFXLEVBQUUsd0NBQXdDO1NBQ3RELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXZRRCxvREF1UUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqU3RhdGljSG9zdGluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgICBlbmFibGVBdXRoOiBib29sZWFuO1xuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gICAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xuICB9O1xuICBhcGlVcmw6IHN0cmluZztcbiAgd2Vic29ja2V0VXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBWalN0YXRpY0hvc3RpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzaXRlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb24/OiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHNpdGVVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpTdGF0aWNIb3N0aW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnLCBhcGlVcmwsIHdlYnNvY2tldFVybCB9ID0gcHJvcHM7XG5cbiAgICAvLyBTMyBidWNrZXQgZm9yIHN0YXRpYyB3ZWJzaXRlIGhvc3RpbmdcbiAgICB0aGlzLnNpdGVCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLWZyb250ZW5kLSR7c3RhZ2V9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdlcnJvci5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6ICFjb25maWcuZW5hYmxlQ2xvdWRGcm9udCwgLy8gT25seSBwdWJsaWMgaWYgbm90IHVzaW5nIENsb3VkRnJvbnRcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBjb25maWcuZW5hYmxlQ2xvdWRGcm9udCBcbiAgICAgICAgPyBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwgXG4gICAgICAgIDogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUNMUyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuSEVBRF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgdGFnczoge1xuICAgICAgICBOYW1lOiBgVkogRnJvbnRlbmQgQnVja2V0IC0gJHtzdGFnZX1gLFxuICAgICAgICBQdXJwb3NlOiAnU3RhdGljIHdlYnNpdGUgaG9zdGluZycsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgbGV0IGNlcnRpZmljYXRlOiBhY20uQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgLy8gU1NMIGNlcnRpZmljYXRlIChvbmx5IGZvciBwcm9kdWN0aW9uIHdpdGggY3VzdG9tIGRvbWFpbilcbiAgICBpZiAoY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQgJiYgc3RhZ2UgPT09ICdwcm9kJyAmJiBjb25maWcuZG9tYWluTmFtZSAhPT0gJ2xvY2FsaG9zdDozMDAwJykge1xuICAgICAgY2VydGlmaWNhdGUgPSBuZXcgYWNtLkNlcnRpZmljYXRlKHRoaXMsICdTaXRlQ2VydGlmaWNhdGUnLCB7XG4gICAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogW2B3d3cuJHtjb25maWcuZG9tYWluTmFtZX1gXSxcbiAgICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKCksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiAob3B0aW9uYWwpXG4gICAgaWYgKGNvbmZpZy5lbmFibGVDbG91ZEZyb250KSB7XG4gICAgICBjb25zdCBvYWkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnT3JpZ2luQWNjZXNzSWRlbnRpdHknLCB7XG4gICAgICAgIGNvbW1lbnQ6IGBPQUkgZm9yIFZKIEFwcCAke3N0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBhY2Nlc3MgdG8gUzMgYnVja2V0XG4gICAgICB0aGlzLnNpdGVCdWNrZXQuZ3JhbnRSZWFkKG9haSk7XG5cbiAgICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdTaXRlRGlzdHJpYnV0aW9uJywge1xuICAgICAgICBkb21haW5OYW1lczogY2VydGlmaWNhdGUgPyBbY29uZmlnLmRvbWFpbk5hbWVdIDogdW5kZWZpbmVkLFxuICAgICAgICBjZXJ0aWZpY2F0ZTogY2VydGlmaWNhdGUsXG4gICAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcygzMCksXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDMwKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuc2l0ZUJ1Y2tldCwge1xuICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5DT1JTX1MzX09SSUdJTixcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYXBpVXJsLnJlcGxhY2UoJ2h0dHBzOi8vJywgJycpLnJlcGxhY2UoJ2h0dHA6Ly8nLCAnJykpLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFELFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL3N0YXRpYy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLnNpdGVCdWNrZXQsIHtcbiAgICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeSh0aGlzLCAnU3RhdGljQXNzZXRzQ2FjaGVQb2xpY3knLCB7XG4gICAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogYHZqLXN0YXRpYy1hc3NldHMtJHtzdGFnZX1gLFxuICAgICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHByaWNlQ2xhc3M6IHN0YWdlID09PSAncHJvZCcgXG4gICAgICAgICAgPyBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfQUxMIFxuICAgICAgICAgIDogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzEwMCxcbiAgICAgICAgZW5hYmxlTG9nZ2luZzogdHJ1ZSxcbiAgICAgICAgbG9nQnVja2V0OiBuZXcgczMuQnVja2V0KHRoaXMsICdMb2dzQnVja2V0Jywge1xuICAgICAgICAgIGJ1Y2tldE5hbWU6IGB2ai1jbG91ZGZyb250LWxvZ3MtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBpZDogJ0RlbGV0ZU9sZExvZ3MnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICAgIH0pLFxuICAgICAgICBsb2dGaWxlUHJlZml4OiAnY2xvdWRmcm9udC1sb2dzLycsXG4gICAgICAgIGNvbW1lbnQ6IGBWSiBBcHBsaWNhdGlvbiBEaXN0cmlidXRpb24gLSAke3N0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5zaXRlVXJsID0gY2VydGlmaWNhdGUgPyBgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWAgOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YDtcblxuICAgICAgLy8gUm91dGUgNTMgRE5TIChvbmx5IGZvciBwcm9kdWN0aW9uIHdpdGggY3VzdG9tIGRvbWFpbilcbiAgICAgIGlmIChjZXJ0aWZpY2F0ZSAmJiBzdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICAgIGNvbnN0IHpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnWm9uZScsIHtcbiAgICAgICAgICBkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnU2l0ZUFsaWFzUmVjb3JkJywge1xuICAgICAgICAgIHJlY29yZE5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyB0YXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQodGhpcy5kaXN0cmlidXRpb24pKSxcbiAgICAgICAgICB6b25lLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdXd3dTaXRlQWxpYXNSZWNvcmQnLCB7XG4gICAgICAgICAgcmVjb3JkTmFtZTogYHd3dy4ke2NvbmZpZy5kb21haW5OYW1lfWAsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHRhcmdldHMuQ2xvdWRGcm9udFRhcmdldCh0aGlzLmRpc3RyaWJ1dGlvbikpLFxuICAgICAgICAgIHpvbmUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3QgUzMgd2Vic2l0ZSBob3N0aW5nXG4gICAgICB0aGlzLnNpdGVVcmwgPSB0aGlzLnNpdGVCdWNrZXQuYnVja2V0V2Vic2l0ZVVybDtcbiAgICB9XG5cbiAgICAvLyBFbnZpcm9ubWVudCBjb25maWd1cmF0aW9uIGZpbGUgZm9yIHRoZSBmcm9udGVuZFxuICAgIGNvbnN0IGVudkNvbmZpZyA9IHtcbiAgICAgIE5FWFRfUFVCTElDX0FQSV9VUkw6IGFwaVVybCxcbiAgICAgIE5FWFRfUFVCTElDX1dFQlNPQ0tFVF9VUkw6IHdlYnNvY2tldFVybCxcbiAgICAgIE5FWFRfUFVCTElDX1NUQUdFOiBzdGFnZSxcbiAgICAgIE5FWFRfUFVCTElDX0RPTUFJTjogY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICBORVhUX1BVQkxJQ19FTkFCTEVfQVVUSDogY29uZmlnLmVuYWJsZUF1dGgudG9TdHJpbmcoKSxcbiAgICAgIE5FWFRfUFVCTElDX1ZFUlNJT046ICcxLjAuMCcsXG4gICAgICBORVhUX1BVQkxJQ19CVUlMRF9USU1FOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfTtcblxuICAgIC8vIERlcGxveSBlbnZpcm9ubWVudCBjb25maWd1cmF0aW9uXG4gICAgbmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQodGhpcywgJ0RlcGxveUVudkNvbmZpZycsIHtcbiAgICAgIHNvdXJjZXM6IFtcbiAgICAgICAgczNkZXBsb3kuU291cmNlLmpzb25EYXRhKCdlbnYtY29uZmlnLmpzb24nLCBlbnZDb25maWcpLFxuICAgICAgXSxcbiAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiB0aGlzLnNpdGVCdWNrZXQsXG4gICAgICBkZXN0aW5hdGlvbktleVByZWZpeDogJ2NvbmZpZy8nLFxuICAgICAgZGlzdHJpYnV0aW9uOiB0aGlzLmRpc3RyaWJ1dGlvbixcbiAgICAgIGRpc3RyaWJ1dGlvblBhdGhzOiBbJy9jb25maWcvKiddLFxuICAgIH0pO1xuXG4gICAgLy8gQnVpbGQgYW5kIGRlcGxveW1lbnQgdXNlciAoZm9yIENJL0NEKVxuICAgIGNvbnN0IGRlcGxveVVzZXIgPSBuZXcgaWFtLlVzZXIodGhpcywgJ0RlcGxveVVzZXInLCB7XG4gICAgICB1c2VyTmFtZTogYHZqLWRlcGxveS11c2VyLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlcGxveVBvbGljeSA9IG5ldyBpYW0uUG9saWN5KHRoaXMsICdEZXBsb3lQb2xpY3knLCB7XG4gICAgICBwb2xpY3lOYW1lOiBgdmotZGVwbG95LXBvbGljeS0ke3N0YWdlfWAsXG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgICAnczM6UHV0T2JqZWN0QWNsJyxcbiAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgIHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICBgJHt0aGlzLnNpdGVCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHRoaXMuZGlzdHJpYnV0aW9uID8gW1xuICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6Q3JlYXRlSW52YWxpZGF0aW9uJyxcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6R2V0SW52YWxpZGF0aW9uJyxcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6TGlzdEludmFsaWRhdGlvbnMnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICBgYXJuOmF3czpjbG91ZGZyb250Ojoke3RoaXMuYWNjb3VudH06ZGlzdHJpYnV0aW9uLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0gOiBbXSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZGVwbG95VXNlci5hdHRhY2hJbmxpbmVQb2xpY3koZGVwbG95UG9saWN5KTtcblxuICAgIC8vIEFjY2VzcyBrZXkgZm9yIGRlcGxveW1lbnQgdXNlclxuICAgIGNvbnN0IGRlcGxveUFjY2Vzc0tleSA9IG5ldyBpYW0uQWNjZXNzS2V5KHRoaXMsICdEZXBsb3lBY2Nlc3NLZXknLCB7XG4gICAgICB1c2VyOiBkZXBsb3lVc2VyLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTaXRlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2l0ZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2Vic2l0ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqU2l0ZVVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2l0ZUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zaXRlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciB3ZWJzaXRlJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalNpdGVCdWNrZXQtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGBWakRpc3RyaWJ1dGlvbklkLSR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uRG9tYWluTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZG9tYWluIG5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgVmpEaXN0cmlidXRpb25Eb21haW4tJHtzdGFnZX1gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveVVzZXJBY2Nlc3NLZXlJZCcsIHtcbiAgICAgIHZhbHVlOiBkZXBsb3lBY2Nlc3NLZXkuYWNjZXNzS2V5SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FjY2VzcyBLZXkgSUQgZm9yIGRlcGxveW1lbnQgdXNlcicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95VXNlclNlY3JldEFjY2Vzc0tleScsIHtcbiAgICAgIHZhbHVlOiBkZXBsb3lBY2Nlc3NLZXkuc2VjcmV0QWNjZXNzS2V5LnVuc2FmZVVud3JhcCgpLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWNyZXQgQWNjZXNzIEtleSBmb3IgZGVwbG95bWVudCB1c2VyIChzZW5zaXRpdmUpJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbnZDb25maWcnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoZW52Q29uZmlnLCBudWxsLCAyKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW52aXJvbm1lbnQgY29uZmlndXJhdGlvbiBmb3IgZnJvbnRlbmQnLFxuICAgIH0pO1xuICB9XG59Il19