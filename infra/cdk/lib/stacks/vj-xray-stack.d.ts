import * as cdk from 'aws-cdk-lib';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
export interface VjXRayStackProps extends cdk.StackProps {
    stage: string;
    lambdaFunctions: lambda.Function[];
}
export declare class VjXRayStack extends cdk.Stack {
    readonly samplingRule: xray.CfnSamplingRule;
    constructor(scope: Construct, id: string, props: VjXRayStackProps);
}
