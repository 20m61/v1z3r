import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
export interface VjStorageStackProps extends cdk.StackProps {
    stage: string;
    config: {
        domainName: string;
        enableAuth: boolean;
        enableCloudFront: boolean;
        enableBackup: boolean;
    };
    configTable: dynamodb.Table;
}
export declare class VjStorageStack extends cdk.Stack {
    readonly sessionTable: dynamodb.Table;
    readonly presetTable: dynamodb.Table;
    readonly presetBucket: s3.Bucket;
    readonly backupBucket?: s3.Bucket;
    constructor(scope: Construct, id: string, props: VjStorageStackProps);
}
