import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VjApiStack } from './vj-api-stack';
import { VjStorageStack } from './vj-storage-stack';
import { VjStaticHostingStack } from './vj-static-hosting-stack';
import { VjCdnStack } from './vj-cdn-stack';
export interface VjMonitoringEnhancedStackProps extends cdk.StackProps {
    stage: string;
    apiStack: VjApiStack;
    storageStack: VjStorageStack;
    hostingStack: VjStaticHostingStack;
    cdnStack?: VjCdnStack;
    alarmEmail?: string;
}
export declare class VjMonitoringEnhancedStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: VjMonitoringEnhancedStackProps);
}
