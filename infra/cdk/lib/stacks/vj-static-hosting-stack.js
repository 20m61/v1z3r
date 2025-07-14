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
        let certificate;
        // SSL certificate (for production and staging with custom domain)
        if (config.enableCloudFront && (stage === 'prod' || stage === 'staging') && config.domainName !== 'localhost:3000') {
            // Use existing certificate if available
            const certificateArn = stage === 'staging'
                ? 'arn:aws:acm:us-east-1:822063948773:certificate/0343ecfd-6f6d-4ea2-a7e6-0e82766cb0f7'
                : stage === 'prod'
                    ? 'arn:aws:acm:us-east-1:822063948773:certificate/7038c1fa-8b70-4822-ade0-a325dafffcd3'
                    : undefined;
            if (certificateArn) {
                certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', certificateArn);
            }
            else {
                certificate = new acm.Certificate(this, 'SiteCertificate', {
                    domainName: config.domainName,
                    subjectAlternativeNames: [`www.${config.domainName}`],
                    validation: acm.CertificateValidation.fromDns(),
                });
            }
        }
        // Use separate API URL for CloudFront configuration to avoid origin conflicts
        const cfApiUrl = stage === 'staging' ? null : apiUrl;
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
                        ttl: cdk.Duration.minutes(5),
                    },
                    {
                        httpStatus: 403,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(5),
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
                additionalBehaviors: cfApiUrl ? {
                    '/api/*': {
                        origin: new origins.HttpOrigin(cfApiUrl.replace('https://', '').replace('http://', '').split('/')[0]),
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
                enableLogging: stage === 'prod',
                comment: `VJ Application Distribution - ${stage}`,
            });
            this.siteUrl = certificate ? `https://${config.domainName}` : `https://${this.distribution.distributionDomainName}`;
            // Route 53 DNS (for production and staging with custom domain)
            if (certificate && (stage === 'prod' || stage === 'staging')) {
                const zone = route53.HostedZone.fromLookup(this, 'Zone', {
                    domainName: 'sc4pe.net',
                });
                new route53.ARecord(this, 'SiteAliasRecord', {
                    recordName: config.domainName,
                    target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
                    zone,
                });
                // Only create www record for production
                if (stage === 'prod') {
                    new route53.ARecord(this, 'WwwSiteAliasRecord', {
                        recordName: `www.${config.domainName}`,
                        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
                        zone,
                    });
                }
            }
        }
        else {
            // Direct S3 website hosting
            this.siteUrl = this.siteBucket.bucketWebsiteUrl;
        }
        // Environment configuration file for the frontend
        // Use static URLs for non-prod environments to avoid cross-stack dependencies
        const envConfig = stage === 'staging' ? {
            NEXT_PUBLIC_API_URL: 'https://7m5vgfup1a.execute-api.ap-northeast-1.amazonaws.com/staging/',
            NEXT_PUBLIC_WEBSOCKET_URL: 'wss://r4hqci3z59.execute-api.ap-northeast-1.amazonaws.com/staging',
            NEXT_PUBLIC_STAGE: stage,
            NEXT_PUBLIC_DOMAIN: config.domainName,
            NEXT_PUBLIC_ENABLE_AUTH: config.enableAuth.toString(),
            NEXT_PUBLIC_VERSION: '1.0.0',
            NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
        } : stage === 'dev' ? {
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
        }
        else {
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
exports.VjStaticHostingStack = VjStaticHostingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RhdGljLWhvc3Rpbmctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2ai1zdGF0aWMtaG9zdGluZy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsd0VBQTBEO0FBQzFELGlFQUFtRDtBQUNuRCx5RUFBMkQ7QUFDM0QseURBQTJDO0FBZTNDLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDakMsVUFBVSxDQUFZO0lBQ3RCLFlBQVksQ0FBMkI7SUFDdkMsT0FBTyxDQUFTO0lBRWhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RCx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxVQUFVLEVBQUUsZUFBZSxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNsRCxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCO1lBQzFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7Z0JBQ3hDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztnQkFDaEMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDO29CQUN2QixlQUFlLEVBQUUsS0FBSztvQkFDdEIsaUJBQWlCLEVB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LENBQUMsQ0FBQztZQUN6QyxXQUFXLEVBQUUsd0NBQXdDO1NBQ3RELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVTRCxvREE0U0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZqU3RhdGljSG9zdGluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgICBlbmFibGVBdXRoOiBib29sZWFuO1xuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gICAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xuICB9O1xuICBhcGlVcmw6IHN0cmluZztcbiAgd2Vic29ja2V0VXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBWalN0YXRpY0hvc3RpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzaXRlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb24/OiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHNpdGVVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpTdGF0aWNIb3N0aW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgY29uZmlnLCBhcGlVcmwsIHdlYnNvY2tldFVybCB9ID0gcHJvcHM7XG5cbiAgICAvLyBTMyBidWNrZXQgZm9yIHN0YXRpYyB3ZWJzaXRlIGhvc3RpbmdcbiAgICB0aGlzLnNpdGVCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHZqLWZyb250ZW5kLSR7c3RhZ2V9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdlcnJvci5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6ICFjb25maWcuZW5hYmxlQ2xvdWRGcm9udCwgLy8gT25seSBwdWJsaWMgaWYgbm90IHVzaW5nIENsb3VkRnJvbnRcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBjb25maWcuZW5hYmxlQ2xvdWRGcm9udCBcbiAgICAgICAgPyBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwgXG4gICAgICAgIDogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcbiAgICAgICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsXG4gICAgICAgICAgfSksXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLkhFQURdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIGFmdGVyIGNyZWF0aW9uXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5zaXRlQnVja2V0KS5hZGQoJ05hbWUnLCBgVkogRnJvbnRlbmQgQnVja2V0IC0gJHtzdGFnZX1gKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnNpdGVCdWNrZXQpLmFkZCgnUHVycG9zZScsICdTdGF0aWMgd2Vic2l0ZSBob3N0aW5nJyk7XG5cbiAgICBsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgLy8gU1NMIGNlcnRpZmljYXRlIChmb3IgcHJvZHVjdGlvbiBhbmQgc3RhZ2luZyB3aXRoIGN1c3RvbSBkb21haW4pXG4gICAgaWYgKGNvbmZpZy5lbmFibGVDbG91ZEZyb250ICYmIChzdGFnZSA9PT0gJ3Byb2QnIHx8IHN0YWdlID09PSAnc3RhZ2luZycpICYmIGNvbmZpZy5kb21haW5OYW1lICE9PSAnbG9jYWxob3N0OjMwMDAnKSB7XG4gICAgICAvLyBVc2UgZXhpc3RpbmcgY2VydGlmaWNhdGUgaWYgYXZhaWxhYmxlXG4gICAgICBjb25zdCBjZXJ0aWZpY2F0ZUFybiA9IHN0YWdlID09PSAnc3RhZ2luZycgXG4gICAgICAgID8gJ2Fybjphd3M6YWNtOnVzLWVhc3QtMTo4MjIwNjM5NDg3NzM6Y2VydGlmaWNhdGUvMDM0M2VjZmQtNmY2ZC00ZWEyLWE3ZTYtMGU4Mjc2NmNiMGY3J1xuICAgICAgICA6IHN0YWdlID09PSAncHJvZCdcbiAgICAgICAgPyAnYXJuOmF3czphY206dXMtZWFzdC0xOjgyMjA2Mzk0ODc3MzpjZXJ0aWZpY2F0ZS83MDM4YzFmYS04YjcwLTQ4MjItYWRlMC1hMzI1ZGFmZmZjZDMnXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgXG4gICAgICBpZiAoY2VydGlmaWNhdGVBcm4pIHtcbiAgICAgICAgY2VydGlmaWNhdGUgPSBhY20uQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKHRoaXMsICdTaXRlQ2VydGlmaWNhdGUnLCBjZXJ0aWZpY2F0ZUFybik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjZXJ0aWZpY2F0ZSA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ1NpdGVDZXJ0aWZpY2F0ZScsIHtcbiAgICAgICAgICBkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogW2B3d3cuJHtjb25maWcuZG9tYWluTmFtZX1gXSxcbiAgICAgICAgICB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXNlIHNlcGFyYXRlIEFQSSBVUkwgZm9yIENsb3VkRnJvbnQgY29uZmlndXJhdGlvbiB0byBhdm9pZCBvcmlnaW4gY29uZmxpY3RzXG4gICAgY29uc3QgY2ZBcGlVcmwgPSBzdGFnZSA9PT0gJ3N0YWdpbmcnID8gbnVsbCA6IGFwaVVybDtcblxuICAgIC8vIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIChvcHRpb25hbClcbiAgICBpZiAoY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQpIHtcbiAgICAgIGNvbnN0IG9haSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdPcmlnaW5BY2Nlc3NJZGVudGl0eScsIHtcbiAgICAgICAgY29tbWVudDogYE9BSSBmb3IgVkogQXBwICR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBHcmFudCBDbG91ZEZyb250IGFjY2VzcyB0byBTMyBidWNrZXRcbiAgICAgIHRoaXMuc2l0ZUJ1Y2tldC5ncmFudFJlYWQob2FpKTtcblxuICAgICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ1NpdGVEaXN0cmlidXRpb24nLCB7XG4gICAgICAgIGRvbWFpbk5hbWVzOiBjZXJ0aWZpY2F0ZSA/IFtjb25maWcuZG9tYWluTmFtZV0gOiB1bmRlZmluZWQsXG4gICAgICAgIGNlcnRpZmljYXRlOiBjZXJ0aWZpY2F0ZSxcbiAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuc2l0ZUJ1Y2tldCwge1xuICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5DT1JTX1MzX09SSUdJTixcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczogY2ZBcGlVcmwgPyB7XG4gICAgICAgICAgJy9hcGkvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihjZkFwaVVybC5yZXBsYWNlKCdodHRwczovLycsICcnKS5yZXBsYWNlKCdodHRwOi8vJywgJycpLnNwbGl0KCcvJylbMF0pLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFELFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL3N0YXRpYy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLnNpdGVCdWNrZXQsIHtcbiAgICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeSh0aGlzLCAnU3RhdGljQXNzZXRzQ2FjaGVQb2xpY3knLCB7XG4gICAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogYHZqLXN0YXRpYy1hc3NldHMtJHtzdGFnZX1gLFxuICAgICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0gOiB7fSxcbiAgICAgICAgcHJpY2VDbGFzczogc3RhZ2UgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU19BTEwgXG4gICAgICAgICAgOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLFxuICAgICAgICBlbmFibGVMb2dnaW5nOiBzdGFnZSA9PT0gJ3Byb2QnLCAvLyBEaXNhYmxlIGxvZ2dpbmcgZm9yIG5vbi1wcm9kIHRvIHJlZHVjZSBjb3N0cyBhbmQgY29tcGxleGl0eVxuICAgICAgICBjb21tZW50OiBgVkogQXBwbGljYXRpb24gRGlzdHJpYnV0aW9uIC0gJHtzdGFnZX1gLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuc2l0ZVVybCA9IGNlcnRpZmljYXRlID8gYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gIDogYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWA7XG5cbiAgICAgIC8vIFJvdXRlIDUzIEROUyAoZm9yIHByb2R1Y3Rpb24gYW5kIHN0YWdpbmcgd2l0aCBjdXN0b20gZG9tYWluKVxuICAgICAgaWYgKGNlcnRpZmljYXRlICYmIChzdGFnZSA9PT0gJ3Byb2QnIHx8IHN0YWdlID09PSAnc3RhZ2luZycpKSB7XG4gICAgICAgIGNvbnN0IHpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnWm9uZScsIHtcbiAgICAgICAgICBkb21haW5OYW1lOiAnc2M0cGUubmV0JyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnU2l0ZUFsaWFzUmVjb3JkJywge1xuICAgICAgICAgIHJlY29yZE5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyB0YXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQodGhpcy5kaXN0cmlidXRpb24pKSxcbiAgICAgICAgICB6b25lLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBPbmx5IGNyZWF0ZSB3d3cgcmVjb3JkIGZvciBwcm9kdWN0aW9uXG4gICAgICAgIGlmIChzdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnV3d3U2l0ZUFsaWFzUmVjb3JkJywge1xuICAgICAgICAgICAgcmVjb3JkTmFtZTogYHd3dy4ke2NvbmZpZy5kb21haW5OYW1lfWAsXG4gICAgICAgICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKSksXG4gICAgICAgICAgICB6b25lLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdCBTMyB3ZWJzaXRlIGhvc3RpbmdcbiAgICAgIHRoaXMuc2l0ZVVybCA9IHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsO1xuICAgIH1cblxuICAgIC8vIEVudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gZmlsZSBmb3IgdGhlIGZyb250ZW5kXG4gICAgLy8gVXNlIHN0YXRpYyBVUkxzIGZvciBub24tcHJvZCBlbnZpcm9ubWVudHMgdG8gYXZvaWQgY3Jvc3Mtc3RhY2sgZGVwZW5kZW5jaWVzXG4gICAgY29uc3QgZW52Q29uZmlnID0gc3RhZ2UgPT09ICdzdGFnaW5nJyA/IHtcbiAgICAgIE5FWFRfUFVCTElDX0FQSV9VUkw6ICdodHRwczovLzdtNXZnZnVwMWEuZXhlY3V0ZS1hcGkuYXAtbm9ydGhlYXN0LTEuYW1hem9uYXdzLmNvbS9zdGFnaW5nLycsXG4gICAgICBORVhUX1BVQkxJQ19XRUJTT0NLRVRfVVJMOiAnd3NzOi8vcjRocWNpM3o1OS5leGVjdXRlLWFwaS5hcC1ub3J0aGVhc3QtMS5hbWF6b25hd3MuY29tL3N0YWdpbmcnLFxuICAgICAgTkVYVF9QVUJMSUNfU1RBR0U6IHN0YWdlLFxuICAgICAgTkVYVF9QVUJMSUNfRE9NQUlOOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgIE5FWFRfUFVCTElDX0VOQUJMRV9BVVRIOiBjb25maWcuZW5hYmxlQXV0aC50b1N0cmluZygpLFxuICAgICAgTkVYVF9QVUJMSUNfVkVSU0lPTjogJzEuMC4wJyxcbiAgICAgIE5FWFRfUFVCTElDX0JVSUxEX1RJTUU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9IDogc3RhZ2UgPT09ICdkZXYnID8ge1xuICAgICAgTkVYVF9QVUJMSUNfQVBJX1VSTDogJ2h0dHBzOi8vamVqNnl6a2JlYi5leGVjdXRlLWFwaS5hcC1ub3J0aGVhc3QtMS5hbWF6b25hd3MuY29tL2Rldi8nLFxuICAgICAgTkVYVF9QVUJMSUNfV0VCU09DS0VUX1VSTDogJ3dzczovL2MzeHM1ZHp6NGEuZXhlY3V0ZS1hcGkuYXAtbm9ydGhlYXN0LTEuYW1hem9uYXdzLmNvbS9kZXYnLFxuICAgICAgTkVYVF9QVUJMSUNfU1RBR0U6IHN0YWdlLFxuICAgICAgTkVYVF9QVUJMSUNfRE9NQUlOOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgIE5FWFRfUFVCTElDX0VOQUJMRV9BVVRIOiBjb25maWcuZW5hYmxlQXV0aC50b1N0cmluZygpLFxuICAgICAgTkVYVF9QVUJMSUNfVkVSU0lPTjogJzEuMC4wJyxcbiAgICAgIE5FWFRfUFVCTElDX0JVSUxEX1RJTUU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9IDoge1xuICAgICAgTkVYVF9QVUJMSUNfQVBJX1VSTDogYXBpVXJsLFxuICAgICAgTkVYVF9QVUJMSUNfV0VCU09DS0VUX1VSTDogd2Vic29ja2V0VXJsLFxuICAgICAgTkVYVF9QVUJMSUNfU1RBR0U6IHN0YWdlLFxuICAgICAgTkVYVF9QVUJMSUNfRE9NQUlOOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgIE5FWFRfUFVCTElDX0VOQUJMRV9BVVRIOiBjb25maWcuZW5hYmxlQXV0aC50b1N0cmluZygpLFxuICAgICAgTkVYVF9QVUJMSUNfVkVSU0lPTjogJzEuMC4wJyxcbiAgICAgIE5FWFRfUFVCTElDX0JVSUxEX1RJTUU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9O1xuXG4gICAgLy8gRGVwbG95IGVudmlyb25tZW50IGNvbmZpZ3VyYXRpb25cbiAgICBpZiAodGhpcy5kaXN0cmlidXRpb24pIHtcbiAgICAgIG5ldyBzM2RlcGxveS5CdWNrZXREZXBsb3ltZW50KHRoaXMsICdEZXBsb3lFbnZDb25maWcnLCB7XG4gICAgICAgIHNvdXJjZXM6IFtcbiAgICAgICAgICBzM2RlcGxveS5Tb3VyY2UuanNvbkRhdGEoJ2Vudi1jb25maWcuanNvbicsIGVudkNvbmZpZyksXG4gICAgICAgIF0sXG4gICAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiB0aGlzLnNpdGVCdWNrZXQsXG4gICAgICAgIGRlc3RpbmF0aW9uS2V5UHJlZml4OiAnY29uZmlnLycsXG4gICAgICAgIGRpc3RyaWJ1dGlvbjogdGhpcy5kaXN0cmlidXRpb24sXG4gICAgICAgIGRpc3RyaWJ1dGlvblBhdGhzOiBbJy9jb25maWcvKiddLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBzM2RlcGxveS5CdWNrZXREZXBsb3ltZW50KHRoaXMsICdEZXBsb3lFbnZDb25maWcnLCB7XG4gICAgICAgIHNvdXJjZXM6IFtcbiAgICAgICAgICBzM2RlcGxveS5Tb3VyY2UuanNvbkRhdGEoJ2Vudi1jb25maWcuanNvbicsIGVudkNvbmZpZyksXG4gICAgICAgIF0sXG4gICAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiB0aGlzLnNpdGVCdWNrZXQsXG4gICAgICAgIGRlc3RpbmF0aW9uS2V5UHJlZml4OiAnY29uZmlnLycsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCBhbmQgZGVwbG95bWVudCB1c2VyIChmb3IgQ0kvQ0QpXG4gICAgY29uc3QgZGVwbG95VXNlciA9IG5ldyBpYW0uVXNlcih0aGlzLCAnRGVwbG95VXNlcicsIHtcbiAgICAgIHVzZXJOYW1lOiBgdmotZGVwbG95LXVzZXItJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVwbG95UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3kodGhpcywgJ0RlcGxveVBvbGljeScsIHtcbiAgICAgIHBvbGljeU5hbWU6IGB2ai1kZXBsb3ktcG9saWN5LSR7c3RhZ2V9YCxcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpQdXRPYmplY3RBY2wnLFxuICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpMaXN0QnVja2V0JyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgdGhpcy5zaXRlQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgIGAke3RoaXMuc2l0ZUJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICAuLi4odGhpcy5kaXN0cmlidXRpb24gPyBbXG4gICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpDcmVhdGVJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpHZXRJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpMaXN0SW52YWxpZGF0aW9ucycsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgIGBhcm46YXdzOmNsb3VkZnJvbnQ6OiR7dGhpcy5hY2NvdW50fTpkaXN0cmlidXRpb24vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZH1gLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSA6IFtdKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBkZXBsb3lVc2VyLmF0dGFjaElubGluZVBvbGljeShkZXBsb3lQb2xpY3kpO1xuXG4gICAgLy8gQWNjZXNzIGtleSBmb3IgZGVwbG95bWVudCB1c2VyXG4gICAgY29uc3QgZGVwbG95QWNjZXNzS2V5ID0gbmV3IGlhbS5BY2Nlc3NLZXkodGhpcywgJ0RlcGxveUFjY2Vzc0tleScsIHtcbiAgICAgIHVzZXI6IGRlcGxveVVzZXIsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NpdGVVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zaXRlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJzaXRlIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgVmpTaXRlVXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTaXRlQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNpdGVCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IG5hbWUgZm9yIHdlYnNpdGUnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqU2l0ZUJ1Y2tldC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5kaXN0cmlidXRpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25JZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYFZqRGlzdHJpYnV0aW9uSWQtJHtzdGFnZX1gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25Eb21haW5OYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBkb21haW4gbmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGBWakRpc3RyaWJ1dGlvbkRvbWFpbi0ke3N0YWdlfWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95VXNlckFjY2Vzc0tleUlkJywge1xuICAgICAgdmFsdWU6IGRlcGxveUFjY2Vzc0tleS5hY2Nlc3NLZXlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWNjZXNzIEtleSBJRCBmb3IgZGVwbG95bWVudCB1c2VyJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEZXBsb3lVc2VyU2VjcmV0QWNjZXNzS2V5Jywge1xuICAgICAgdmFsdWU6IGRlcGxveUFjY2Vzc0tleS5zZWNyZXRBY2Nlc3NLZXkudW5zYWZlVW53cmFwKCksXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3JldCBBY2Nlc3MgS2V5IGZvciBkZXBsb3ltZW50IHVzZXIgKHNlbnNpdGl2ZSknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VudkNvbmZpZycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeShlbnZDb25maWcsIG51bGwsIDIpLFxuICAgICAgZGVzY3JpcHRpb246ICdFbnZpcm9ubWVudCBjb25maWd1cmF0aW9uIGZvciBmcm9udGVuZCcsXG4gICAgfSk7XG4gIH1cbn0iXX0=