import * as cdk from 'aws-cdk-lib';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface VjXRayStackProps extends cdk.StackProps {
  stage: string;
  lambdaFunctions: lambda.Function[];
}

export class VjXRayStack extends cdk.Stack {
  public readonly samplingRule: xray.CfnSamplingRule;

  constructor(scope: Construct, id: string, props: VjXRayStackProps) {
    super(scope, id, props);

    // カスタムサンプリングルール
    this.samplingRule = new xray.CfnSamplingRule(this, 'CustomSamplingRule', {
      samplingRule: {
        ruleName: `vj-app-sampling-${props.stage}`,
        priority: 10000,
        fixedRate: props.stage === 'prod' ? 0.1 : 0.5, // 本番環境では10%、その他は50%
        reservoirSize: 2,
        serviceName: 'vj-app',
        serviceType: 'AWS::Lambda::Function',
        host: '*',
        httpMethod: '*',
        urlPath: '*',
        version: 1,
        resourceArn: '*',
        attributes: {}
      }
    });

    // 高頻度エンドポイント用の低サンプリングルール
    const lowSamplingRule = new xray.CfnSamplingRule(this, 'LowSamplingRule', {
      samplingRule: {
        ruleName: `vj-app-low-sampling-${props.stage}`,
        priority: 5000,
        fixedRate: 0.01, // 1%のサンプリング
        reservoirSize: 1,
        serviceName: 'vj-app',
        serviceType: 'AWS::Lambda::Function',
        host: '*',
        httpMethod: 'GET',
        urlPath: '/health*',
        version: 1,
        resourceArn: '*',
        attributes: {}
      }
    });

    // Lambda関数にX-Rayトレーシングを有効化
    props.lambdaFunctions.forEach((func, index) => {
      // X-Rayトレーシング設定
      func.addEnvironment('_X_AMZN_TRACE_ID', 'Root=1-00000000-000000000000000000000000');
      func.addEnvironment('AWS_XRAY_TRACING_NAME', `vj-app-${props.stage}`);
      func.addEnvironment('AWS_XRAY_CONTEXT_MISSING', 'LOG_ERROR');

      // X-Ray権限を追加
      func.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
          'xray:GetSamplingStatisticSummaries'
        ],
        resources: ['*']
      }));

      // Lambda Insights有効化（パフォーマンス監視）
      const insightsLayer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        `LambdaInsightsLayer${index}`,
        `arn:aws:lambda:${this.region}:580247275435:layer:LambdaInsightsExtension:14`
      );
      
      func.addLayers(insightsLayer);
    });

    // X-Ray Service Map用のIAMロール
    const xrayServiceRole = new iam.Role(this, 'XRayServiceRole', {
      assumedBy: new iam.ServicePrincipal('xray.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayReadOnlyAccess')
      ]
    });

    // カスタムメトリクスのためのCloudWatch権限
    xrayServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics'
      ],
      resources: ['*']
    }));

    // Outputs
    new cdk.CfnOutput(this, 'XRayConsoleUrl', {
      value: `https://console.aws.amazon.com/xray/home?region=${this.region}#/service-map`,
      description: 'X-Ray Service Map Console URL'
    });

    new cdk.CfnOutput(this, 'XRayTracesUrl', {
      value: `https://console.aws.amazon.com/xray/home?region=${this.region}#/traces`,
      description: 'X-Ray Traces Console URL'
    });

    new cdk.CfnOutput(this, 'SamplingRuleArn', {
      value: this.samplingRule.attrRuleArn,
      description: 'X-Ray Sampling Rule ARN'
    });

    // Tags
    cdk.Tags.of(this).add('Application', 'v1z3r');
    cdk.Tags.of(this).add('Stage', props.stage);
  }
}