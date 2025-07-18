import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
export interface SecureLambdaRoleProps {
    stage: string;
    functionName: string;
    managedPolicies?: iam.IManagedPolicy[];
    inlinePolicies?: {
        [name: string]: iam.PolicyDocument;
    };
}
export declare class SecureLambdaRole extends Construct {
    readonly role: iam.Role;
    constructor(scope: Construct, id: string, props: SecureLambdaRoleProps);
}
export interface LambdaPolicyFactoryProps {
    region: string;
    accountId: string;
    stage: string;
}
export declare class LambdaPolicyFactory {
    private props;
    constructor(props: LambdaPolicyFactoryProps);
    createDynamoDBPolicy(tableArns: string[]): iam.PolicyDocument;
    createS3Policy(bucketArns: string[], readOnly?: boolean): iam.PolicyDocument;
    createSSMPolicy(parameterPaths: string[]): iam.PolicyDocument;
    createWebSocketPolicy(apiId: string): iam.PolicyDocument;
    createLogsPolicy(logGroupName: string): iam.PolicyDocument;
    createEventBridgePolicy(ruleName: string): iam.PolicyDocument;
}
