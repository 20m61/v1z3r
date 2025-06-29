import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { VjApiStack } from './vj-api-stack';
import { VjStorageStack } from './vj-storage-stack';
import { VjStaticHostingStack } from './vj-static-hosting-stack';
export interface VjMonitoringStackProps extends cdk.StackProps {
    stage: string;
    config: {
        domainName: string;
        enableAuth: boolean;
        enableCloudFront: boolean;
        enableBackup: boolean;
    };
    apiStack: VjApiStack;
    storageStack: VjStorageStack;
    hostingStack: VjStaticHostingStack;
}
export declare class VjMonitoringStack extends cdk.Stack {
    readonly dashboard: cloudwatch.Dashboard;
    readonly alertTopic: sns.Topic;
    constructor(scope: Construct, id: string, props: VjMonitoringStackProps);
}
