import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
export interface VjLoggingStackProps extends cdk.StackProps {
    stage: string;
    lambdaFunctions: lambda.Function[];
}
export declare class VjLoggingStack extends cdk.Stack {
    readonly logsBucket: s3.Bucket;
    readonly kinesisStream: kinesis.Stream;
    readonly firehoseDeliveryStream: kinesisfirehose.CfnDeliveryStream;
    constructor(scope: Construct, id: string, props: VjLoggingStackProps);
}
