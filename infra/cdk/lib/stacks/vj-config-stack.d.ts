import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface VjConfigStackProps extends cdk.StackProps {
    stage: string;
    config: {
        domainName: string;
        enableAuth: boolean;
        enableCloudFront: boolean;
        enableBackup: boolean;
    };
}
export declare class VjConfigStack extends cdk.Stack {
    readonly configTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: VjConfigStackProps);
}
