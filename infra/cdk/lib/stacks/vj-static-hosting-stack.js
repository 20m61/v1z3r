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
            publicReadAccess: !config.enableCloudFront,
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
        });
        // Add tags after creation
        cdk.Tags.of(this.siteBucket).add('Name', `VJ Frontend Bucket - ${stage}`);
        cdk.Tags.of(this.siteBucket).add('Purpose', 'Static website hosting');
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
        const bucketDeploymentProps = {
            sources: [
                s3deploy.Source.jsonData('env-config.json', envConfig),
            ],
            destinationBucket: this.siteBucket,
            destinationKeyPrefix: 'config/',
        };
        // Only add distribution settings if CloudFront is enabled
        if (this.distribution) {
            bucketDeploymentProps.distribution = this.distribution;
            bucketDeploymentProps.distributionPaths = ['/config/*'];
        }
        new s3deploy.BucketDeployment(this, 'DeployEnvConfig', bucketDeploymentProps);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RhdGljLWhvc3Rpbmctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2ai1zdGF0aWMtaG9zdGluZy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsd0VBQTBEO0FBQzFELGlFQUFtRDtBQUNuRCx5RUFBMkQ7QUFDM0QseURBQTJDO0FBZTNDLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDakMsVUFBVSxDQUFZO0lBQ3RCLFlBQVksQ0FBMkI7SUFDdkMsT0FBTyxDQUFTO0lBRWhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RCx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxVQUFVLEVBQUUsZUFBZSxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNsRCxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCO1lBQzFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7Z0JBQ3hDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztnQkFDaEMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVO1lBQ25DLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENB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RSwyQkFBMkIsRUFBRTtZQUNuRCxLQUFLLEVBQUUsZUFBZSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUU7WUFDckQsV0FBVyxFQUFFLG1EQUFtRDtTQUNqRSxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN6QyxXQUFXLEVBQUUsd0NBQXdDO1NBQ3RELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxSRCxvREFrUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqU3RhdGljSG9zdGluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgICBlbmFibGVBdXRoOiBib29sZWFuO1xuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gICAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xuICB9O1xuICBhcGlVcmw6IHN0cmluZztcbiAgd2Vic29ja2V0VXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBWalN0YXRpY0hvc3RpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzaXRlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb24/OiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHNpdGVVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpTdGF0aWNIb3N0aW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnLCBhcGlVcmwsIHdlYnNvY2tldFVybCB9ID0gcHJvcHM7XG5cbiAgICAvLyBTMyBidWNrZXQgZm9yIHN0YXRpYyB3ZWJzaXRlIGhvc3RpbmdcbiAgICB0aGlzLnNpdGVCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLWZyb250ZW5kLSR7c3RhZ2V9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdlcnJvci5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6ICFjb25maWcuZW5hYmxlQ2xvdWRGcm9udCwgLy8gT25seSBwdWJsaWMgaWYgbm90IHVzaW5nIENsb3VkRnJvbnRcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBjb25maWcuZW5hYmxlQ2xvdWRGcm9udCBcbiAgICAgICAgPyBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwgXG4gICAgICAgIDogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUNMUyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHN0YWdlICE9PSAncHJvZCcsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuSEVBRF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRhZ3MgYWZ0ZXIgY3JlYXRpb25cbiAgICBjZGsuVGFncy5vZih0aGlzLnNpdGVCdWNrZXQpLmFkZCgnTmFtZScsIGBWSiBGcm9udGVuZCBCdWNrZXQgLSAke3N0YWdlfWApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuc2l0ZUJ1Y2tldCkuYWRkKCdQdXJwb3NlJywgJ1N0YXRpYyB3ZWJzaXRlIGhvc3RpbmcnKTtcblxuICAgIGxldCBjZXJ0aWZpY2F0ZTogYWNtLkNlcnRpZmljYXRlIHwgdW5kZWZpbmVkO1xuICAgIFxuICAgIC8vIFNTTCBjZXJ0aWZpY2F0ZSAob25seSBmb3IgcHJvZHVjdGlvbiB3aXRoIGN1c3RvbSBkb21haW4pXG4gICAgaWYgKGNvbmZpZy5lbmFibGVDbG91ZEZyb250ICYmIHN0YWdlID09PSAncHJvZCcgJiYgY29uZmlnLmRvbWFpbk5hbWUgIT09ICdsb2NhbGhvc3Q6MzAwMCcpIHtcbiAgICAgIGNlcnRpZmljYXRlID0gbmV3IGFjbS5DZXJ0aWZpY2F0ZSh0aGlzLCAnU2l0ZUNlcnRpZmljYXRlJywge1xuICAgICAgICBkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFtgd3d3LiR7Y29uZmlnLmRvbWFpbk5hbWV9YF0sXG4gICAgICAgIHZhbGlkYXRpb246IGFjbS5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucygpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gKG9wdGlvbmFsKVxuICAgIGlmIChjb25maWcuZW5hYmxlQ2xvdWRGcm9udCkge1xuICAgICAgY29uc3Qgb2FpID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcywgJ09yaWdpbkFjY2Vzc0lkZW50aXR5Jywge1xuICAgICAgICBjb21tZW50OiBgT0FJIGZvciBWSiBBcHAgJHtzdGFnZX1gLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEdyYW50IENsb3VkRnJvbnQgYWNjZXNzIHRvIFMzIGJ1Y2tldFxuICAgICAgdGhpcy5zaXRlQnVja2V0LmdyYW50UmVhZChvYWkpO1xuXG4gICAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnU2l0ZURpc3RyaWJ1dGlvbicsIHtcbiAgICAgICAgZG9tYWluTmFtZXM6IGNlcnRpZmljYXRlID8gW2NvbmZpZy5kb21haW5OYW1lXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMzApLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcygzMCksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLnNpdGVCdWNrZXQsIHtcbiAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvYWksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICAgIH0sXG4gICAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgICAnL2FwaS8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGFwaVVybC5yZXBsYWNlKCdodHRwczovLycsICcnKS5yZXBsYWNlKCdodHRwOi8vJywgJycpKSxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRCxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9zdGF0aWMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4odGhpcy5zaXRlQnVja2V0LCB7XG4gICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvYWksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kodGhpcywgJ1N0YXRpY0Fzc2V0c0NhY2hlUG9saWN5Jywge1xuICAgICAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6IGB2ai1zdGF0aWMtYXNzZXRzLSR7c3RhZ2V9YCxcbiAgICAgICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICAgICAgaGVhZGVyQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVIZWFkZXJCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVDb29raWVCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBwcmljZUNsYXNzOiBzdGFnZSA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTX0FMTCBcbiAgICAgICAgICA6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsXG4gICAgICAgIGVuYWJsZUxvZ2dpbmc6IHRydWUsXG4gICAgICAgIGxvZ0J1Y2tldDogKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBsb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnTG9nc0J1Y2tldCcsIHtcbiAgICAgICAgICAgIGJ1Y2tldE5hbWU6IGB2ai1jbG91ZGZyb250LWxvZ3MtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ0RlbGV0ZU9sZExvZ3MnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDkwKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNkay5UYWdzLm9mKGxvZ3NCdWNrZXQpLmFkZCgnTmFtZScsIGBWSiBDbG91ZEZyb250IExvZ3MgLSAke3N0YWdlfWApO1xuICAgICAgICAgIGNkay5UYWdzLm9mKGxvZ3NCdWNrZXQpLmFkZCgnUHVycG9zZScsICdDbG91ZEZyb250IGFjY2VzcyBsb2dzJyk7XG4gICAgICAgICAgcmV0dXJuIGxvZ3NCdWNrZXQ7XG4gICAgICAgIH0pKCksXG4gICAgICAgIGxvZ0ZpbGVQcmVmaXg6ICdjbG91ZGZyb250LWxvZ3MvJyxcbiAgICAgICAgY29tbWVudDogYFZKIEFwcGxpY2F0aW9uIERpc3RyaWJ1dGlvbiAtICR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnNpdGVVcmwgPSBjZXJ0aWZpY2F0ZSA/IGBodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YCA6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gO1xuXG4gICAgICAvLyBSb3V0ZSA1MyBETlMgKG9ubHkgZm9yIHByb2R1Y3Rpb24gd2l0aCBjdXN0b20gZG9tYWluKVxuICAgICAgaWYgKGNlcnRpZmljYXRlICYmIHN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgICAgY29uc3Qgem9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHRoaXMsICdab25lJywge1xuICAgICAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdTaXRlQWxpYXNSZWNvcmQnLCB7XG4gICAgICAgICAgcmVjb3JkTmFtZTogY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHRhcmdldHMuQ2xvdWRGcm9udFRhcmdldCh0aGlzLmRpc3RyaWJ1dGlvbikpLFxuICAgICAgICAgIHpvbmUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyByb3V0ZTUzLkFSZWNvcmQodGhpcywgJ1d3d1NpdGVBbGlhc1JlY29yZCcsIHtcbiAgICAgICAgICByZWNvcmROYW1lOiBgd3d3LiR7Y29uZmlnLmRvbWFpbk5hbWV9YCxcbiAgICAgICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKSksXG4gICAgICAgICAgem9uZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdCBTMyB3ZWJzaXRlIGhvc3RpbmdcbiAgICAgIHRoaXMuc2l0ZVVybCA9IHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsO1xuICAgIH1cblxuICAgIC8vIEVudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gZmlsZSBmb3IgdGhlIGZyb250ZW5kXG4gICAgY29uc3QgZW52Q29uZmlnID0ge1xuICAgICAgTkVYVF9QVUJMSUNfQVBJX1VSTDogYXBpVXJsLFxuICAgICAgTkVYVF9QVUJMSUNfV0VCU09DS0VUX1VSTDogd2Vic29ja2V0VXJsLFxuICAgICAgTkVYVF9QVUJMSUNfU1RBR0U6IHN0YWdlLFxuICAgICAgTkVYVF9QVUJMSUNfRE9NQUlOOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgIE5FWFRfUFVCTElDX0VOQUJMRV9BVVRIOiBjb25maWcuZW5hYmxlQXV0aC50b1N0cmluZygpLFxuICAgICAgTkVYVF9QVUJMSUNfVkVSU0lPTjogJzEuMC4wJyxcbiAgICAgIE5FWFRfUFVCTElDX0JVSUxEX1RJTUU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9O1xuXG4gICAgLy8gRGVwbG95IGVudmlyb25tZW50IGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBidWNrZXREZXBsb3ltZW50UHJvcHM6IGFueSA9IHtcbiAgICAgIHNvdXJjZXM6IFtcbiAgICAgICAgczNkZXBsb3kuU291cmNlLmpzb25EYXRhKCdlbnYtY29uZmlnLmpzb24nLCBlbnZDb25maWcpLFxuICAgICAgXSxcbiAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiB0aGlzLnNpdGVCdWNrZXQsXG4gICAgICBkZXN0aW5hdGlvbktleVByZWZpeDogJ2NvbmZpZy8nLFxuICAgIH07XG5cbiAgICAvLyBPbmx5IGFkZCBkaXN0cmlidXRpb24gc2V0dGluZ3MgaWYgQ2xvdWRGcm9udCBpcyBlbmFibGVkXG4gICAgaWYgKHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBidWNrZXREZXBsb3ltZW50UHJvcHMuZGlzdHJpYnV0aW9uID0gdGhpcy5kaXN0cmlidXRpb247XG4gICAgICBidWNrZXREZXBsb3ltZW50UHJvcHMuZGlzdHJpYnV0aW9uUGF0aHMgPSBbJy9jb25maWcvKiddO1xuICAgIH1cblxuICAgIG5ldyBzM2RlcGxveS5CdWNrZXREZXBsb3ltZW50KHRoaXMsICdEZXBsb3lFbnZDb25maWcnLCBidWNrZXREZXBsb3ltZW50UHJvcHMpO1xuXG4gICAgLy8gQnVpbGQgYW5kIGRlcGxveW1lbnQgdXNlciAoZm9yIENJL0NEKVxuICAgIGNvbnN0IGRlcGxveVVzZXIgPSBuZXcgaWFtLlVzZXIodGhpcywgJ0RlcGxveVVzZXInLCB7XG4gICAgICB1c2VyTmFtZTogYHZqLWRlcGxveS11c2VyLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlcGxveVBvbGljeSA9IG5ldyBpYW0uUG9saWN5KHRoaXMsICdEZXBsb3lQb2xpY3knLCB7XG4gICAgICBwb2xpY3lOYW1lOiBgdmotZGVwbG95LXBvbGljeS0ke3N0YWdlfWAsXG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgICAnczM6UHV0T2JqZWN0QWNsJyxcbiAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgIHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICBgJHt0aGlzLnNpdGVCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHRoaXMuZGlzdHJpYnV0aW9uID8gW1xuICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6Q3JlYXRlSW52YWxpZGF0aW9uJyxcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6R2V0SW52YWxpZGF0aW9uJyxcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6TGlzdEludmFsaWRhdGlvbnMnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICBgYXJuOmF3czpjbG91ZGZyb250Ojoke3RoaXMuYWNjb3VudH06ZGlzdHJpYnV0aW9uLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0gOiBbXSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZGVwbG95VXNlci5hdHRhY2hJbmxpbmVQb2xpY3koZGVwbG95UG9saWN5KTtcblxuICAgIC8vIEFjY2VzcyBrZXkgZm9yIGRlcGxveW1lbnQgdXNlclxuICAgIGNvbnN0IGRlcGxveUFjY2Vzc0tleSA9IG5ldyBpYW0uQWNjZXNzS2V5KHRoaXMsICdEZXBsb3lBY2Nlc3NLZXknLCB7XG4gICAgICB1c2VyOiBkZXBsb3lVc2VyLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTaXRlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2l0ZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2Vic2l0ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqU2l0ZVVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2l0ZUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zaXRlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciB3ZWJzaXRlJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalNpdGVCdWNrZXQtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGBWakRpc3RyaWJ1dGlvbklkLSR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uRG9tYWluTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZG9tYWluIG5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgVmpEaXN0cmlidXRpb25Eb21haW4tJHtzdGFnZX1gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveVVzZXJBY2Nlc3NLZXlJZCcsIHtcbiAgICAgIHZhbHVlOiBkZXBsb3lBY2Nlc3NLZXkuYWNjZXNzS2V5SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FjY2VzcyBLZXkgSUQgZm9yIGRlcGxveW1lbnQgdXNlcicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95VXNlclNlY3JldEFjY2Vzc0tleScsIHtcbiAgICAgIHZhbHVlOiBkZXBsb3lBY2Nlc3NLZXkuc2VjcmV0QWNjZXNzS2V5LnVuc2FmZVVud3JhcCgpLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWNyZXQgQWNjZXNzIEtleSBmb3IgZGVwbG95bWVudCB1c2VyIChzZW5zaXRpdmUpJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbnZDb25maWcnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoZW52Q29uZmlnLCBudWxsLCAyKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW52aXJvbm1lbnQgY29uZmlndXJhdGlvbiBmb3IgZnJvbnRlbmQnLFxuICAgIH0pO1xuICB9XG59Il19