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
        }
        else {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotc3RhdGljLWhvc3Rpbmctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2ai1zdGF0aWMtaG9zdGluZy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsd0VBQTBEO0FBQzFELGlFQUFtRDtBQUNuRCx5RUFBMkQ7QUFDM0QseURBQTJDO0FBZTNDLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDakMsVUFBVSxDQUFZO0lBQ3RCLFlBQVksQ0FBMkI7SUFDdkMsT0FBTyxDQUFTO0lBRWhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RCx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxVQUFVLEVBQUUsZUFBZSxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNsRCxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCO1lBQzFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7Z0JBQ3hDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztnQkFDaEMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDO29CQUN2QixlQUFlLEVBQUUsS0FBSztvQkFDdEIsaUJBQWlCLEVB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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWalN0YXRpY0hvc3RpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBkb21haW5OYW1lOiBzdHJpbmc7XG4gICAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICAgIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbiAgfTtcbiAgYXBpVXJsOiBzdHJpbmc7XG4gIHdlYnNvY2tldFVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVmpTdGF0aWNIb3N0aW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgc2l0ZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uPzogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSBzaXRlVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZqU3RhdGljSG9zdGluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGNvbmZpZywgYXBpVXJsLCB3ZWJzb2NrZXRVcmwgfSA9IHByb3BzO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBzdGF0aWMgd2Vic2l0ZSBob3N0aW5nXG4gICAgdGhpcy5zaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnU2l0ZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGB2ai1mcm9udGVuZC0ke3N0YWdlfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnZXJyb3IuaHRtbCcsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiAhY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQsIC8vIE9ubHkgcHVibGljIGlmIG5vdCB1c2luZyBDbG91ZEZyb250XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQgXG4gICAgICAgID8gczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMIFxuICAgICAgICA6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxuICAgICAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgICAgIH0pLFxuICAgICAgcmVtb3ZhbFBvbGljeTogc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogc3RhZ2UgIT09ICdwcm9kJyxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5IRUFEXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyBhZnRlciBjcmVhdGlvblxuICAgIGNkay5UYWdzLm9mKHRoaXMuc2l0ZUJ1Y2tldCkuYWRkKCdOYW1lJywgYFZKIEZyb250ZW5kIEJ1Y2tldCAtICR7c3RhZ2V9YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5zaXRlQnVja2V0KS5hZGQoJ1B1cnBvc2UnLCAnU3RhdGljIHdlYnNpdGUgaG9zdGluZycpO1xuXG4gICAgbGV0IGNlcnRpZmljYXRlOiBhY20uQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgLy8gU1NMIGNlcnRpZmljYXRlIChvbmx5IGZvciBwcm9kdWN0aW9uIHdpdGggY3VzdG9tIGRvbWFpbilcbiAgICBpZiAoY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQgJiYgc3RhZ2UgPT09ICdwcm9kJyAmJiBjb25maWcuZG9tYWluTmFtZSAhPT0gJ2xvY2FsaG9zdDozMDAwJykge1xuICAgICAgY2VydGlmaWNhdGUgPSBuZXcgYWNtLkNlcnRpZmljYXRlKHRoaXMsICdTaXRlQ2VydGlmaWNhdGUnLCB7XG4gICAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogW2B3d3cuJHtjb25maWcuZG9tYWluTmFtZX1gXSxcbiAgICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKCksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiAob3B0aW9uYWwpXG4gICAgaWYgKGNvbmZpZy5lbmFibGVDbG91ZEZyb250KSB7XG4gICAgICBjb25zdCBvYWkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnT3JpZ2luQWNjZXNzSWRlbnRpdHknLCB7XG4gICAgICAgIGNvbW1lbnQ6IGBPQUkgZm9yIFZKIEFwcCAke3N0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBhY2Nlc3MgdG8gUzMgYnVja2V0XG4gICAgICB0aGlzLnNpdGVCdWNrZXQuZ3JhbnRSZWFkKG9haSk7XG5cbiAgICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdTaXRlRGlzdHJpYnV0aW9uJywge1xuICAgICAgICBkb21haW5OYW1lczogY2VydGlmaWNhdGUgPyBbY29uZmlnLmRvbWFpbk5hbWVdIDogdW5kZWZpbmVkLFxuICAgICAgICBjZXJ0aWZpY2F0ZTogY2VydGlmaWNhdGUsXG4gICAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcygzMCksXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDMwKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuc2l0ZUJ1Y2tldCwge1xuICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5DT1JTX1MzX09SSUdJTixcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczogYXBpVXJsID8ge1xuICAgICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYXBpVXJsLnJlcGxhY2UoJ2h0dHBzOi8vJywgJycpLnJlcGxhY2UoJ2h0dHA6Ly8nLCAnJykuc3BsaXQoJy8nKVswXSksXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQUQsXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvc3RhdGljLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuc2l0ZUJ1Y2tldCwge1xuICAgICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogb2FpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsICdTdGF0aWNBc3NldHNDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiBgdmotc3RhdGljLWFzc2V0cy0ke3N0YWdlfWAsXG4gICAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSA6IHt9LFxuICAgICAgICBwcmljZUNsYXNzOiBzdGFnZSA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTX0FMTCBcbiAgICAgICAgICA6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsXG4gICAgICAgIGVuYWJsZUxvZ2dpbmc6IHRydWUsXG4gICAgICAgIGxvZ0J1Y2tldDogKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBsb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnTG9nc0J1Y2tldCcsIHtcbiAgICAgICAgICAgIGJ1Y2tldE5hbWU6IGB2ai1jbG91ZGZyb250LWxvZ3MtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ0RlbGV0ZU9sZExvZ3MnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDkwKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNkay5UYWdzLm9mKGxvZ3NCdWNrZXQpLmFkZCgnTmFtZScsIGBWSiBDbG91ZEZyb250IExvZ3MgLSAke3N0YWdlfWApO1xuICAgICAgICAgIGNkay5UYWdzLm9mKGxvZ3NCdWNrZXQpLmFkZCgnUHVycG9zZScsICdDbG91ZEZyb250IGFjY2VzcyBsb2dzJyk7XG4gICAgICAgICAgcmV0dXJuIGxvZ3NCdWNrZXQ7XG4gICAgICAgIH0pKCksXG4gICAgICAgIGxvZ0ZpbGVQcmVmaXg6ICdjbG91ZGZyb250LWxvZ3MvJyxcbiAgICAgICAgY29tbWVudDogYFZKIEFwcGxpY2F0aW9uIERpc3RyaWJ1dGlvbiAtICR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnNpdGVVcmwgPSBjZXJ0aWZpY2F0ZSA/IGBodHRwczovLyR7Y29uZmlnLmRvbWFpbk5hbWV9YCA6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gO1xuXG4gICAgICAvLyBSb3V0ZSA1MyBETlMgKG9ubHkgZm9yIHByb2R1Y3Rpb24gd2l0aCBjdXN0b20gZG9tYWluKVxuICAgICAgaWYgKGNlcnRpZmljYXRlICYmIHN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgICAgY29uc3Qgem9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHRoaXMsICdab25lJywge1xuICAgICAgICAgIGRvbWFpbk5hbWU6IGNvbmZpZy5kb21haW5OYW1lLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdTaXRlQWxpYXNSZWNvcmQnLCB7XG4gICAgICAgICAgcmVjb3JkTmFtZTogY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHRhcmdldHMuQ2xvdWRGcm9udFRhcmdldCh0aGlzLmRpc3RyaWJ1dGlvbikpLFxuICAgICAgICAgIHpvbmUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyByb3V0ZTUzLkFSZWNvcmQodGhpcywgJ1d3d1NpdGVBbGlhc1JlY29yZCcsIHtcbiAgICAgICAgICByZWNvcmROYW1lOiBgd3d3LiR7Y29uZmlnLmRvbWFpbk5hbWV9YCxcbiAgICAgICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKSksXG4gICAgICAgICAgem9uZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdCBTMyB3ZWJzaXRlIGhvc3RpbmdcbiAgICAgIHRoaXMuc2l0ZVVybCA9IHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsO1xuICAgIH1cblxuICAgIC8vIEVudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gZmlsZSBmb3IgdGhlIGZyb250ZW5kXG4gICAgLy8gRm9yIGRldiBlbnZpcm9ubWVudCwgdXNlIHN0YXRpYyBVUkxzIHNpbmNlIHdlIGNhbid0IHJlZmVyZW5jZSBjcm9zcy1zdGFja1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IHN0YWdlID09PSAnZGV2JyA/IHtcbiAgICAgIE5FWFRfUFVCTElDX0FQSV9VUkw6ICdodHRwczovL2plajZ5emtiZWIuZXhlY3V0ZS1hcGkuYXAtbm9ydGhlYXN0LTEuYW1hem9uYXdzLmNvbS9kZXYvJyxcbiAgICAgIE5FWFRfUFVCTElDX1dFQlNPQ0tFVF9VUkw6ICd3c3M6Ly9jM3hzNWR6ejRhLmV4ZWN1dGUtYXBpLmFwLW5vcnRoZWFzdC0xLmFtYXpvbmF3cy5jb20vZGV2JyxcbiAgICAgIE5FWFRfUFVCTElDX1NUQUdFOiBzdGFnZSxcbiAgICAgIE5FWFRfUFVCTElDX0RPTUFJTjogY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICBORVhUX1BVQkxJQ19FTkFCTEVfQVVUSDogY29uZmlnLmVuYWJsZUF1dGgudG9TdHJpbmcoKSxcbiAgICAgIE5FWFRfUFVCTElDX1ZFUlNJT046ICcxLjAuMCcsXG4gICAgICBORVhUX1BVQkxJQ19CVUlMRF9USU1FOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfSA6IHtcbiAgICAgIE5FWFRfUFVCTElDX0FQSV9VUkw6IGFwaVVybCxcbiAgICAgIE5FWFRfUFVCTElDX1dFQlNPQ0tFVF9VUkw6IHdlYnNvY2tldFVybCxcbiAgICAgIE5FWFRfUFVCTElDX1NUQUdFOiBzdGFnZSxcbiAgICAgIE5FWFRfUFVCTElDX0RPTUFJTjogY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICBORVhUX1BVQkxJQ19FTkFCTEVfQVVUSDogY29uZmlnLmVuYWJsZUF1dGgudG9TdHJpbmcoKSxcbiAgICAgIE5FWFRfUFVCTElDX1ZFUlNJT046ICcxLjAuMCcsXG4gICAgICBORVhUX1BVQkxJQ19CVUlMRF9USU1FOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfTtcblxuICAgIC8vIERlcGxveSBlbnZpcm9ubWVudCBjb25maWd1cmF0aW9uXG4gICAgaWYgKHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnRGVwbG95RW52Q29uZmlnJywge1xuICAgICAgICBzb3VyY2VzOiBbXG4gICAgICAgICAgczNkZXBsb3kuU291cmNlLmpzb25EYXRhKCdlbnYtY29uZmlnLmpzb24nLCBlbnZDb25maWcpLFxuICAgICAgICBdLFxuICAgICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogdGhpcy5zaXRlQnVja2V0LFxuICAgICAgICBkZXN0aW5hdGlvbktleVByZWZpeDogJ2NvbmZpZy8nLFxuICAgICAgICBkaXN0cmlidXRpb246IHRoaXMuZGlzdHJpYnV0aW9uLFxuICAgICAgICBkaXN0cmlidXRpb25QYXRoczogWycvY29uZmlnLyonXSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnRGVwbG95RW52Q29uZmlnJywge1xuICAgICAgICBzb3VyY2VzOiBbXG4gICAgICAgICAgczNkZXBsb3kuU291cmNlLmpzb25EYXRhKCdlbnYtY29uZmlnLmpzb24nLCBlbnZDb25maWcpLFxuICAgICAgICBdLFxuICAgICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogdGhpcy5zaXRlQnVja2V0LFxuICAgICAgICBkZXN0aW5hdGlvbktleVByZWZpeDogJ2NvbmZpZy8nLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgYW5kIGRlcGxveW1lbnQgdXNlciAoZm9yIENJL0NEKVxuICAgIGNvbnN0IGRlcGxveVVzZXIgPSBuZXcgaWFtLlVzZXIodGhpcywgJ0RlcGxveVVzZXInLCB7XG4gICAgICB1c2VyTmFtZTogYHZqLWRlcGxveS11c2VyLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlcGxveVBvbGljeSA9IG5ldyBpYW0uUG9saWN5KHRoaXMsICdEZXBsb3lQb2xpY3knLCB7XG4gICAgICBwb2xpY3lOYW1lOiBgdmotZGVwbG95LXBvbGljeS0ke3N0YWdlfWAsXG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgICAnczM6UHV0T2JqZWN0QWNsJyxcbiAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgIHRoaXMuc2l0ZUJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICBgJHt0aGlzLnNpdGVCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHRoaXMuZGlzdHJpYnV0aW9uID8gW1xuICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6Q3JlYXRlSW52YWxpZGF0aW9uJyxcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6R2V0SW52YWxpZGF0aW9uJyxcbiAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6TGlzdEludmFsaWRhdGlvbnMnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICBgYXJuOmF3czpjbG91ZGZyb250Ojoke3RoaXMuYWNjb3VudH06ZGlzdHJpYnV0aW9uLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0gOiBbXSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZGVwbG95VXNlci5hdHRhY2hJbmxpbmVQb2xpY3koZGVwbG95UG9saWN5KTtcblxuICAgIC8vIEFjY2VzcyBrZXkgZm9yIGRlcGxveW1lbnQgdXNlclxuICAgIGNvbnN0IGRlcGxveUFjY2Vzc0tleSA9IG5ldyBpYW0uQWNjZXNzS2V5KHRoaXMsICdEZXBsb3lBY2Nlc3NLZXknLCB7XG4gICAgICB1c2VyOiBkZXBsb3lVc2VyLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTaXRlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2l0ZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2Vic2l0ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYFZqU2l0ZVVybC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2l0ZUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zaXRlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciB3ZWJzaXRlJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBWalNpdGVCdWNrZXQtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGBWakRpc3RyaWJ1dGlvbklkLSR7c3RhZ2V9YCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uRG9tYWluTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZG9tYWluIG5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgVmpEaXN0cmlidXRpb25Eb21haW4tJHtzdGFnZX1gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveVVzZXJBY2Nlc3NLZXlJZCcsIHtcbiAgICAgIHZhbHVlOiBkZXBsb3lBY2Nlc3NLZXkuYWNjZXNzS2V5SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FjY2VzcyBLZXkgSUQgZm9yIGRlcGxveW1lbnQgdXNlcicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95VXNlclNlY3JldEFjY2Vzc0tleScsIHtcbiAgICAgIHZhbHVlOiBkZXBsb3lBY2Nlc3NLZXkuc2VjcmV0QWNjZXNzS2V5LnVuc2FmZVVud3JhcCgpLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWNyZXQgQWNjZXNzIEtleSBmb3IgZGVwbG95bWVudCB1c2VyIChzZW5zaXRpdmUpJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbnZDb25maWcnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoZW52Q29uZmlnLCBudWxsLCAyKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW52aXJvbm1lbnQgY29uZmlndXJhdGlvbiBmb3IgZnJvbnRlbmQnLFxuICAgIH0pO1xuICB9XG59Il19