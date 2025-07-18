import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
export interface VjUnifiedStackProps extends cdk.StackProps {
    stage: string;
    enableAuth?: boolean;
    enableCloudFront?: boolean;
    enableBackup?: boolean;
    domainName?: string;
}
export declare class VjUnifiedStack extends cdk.Stack {
    readonly configTable: dynamodb.Table;
    readonly presetTable: dynamodb.Table;
    readonly sessionTable: dynamodb.Table;
    readonly presetBucket: s3.Bucket;
    readonly backupBucket: s3.Bucket;
    readonly siteBucket: s3.Bucket;
    readonly presetFunction: lambda.Function;
    readonly connectionFunction: lambda.Function;
    readonly messageFunction: lambda.Function;
    readonly healthFunction: lambda.Function;
    readonly cleanupFunction: lambda.Function;
    readonly s3ProcessorFunction: lambda.Function;
    readonly metricsFunction: lambda.Function;
    readonly api: apigateway.RestApi;
    readonly websocketApi: apigateway.RestApi;
    readonly logGroup: logs.LogGroup;
    readonly dashboard: cloudwatch.Dashboard;
    readonly distribution: cloudfront.Distribution;
    readonly certificate?: acm.ICertificate;
    readonly apiUrl: string;
    readonly websocketUrl: string;
    readonly frontendUrl: string;
    constructor(scope: Construct, id: string, props: VjUnifiedStackProps);
}
