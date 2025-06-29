import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
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
export declare class VjStaticHostingStack extends cdk.Stack {
    readonly siteBucket: s3.Bucket;
    readonly distribution?: cloudfront.Distribution;
    readonly siteUrl: string;
    constructor(scope: Construct, id: string, props: VjStaticHostingStackProps);
}
