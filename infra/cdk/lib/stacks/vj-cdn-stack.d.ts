import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
export interface VjCdnStackProps extends cdk.StackProps {
    stage: 'dev' | 'staging' | 'prod';
    siteBucket: s3.Bucket;
    domainName?: string;
    certificate?: certificatemanager.Certificate;
}
export declare class VjCdnStack extends cdk.Stack {
    readonly distribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: VjCdnStackProps);
}
