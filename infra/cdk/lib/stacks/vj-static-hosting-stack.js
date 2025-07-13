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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RhdGljLWhvc3Rpbmctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2ai1zdGF0aWMtaG9zdGluZy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsd0VBQTBEO0FBQzFELGlFQUFtRDtBQUNuRCx5RUFBMkQ7QUFDM0QseURBQTJDO0FBZTNDLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDakMsVUFBVSxDQUFZO0lBQ3RCLFlBQVksQ0FBMkI7SUFDdkMsT0FBTyxDQUFTO0lBRWhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RCx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxVQUFVLEVBQUUsZUFBZSxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNsRCxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCO1lBQzFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7Z0JBQ3hDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztnQkFDaEMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDO29CQUN2QixlQUFlLEVBQUUsS0FBSztvQkFDdEIsaUJBQWlCLEVBQUUsS0FBSztvQkFDeEIsZ0JBQWdCLEVBQUUsS0FBSztvQkFDdkIscUJBQXFCLEVBQUUsS0FBSztpQkFDN0IsQ0FBQztZQUNOLGFBQWEsRUFBRSxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3RGLGlCQUFpQixFQUFFLEtBQUssS0FBSyxNQUFNO1lBQ25DLElBQUksRUFBRTtnQkFDSjtvQkFDRSxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztvQkFDekQsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDO29CQUNyQixjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLE1BQU0sRUFBRSxJQUFJO2lCQUNiO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsd0JBQXdCLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDMUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUV0RSxJQUFJLFdBQXlDLENBQUM7UUFFOUMsa0VBQWtFO1FBQ2xFLElBQUksTUFBTSxDQUFDLGdCQUFnQixJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssU0FBUyxDQUFDLElBQUksTUFBTSxDQUFDLFVBQVUsS0FBSyxnQkFBZ0IsRUFBRTtZQUNsSCx3Q0FBd0M7WUFDeEMsTUFBTSxjQUFjLEdBQUcsS0FBSyxLQUFLLFNBQVM7Z0JBQ3hDLENBQUMsQ0FBQyxxRkFBcUY7Z0JBQ3ZGLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFFZCxJQUFJLGNBQWMsRUFBRTtnQkFDbEIsV0FBVyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFLGNBQWMsQ0FBQyxDQUFDO2FBQzNGO2lCQUFNO2dCQUNMLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO29CQUN6RCxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7b0JBQzdCLHVCQUF1QixFQUFFLENBQUMsT0FBTyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ3JELFVBQVUsRUFBRSxHQUFHLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFO2lCQUNoRCxDQUFDLENBQUM7YUFDSjtTQUNGO1FBRUQsOEVBQThFO1FBQzlFLE1BQU0sUUFBUSxHQUFHLEtBQUssS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBRXJELHFDQUFxQztRQUNyQyxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtZQUMzQixNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7Z0JBQzVFLE9BQU8sRUFBRSxrQkFBa0IsS0FBSyxFQUFFO2FBQ25DLENBQUMsQ0FBQztZQUVILHVDQUF1QztZQUN2QyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUUvQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3hFLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUMxRCxXQUFXLEVBQUUsV0FBVztnQkFDeEIsaUJBQWlCLEVBQUUsWUFBWTtnQkFDL0IsY0FBYyxFQUFFO29CQUNkO3dCQUNFLFVBQVUsRUFBRSxHQUFHO3dCQUNmLGtCQUFrQixFQUFFLEdBQUc7d0JBQ3ZCLGdCQUFnQixFQUFFLGFBQWE7d0JBQy9CLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7cUJBQzdCO29CQUNEO3dCQUNFLFVBQVUsRUFBRSxHQUFHO3dCQUNmLGtCQUFrQixFQUFFLEdBQUc7d0JBQ3ZCLGdCQUFnQixFQUFFLGFBQWE7d0JBQy9CLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7cUJBQzdCO2lCQUNGO2dCQUNELGVBQWUsRUFBRTtvQkFDZixNQUFNLEVBQUUsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7d0JBQzVDLG9CQUFvQixFQUFFLEdBQUc7cUJBQzFCLENBQUM7b0JBQ0YsUUFBUSxFQUFFLElBQUk7b0JBQ2QsY0FBYyxFQUFFLFVBQVUsQ0FBQyxjQUFjLENBQUMsc0JBQXNCO29CQUNoRSxhQUFhLEVBQUUsVUFBVSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0I7b0JBQzlELG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUI7b0JBQ3ZFLFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVyxDQUFDLGlCQUFpQjtvQkFDckQsbUJBQW1CLEVBQUUsVUFBVSxDQUFDLG1CQUFtQixDQUFDLGNBQWM7aUJBQ25FO2dCQUNELG1CQUFtQixFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzlCLFFBQVEsRUFBRTt3QkFDUixNQUFNLEVBQUUsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNyRyxjQUFjLEVBQUUsVUFBVSxDQUFDLGNBQWMsQ0FBQyxTQUFTO3dCQUNuRCxhQUFhLEVBQUUsVUFBVSxDQUFDLGFBQWEsQ0FBQyxjQUFjO3dCQUN0RCxvQkFBb0IsRUFBRSxVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO3dCQUN2RSxXQUFXLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0I7d0JBQ3BELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVO3FCQUMvRDtvQkFDRCxXQUFXLEVBQUU7d0JBQ1gsTUFBTSxFQUFFLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFOzRCQUM1QyxvQkFBb0IsRUFBRSxHQUFHO3lCQUMxQixDQUFDO3dCQUNGLFFBQVEsRUFBRSxJQUFJO3dCQUNkLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUI7d0JBQ3ZFLFdBQVcsRUFBRSxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFOzRCQUN2RSxlQUFlLEVBQUUsb0JBQW9CLEtBQUssRUFBRTs0QkFDNUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzs0QkFDaEMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQzs0QkFDOUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzs0QkFDL0IsY0FBYyxFQUFFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUU7NEJBQ3JELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUU7NEJBQy9ELGNBQWMsRUFBRSxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFO3lCQUN0RCxDQUFDO3FCQUNIO2lCQUNGLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ04sVUFBVSxFQUFFLEtBQUssS0FBSyxNQUFNO29CQUMxQixDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxlQUFlO29CQUN2QyxDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxlQUFlO2dCQUN6QyxhQUFhLEVBQUUsS0FBSyxLQUFLLE1BQU07Z0JBQy9CLE9BQU8sRUFBRSxpQ0FBaUMsS0FBSyxFQUFFO2FBQ2xELENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQixFQUFFLENBQUM7WUFFcEgsK0RBQStEO1lBQy9ELElBQUksV0FBVyxJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssU0FBUyxDQUFDLEVBQUU7Z0JBQzVELE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUU7b0JBQ3ZELFVBQVUsRUFBRSxXQUFXO2lCQUN4QixDQUFDLENBQUM7Z0JBRUgsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtvQkFDM0MsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO29CQUM3QixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO29CQUN2RixJQUFJO2lCQUNMLENBQUMsQ0FBQztnQkFFSCx3Q0FBd0M7Z0JBQ3hDLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRTtvQkFDcEIsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTt3QkFDOUMsVUFBVSxFQUFFLE9BQU8sTUFBTSxDQUFDLFVBQVUsRUFBRTt3QkFDdEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDdkYsSUFBSTtxQkFDTCxDQUFDLENBQUM7aUJBQ0o7YUFDRjtTQUNGO2FBQU07WUFDTCw0QkFBNEI7WUFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDO1NBQ2pEO1FBRUQsa0RBQWtEO1FBQ2xELDhFQUE4RTtRQUM5RSxNQUFNLFNBQVMsR0FBRyxLQUFLLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN0QyxtQkFBbUIsRUFBRSxzRUFBc0U7WUFDM0YseUJBQXlCLEVBQUUsbUVBQW1FO1lBQzlGLGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLFVBQVU7WUFDckMsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUU7WUFDckQsbUJBQW1CLEVBQUUsT0FBTztZQUM1QixzQkFBc0IsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtTQUNqRCxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNwQixtQkFBbUIsRUFBRSxrRUFBa0U7WUFDdkYseUJBQXlCLEVBQUUsK0RBQStEO1lBQzFGLGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLFVBQVU7WUFDckMsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUU7WUFDckQsbUJBQW1CLEVBQUUsT0FBTztZQUM1QixzQkFBc0IsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtTQUNqRCxDQUFDLENBQUMsQ0FBQztZQUNGLG1CQUFtQixFQUFFLE1BQU07WUFDM0IseUJBQXlCLEVBQUUsWUFBWTtZQUN2QyxpQkFBaUIsRUFBRSxLQUFLO1lBQ3hCLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQ3JDLHVCQUF1QixFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFO1lBQ3JELG1CQUFtQixFQUFFLE9BQU87WUFDNUIsc0JBQXNCLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7U0FDakQsQ0FBQztRQUVGLG1DQUFtQztRQUNuQyxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDckIsSUFBSSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO2dCQUNyRCxPQUFPLEVBQUU7b0JBQ1AsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDO2lCQUN2RDtnQkFDRCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsVUFBVTtnQkFDbEMsb0JBQW9CLEVBQUUsU0FBUztnQkFDL0IsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO2dCQUMvQixpQkFBaUIsRUFBRSxDQUFDLFdBQVcsQ0FBQzthQUNqQyxDQUFDLENBQUM7U0FDSjthQUFNO1lBQ0wsSUFBSSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO2dCQUNyRCxPQUFPLEVBQUU7b0JBQ1AsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDO2lCQUN2RDtnQkFDRCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsVUFBVTtnQkFDbEMsb0JBQW9CLEVBQUUsU0FBUzthQUNoQyxDQUFDLENBQUM7U0FDSjtRQUVELHdDQUF3QztRQUN4QyxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxRQUFRLEVBQUUsa0JBQWtCLEtBQUssRUFBRTtTQUNwQyxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN4RCxVQUFVLEVBQUUsb0JBQW9CLEtBQUssRUFBRTtZQUN2QyxVQUFVLEVBQUU7Z0JBQ1YsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO29CQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO29CQUN4QixPQUFPLEVBQUU7d0JBQ1AsY0FBYzt3QkFDZCxpQkFBaUI7d0JBQ2pCLGNBQWM7d0JBQ2QsaUJBQWlCO3dCQUNqQixlQUFlO3FCQUNoQjtvQkFDRCxTQUFTLEVBQUU7d0JBQ1QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTO3dCQUN6QixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxJQUFJO3FCQUNqQztpQkFDRixDQUFDO2dCQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztvQkFDdEIsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO3dCQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO3dCQUN4QixPQUFPLEVBQUU7NEJBQ1AsK0JBQStCOzRCQUMvQiw0QkFBNEI7NEJBQzVCLDhCQUE4Qjt5QkFDL0I7d0JBQ0QsU0FBUyxFQUFFOzRCQUNULHVCQUF1QixJQUFJLENBQUMsT0FBTyxpQkFBaUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUU7eUJBQ3ZGO3FCQUNGLENBQUM7aUJBQ0gsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2FBQ1I7U0FDRixDQUFDLENBQUM7UUFFSCxVQUFVLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFNUMsaUNBQWlDO1FBQ2pDLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDakUsSUFBSSxFQUFFLFVBQVU7U0FDakIsQ0FBQyxDQUFDO1FBRUgsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2pDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTztZQUNuQixXQUFXLEVBQUUsYUFBYTtZQUMxQixVQUFVLEVBQUUsYUFBYSxLQUFLLEVBQUU7U0FDakMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVO1lBQ2pDLFdBQVcsRUFBRSw0QkFBNEI7WUFDekMsVUFBVSxFQUFFLGdCQUFnQixLQUFLLEVBQUU7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7Z0JBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWM7Z0JBQ3ZDLFdBQVcsRUFBRSw0QkFBNEI7Z0JBQ3pDLFVBQVUsRUFBRSxvQkFBb0IsS0FBSyxFQUFFO2FBQ3hDLENBQUMsQ0FBQztZQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7Z0JBQ2hELEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQjtnQkFDL0MsV0FBVyxFQUFFLHFDQUFxQztnQkFDbEQsVUFBVSxFQUFFLHdCQUF3QixLQUFLLEVBQUU7YUFDNUMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxlQUFlLENBQUMsV0FBVztZQUNsQyxXQUFXLEVBQUUsbUNBQW1DO1NBQ2pELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDbkQsS0FBSyxFQUFFLGVBQWUsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFO1lBQ3JELFdBQVcsRUFBRSxtREFBbUQ7U0FDakUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDekMsV0FBVyxFQUFFLHdDQUF3QztTQUN0RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUExU0Qsb0RBMFNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWalN0YXRpY0hvc3RpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgYXBpVXJsOiBzdHJpbmc7XG4gIHdlYnNvY2tldFVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVmpTdGF0aWNIb3N0aW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgc2l0ZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uPzogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSBzaXRlVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqU3RhdGljSG9zdGluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZywgYXBpVXJsLCB3ZWJzb2NrZXRVcmwgfSA9IHByb3BzO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBzdGF0aWMgd2Vic2l0ZSBob3N0aW5nXG4gICAgdGhpcy5zaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnU2l0ZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGB2ai1mcm9udGVuZC0ke3N0YWdlfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnZXJyb3IuaHRtbCcsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiAhY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQsIC8vIE9ubHkgcHVibGljIGlmIG5vdCB1c2luZyBDbG91ZEZyb250XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQgXG4gICAgICAgID8gczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMIFxuICAgICAgICA6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxuICAgICAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgICAgIH0pLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5IRUFEXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyBhZnRlciBjcmVhdGlvblxuICAgIGNkay5UYWdzLm9mKHRoaXMuc2l0ZUJ1Y2tldCkuYWRkKCdOYW1lJywgYFZKIEZyb250ZW5kIEJ1Y2tldCAtICR7c3RhZ2V9YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5zaXRlQnVja2V0KS5hZGQoJ1B1cnBvc2UnLCAnU3RhdGljIHdlYnNpdGUgaG9zdGluZycpO1xuXG4gICAgbGV0IGNlcnRpZmljYXRlOiBhY20uSUNlcnRpZmljYXRlIHwgdW5kZWZpbmVkO1xuICAgIFxuICAgIC8vIFNTTCBjZXJ0aWZpY2F0ZSAoZm9yIHByb2R1Y3Rpb24gYW5kIHN0YWdpbmcgd2l0aCBjdXN0b20gZG9tYWluKVxuICAgIGlmIChjb25maWcuZW5hYmxlQ2xvdWRGcm9udCAmJiAoc3RhZ2UgPT09ICdwcm9kJyB8fCBzdGFnZSA9PT0gJ3N0YWdpbmcnKSAmJiBjb25maWcuZG9tYWluTmFtZSAhPT0gJ2xvY2FsaG9zdDozMDAwJykge1xuICAgICAgLy8gVXNlIGV4aXN0aW5nIGNlcnRpZmljYXRlIGlmIGF2YWlsYWJsZVxuICAgICAgY29uc3QgY2VydGlmaWNhdGVBcm4gPSBzdGFnZSA9PT0gJ3N0YWdpbmcnIFxuICAgICAgICA/ICdhcm46YXdzOmFjbTp1cy1lYXN0LTE6ODIyMDYzOTQ4NzczOmNlcnRpZmljYXRlLzAzNDNlY2ZkLTZmNmQtNGVhMi1hN2U2LTBlODI3NjZjYjBmNydcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICBcbiAgICAgIGlmIChjZXJ0aWZpY2F0ZUFybikge1xuICAgICAgICBjZXJ0aWZpY2F0ZSA9IGFjbS5DZXJ0aWZpY2F0ZS5mcm9tQ2VydGlmaWNhdGVBcm4odGhpcywgJ1NpdGVDZXJ0aWZpY2F0ZScsIGNlcnRpZmljYXRlQXJuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNlcnRpZmljYXRlID0gbmV3IGFjbS5DZXJ0aWZpY2F0ZSh0aGlzLCAnU2l0ZUNlcnRpZmljYXRlJywge1xuICAgICAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBbYHd3dy4ke2NvbmZpZy5kb21haW5OYW1lfWBdLFxuICAgICAgICAgIHZhbGlkYXRpb246IGFjbS5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucygpLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVc2Ugc2VwYXJhdGUgQVBJIFVSTCBmb3IgQ2xvdWRGcm9udCBjb25maWd1cmF0aW9uIHRvIGF2b2lkIG9yaWdpbiBjb25mbGljdHNcbiAgICBjb25zdCBjZkFwaVVybCA9IHN0YWdlID09PSAnc3RhZ2luZycgPyBudWxsIDogYXBpVXJsO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gKG9wdGlvbmFsKVxuICAgIGlmIChjb25maWcuZW5hYmxlQ2xvdWRGcm9udCkge1xuICAgICAgY29uc3Qgb2FpID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcywgJ09yaWdpbkFjY2Vzc0lkZW50aXR5Jywge1xuICAgICAgICBjb21tZW50OiBgT0FJIGZvciBWSiBBcHAgJHtzdGFnZX1gLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEdyYW50IENsb3VkRnJvbnQgYWNjZXNzIHRvIFMzIGJ1Y2tldFxuICAgICAgdGhpcy5zaXRlQnVja2V0LmdyYW50UmVhZChvYWkpO1xuXG4gICAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnU2l0ZURpc3RyaWJ1dGlvbicsIHtcbiAgICAgICAgZG9tYWluTmFtZXM6IGNlcnRpZmljYXRlID8gW2NvbmZpZy5kb21haW5OYW1lXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4odGhpcy5zaXRlQnVja2V0LCB7XG4gICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogb2FpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkNPUlNfUzNfT1JJR0lOLFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiBjZkFwaVVybCA/IHtcbiAgICAgICAgICAnL2FwaS8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGNmQXBpVXJsLnJlcGxhY2UoJ2h0dHBzOi8vJywgJycpLnJlcGxhY2UoJ2h0dHA6Ly8nLCAnJykuc3BsaXQoJy8nKVswXSksXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQUQsXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvc3RhdGljLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuc2l0ZUJ1Y2tldCwge1xuICAgICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogb2FpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsICdTdGF0aWNBc3NldHNDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiBgdmotc3RhdGljLWFzc2V0cy0ke3N0YWdlfWAsXG4gICAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSA6IHt9LFxuICAgICAgICBwcmljZUNsYXNzOiBzdGFnZSA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTX0FMTCBcbiAgICAgICAgICA6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsXG4gICAgICAgIGVuYWJsZUxvZ2dpbmc6IHN0YWdlID09PSAncHJvZCcsIC8vIERpc2FibGUgbG9nZ2luZyBmb3Igbm9uLXByb2QgdG8gcmVkdWNlIGNvc3RzIGFuZCBjb21wbGV4aXR5XG4gICAgICAgIGNvbW1lbnQ6IGBWSiBBcHBsaWNhdGlvbiBEaXN0cmlidXRpb24gLSAke3N0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5zaXRlVXJsID0gY2VydGlmaWNhdGUgPyBgaHR0cHM6Ly8ke2NvbmZpZy5kb21haW5OYW1lfWAgOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YDtcblxuICAgICAgLy8gUm91dGUgNTMgRE5TIChmb3IgcHJvZHVjdGlvbiBhbmQgc3RhZ2luZyB3aXRoIGN1c3RvbSBkb21haW4pXG4gICAgICBpZiAoY2VydGlmaWNhdGUgJiYgKHN0YWdlID09PSAncHJvZCcgfHwgc3RhZ2UgPT09ICdzdGFnaW5nJykpIHtcbiAgICAgICAgY29uc3Qgem9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHRoaXMsICdab25lJywge1xuICAgICAgICAgIGRvbWFpbk5hbWU6ICdzYzRwZS5uZXQnLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdTaXRlQWxpYXNSZWNvcmQnLCB7XG4gICAgICAgICAgcmVjb3JkTmFtZTogY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHRhcmdldHMuQ2xvdWRGcm9udFRhcmdldCh0aGlzLmRpc3RyaWJ1dGlvbikpLFxuICAgICAgICAgIHpvbmUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE9ubHkgY3JlYXRlIHd3dyByZWNvcmQgZm9yIHByb2R1Y3Rpb25cbiAgICAgICAgaWYgKHN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgICAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdXd3dTaXRlQWxpYXNSZWNvcmQnLCB7XG4gICAgICAgICAgICByZWNvcmROYW1lOiBgd3d3LiR7Y29uZmlnLmRvbWFpbk5hbWV9YCxcbiAgICAgICAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyB0YXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQodGhpcy5kaXN0cmlidXRpb24pKSxcbiAgICAgICAgICAgIHpvbmUsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0IFMzIHdlYnNpdGUgaG9zdGluZ1xuICAgICAgdGhpcy5zaXRlVXJsID0gdGhpcy5zaXRlQnVja2V0LmJ1Y2tldFdlYnNpdGVVcmw7XG4gICAgfVxuXG4gICAgLy8gRW52aXJvbm1lbnQgY29uZmlndXJhdGlvbiBmaWxlIGZvciB0aGUgZnJvbnRlbmRcbiAgICAvLyBVc2Ugc3RhdGljIFVSTHMgZm9yIG5vbi1wcm9kIGVudmlyb25tZW50cyB0byBhdm9pZCBjcm9zcy1zdGFjayBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBlbnZDb25maWcgPSBzdGFnZSA9PT0gJ3N0YWdpbmcnID8ge1xuICAgICAgTkVYVF9QVUJMSUNfQVBJX1VSTDogJ2h0dHBzOi8vN201dmdmdXAxYS5leGVjdXRlLWFwaS5hcC1ub3J0aGVhc3QtMS5hbWF6b25hd3MuY29tL3N0YWdpbmcvJyxcbiAgICAgIE5FWFRfUFVCTElDX1dFQlNPQ0tFVF9VUkw6ICd3c3M6Ly9yNGhxY2kzejU5LmV4ZWN1dGUtYXBpLmFwLW5vcnRoZWFzdC0xLmFtYXpvbmF3cy5jb20vc3RhZ2luZycsXG4gICAgICBORVhUX1BVQkxJQ19TVEFHRTogc3RhZ2UsXG4gICAgICBORVhUX1BVQkxJQ19ET01BSU46IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgTkVYVF9QVUJMSUNfRU5BQkxFX0FVVEg6IGNvbmZpZy5lbmFibGVBdXRoLnRvU3RyaW5nKCksXG4gICAgICBORVhUX1BVQkxJQ19WRVJTSU9OOiAnMS4wLjAnLFxuICAgICAgTkVYVF9QVUJMSUNfQlVJTERfVElNRTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0gOiBzdGFnZSA9PT0gJ2RldicgPyB7XG4gICAgICBORVhUX1BVQkxJQ19BUElfVVJMOiAnaHR0cHM6Ly9qZWo2eXprYmViLmV4ZWN1dGUtYXBpLmFwLW5vcnRoZWFzdC0xLmFtYXpvbmF3cy5jb20vZGV2LycsXG4gICAgICBORVhUX1BVQkxJQ19XRUJTT0NLRVRfVVJMOiAnd3NzOi8vYzN4czVkeno0YS5leGVjdXRlLWFwaS5hcC1ub3J0aGVhc3QtMS5hbWF6b25hd3MuY29tL2RldicsXG4gICAgICBORVhUX1BVQkxJQ19TVEFHRTogc3RhZ2UsXG4gICAgICBORVhUX1BVQkxJQ19ET01BSU46IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgTkVYVF9QVUJMSUNfRU5BQkxFX0FVVEg6IGNvbmZpZy5lbmFibGVBdXRoLnRvU3RyaW5nKCksXG4gICAgICBORVhUX1BVQkxJQ19WRVJTSU9OOiAnMS4wLjAnLFxuICAgICAgTkVYVF9QVUJMSUNfQlVJTERfVElNRTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0gOiB7XG4gICAgICBORVhUX1BVQkxJQ19BUElfVVJMOiBhcGlVcmwsXG4gICAgICBORVhUX1BVQkxJQ19XRUJTT0NLRVRfVVJMOiB3ZWJzb2NrZXRVcmwsXG4gICAgICBORVhUX1BVQkxJQ19TVEFHRTogc3RhZ2UsXG4gICAgICBORVhUX1BVQkxJQ19ET01BSU46IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgTkVYVF9QVUJMSUNfRU5BQkxFX0FVVEg6IGNvbmZpZy5lbmFibGVBdXRoLnRvU3RyaW5nKCksXG4gICAgICBORVhUX1BVQkxJQ19WRVJTSU9OOiAnMS4wLjAnLFxuICAgICAgTkVYVF9QVUJMSUNfQlVJTERfVElNRTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH07XG5cbiAgICAvLyBEZXBsb3kgZW52aXJvbm1lbnQgY29uZmlndXJhdGlvblxuICAgIGlmICh0aGlzLmRpc3RyaWJ1dGlvbikge1xuICAgICAgbmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQodGhpcywgJ0RlcGxveUVudkNvbmZpZycsIHtcbiAgICAgICAgc291cmNlczogW1xuICAgICAgICAgIHMzZGVwbG95LlNvdXJjZS5qc29uRGF0YSgnZW52LWNvbmZpZy5qc29uJywgZW52Q29uZmlnKSxcbiAgICAgICAgXSxcbiAgICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IHRoaXMuc2l0ZUJ1Y2tldCxcbiAgICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6ICdjb25maWcvJyxcbiAgICAgICAgZGlzdHJpYnV0aW9uOiB0aGlzLmRpc3RyaWJ1dGlvbixcbiAgICAgICAgZGlzdHJpYnV0aW9uUGF0aHM6IFsnL2NvbmZpZy8qJ10sXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQodGhpcywgJ0RlcGxveUVudkNvbmZpZycsIHtcbiAgICAgICAgc291cmNlczogW1xuICAgICAgICAgIHMzZGVwbG95LlNvdXJjZS5qc29uRGF0YSgnZW52LWNvbmZpZy5qc29uJywgZW52Q29uZmlnKSxcbiAgICAgICAgXSxcbiAgICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IHRoaXMuc2l0ZUJ1Y2tldCxcbiAgICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6ICdjb25maWcvJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEJ1aWxkIGFuZCBkZXBsb3ltZW50IHVzZXIgKGZvciBDSS9DRClcbiAgICBjb25zdCBkZXBsb3lVc2VyID0gbmV3IGlhbS5Vc2VyKHRoaXMsICdEZXBsb3lVc2VyJywge1xuICAgICAgdXNlck5hbWU6IGB2ai1kZXBsb3ktdXNlci0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkZXBsb3lQb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnRGVwbG95UG9saWN5Jywge1xuICAgICAgcG9saWN5TmFtZTogYHZqLWRlcGxveS1wb2xpY3ktJHtzdGFnZX1gLFxuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOlB1dE9iamVjdEFjbCcsXG4gICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICB0aGlzLnNpdGVCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgYCR7dGhpcy5zaXRlQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLih0aGlzLmRpc3RyaWJ1dGlvbiA/IFtcbiAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICdjbG91ZGZyb250OkNyZWF0ZUludmFsaWRhdGlvbicsXG4gICAgICAgICAgICAgICdjbG91ZGZyb250OkdldEludmFsaWRhdGlvbicsXG4gICAgICAgICAgICAgICdjbG91ZGZyb250Okxpc3RJbnZhbGlkYXRpb25zJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkfWAsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdIDogW10pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGRlcGxveVVzZXIuYXR0YWNoSW5saW5lUG9saWN5KGRlcGxveVBvbGljeSk7XG5cbiAgICAvLyBBY2Nlc3Mga2V5IGZvciBkZXBsb3ltZW50IHVzZXJcbiAgICBjb25zdCBkZXBsb3lBY2Nlc3NLZXkgPSBuZXcgaWFtLkFjY2Vzc0tleSh0aGlzLCAnRGVwbG95QWNjZXNzS2V5Jywge1xuICAgICAgdXNlcjogZGVwbG95VXNlcixcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2l0ZVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNpdGVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYnNpdGUgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalNpdGVVcmwtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NpdGVCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgbmFtZSBmb3Igd2Vic2l0ZScsXG4gICAgICBleHBvcnROYW1lOiBgVmpTaXRlQnVja2V0LSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmRpc3RyaWJ1dGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rpc3RyaWJ1dGlvbklkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgVmpEaXN0cmlidXRpb25JZC0ke3N0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rpc3RyaWJ1dGlvbkRvbWFpbk5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGRvbWFpbiBuYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYFZqRGlzdHJpYnV0aW9uRG9tYWluLSR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEZXBsb3lVc2VyQWNjZXNzS2V5SWQnLCB7XG4gICAgICB2YWx1ZTogZGVwbG95QWNjZXNzS2V5LmFjY2Vzc0tleUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdBY2Nlc3MgS2V5IElEIGZvciBkZXBsb3ltZW50IHVzZXInLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveVVzZXJTZWNyZXRBY2Nlc3NLZXknLCB7XG4gICAgICB2YWx1ZTogZGVwbG95QWNjZXNzS2V5LnNlY3JldEFjY2Vzc0tleS51bnNhZmVVbndyYXAoKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjcmV0IEFjY2VzcyBLZXkgZm9yIGRlcGxveW1lbnQgdXNlciAoc2Vuc2l0aXZlKScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRW52Q29uZmlnJywge1xuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KGVudkNvbmZpZywgbnVsbCwgMiksXG4gICAgICBkZXNjcmlwdGlvbjogJ0Vudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gZm9yIGZyb250ZW5kJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==