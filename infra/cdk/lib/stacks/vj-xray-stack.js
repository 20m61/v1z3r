"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VjXRayStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const xray = __importStar(require("aws-cdk-lib/aws-xray"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class VjXRayStack extends cdk.Stack {
    samplingRule;
    constructor(scope, id, props) {
        super(scope, id, props);
        // カスタムサンプリングルール
        this.samplingRule = new xray.CfnSamplingRule(this, 'CustomSamplingRule', {
            samplingRule: {
                ruleName: `vj-app-sampling-${props.stage}`,
                priority: 10000,
                fixedRate: props.stage === 'prod' ? 0.1 : 0.5,
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
                fixedRate: 0.01,
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
            const insightsLayer = lambda.LayerVersion.fromLayerVersionArn(this, `LambdaInsightsLayer${index}`, `arn:aws:lambda:${this.region}:580247275435:layer:LambdaInsightsExtension:14`);
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
exports.VjXRayStack = VjXRayStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmoteHJheS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZqLXhyYXktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsMkRBQTZDO0FBQzdDLHlEQUEyQztBQUMzQywrREFBaUQ7QUFRakQsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEIsWUFBWSxDQUF1QjtJQUVuRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDdkUsWUFBWSxFQUFFO2dCQUNaLFFBQVEsRUFBRSxtQkFBbUIsS0FBSyxDQUFDLEtBQUssRUFBRTtnQkFDMUMsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsU0FBUyxFQUFFLEtBQUssQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUc7Z0JBQzdDLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixXQUFXLEVBQUUsUUFBUTtnQkFDckIsV0FBVyxFQUFFLHVCQUF1QjtnQkFDcEMsSUFBSSxFQUFFLEdBQUc7Z0JBQ1QsVUFBVSxFQUFFLEdBQUc7Z0JBQ2YsT0FBTyxFQUFFLEdBQUc7Z0JBQ1osT0FBTyxFQUFFLENBQUM7Z0JBQ1YsV0FBVyxFQUFFLEdBQUc7Z0JBQ2hCLFVBQVUsRUFBRSxFQUFFO2FBQ2Y7U0FDRixDQUFDLENBQUM7UUFFSCx5QkFBeUI7UUFDekIsTUFBTSxlQUFlLEdBQUcsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN4RSxZQUFZLEVBQUU7Z0JBQ1osUUFBUSxF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Q0FBQyxZQUFZLENBQUMsV0FBVztZQUNwQyxXQUFXLEVBQUUseUJBQXlCO1NBQ3ZDLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzlDLENBQUM7Q0FDRjtBQS9HRCxrQ0ErR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgeHJheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MteHJheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBWalhSYXlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdO1xufVxuXG5leHBvcnQgY2xhc3MgVmpYUmF5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgc2FtcGxpbmdSdWxlOiB4cmF5LkNmblNhbXBsaW5nUnVsZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpYUmF5U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g44Kr44K544K/44Og44K144Oz44OX44Oq44Oz44Kw44Or44O844OrXG4gICAgdGhpcy5zYW1wbGluZ1J1bGUgPSBuZXcgeHJheS5DZm5TYW1wbGluZ1J1bGUodGhpcywgJ0N1c3RvbVNhbXBsaW5nUnVsZScsIHtcbiAgICAgIHNhbXBsaW5nUnVsZToge1xuICAgICAgICBydWxlTmFtZTogYHZqLWFwcC1zYW1wbGluZy0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICAgIHByaW9yaXR5OiAxMDAwMCxcbiAgICAgICAgZml4ZWRSYXRlOiBwcm9wcy5zdGFnZSA9PT0gJ3Byb2QnID8gMC4xIDogMC41LCAvLyDmnKznlarnkrDlooPjgafjga8xMCXjgIHjgZ3jga7ku5bjga81MCVcbiAgICAgICAgcmVzZXJ2b2lyU2l6ZTogMixcbiAgICAgICAgc2VydmljZU5hbWU6ICd2ai1hcHAnLFxuICAgICAgICBzZXJ2aWNlVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgIGhvc3Q6ICcqJyxcbiAgICAgICAgaHR0cE1ldGhvZDogJyonLFxuICAgICAgICB1cmxQYXRoOiAnKicsXG4gICAgICAgIHZlcnNpb246IDEsXG4gICAgICAgIHJlc291cmNlQXJuOiAnKicsXG4gICAgICAgIGF0dHJpYnV0ZXM6IHt9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDpq5jpoLvluqbjgqjjg7Pjg4njg53jgqTjg7Pjg4jnlKjjga7kvY7jgrXjg7Pjg5fjg6rjg7PjgrDjg6vjg7zjg6tcbiAgICBjb25zdCBsb3dTYW1wbGluZ1J1bGUgPSBuZXcgeHJheS5DZm5TYW1wbGluZ1J1bGUodGhpcywgJ0xvd1NhbXBsaW5nUnVsZScsIHtcbiAgICAgIHNhbXBsaW5nUnVsZToge1xuICAgICAgICBydWxlTmFtZTogYHZqLWFwcC1sb3ctc2FtcGxpbmctJHtwcm9wcy5zdGFnZX1gLFxuICAgICAgICBwcmlvcml0eTogNTAwMCxcbiAgICAgICAgZml4ZWRSYXRlOiAwLjAxLCAvLyAxJeOBruOCteODs+ODl+ODquODs+OCsFxuICAgICAgICByZXNlcnZvaXJTaXplOiAxLFxuICAgICAgICBzZXJ2aWNlTmFtZTogJ3ZqLWFwcCcsXG4gICAgICAgIHNlcnZpY2VUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgaG9zdDogJyonLFxuICAgICAgICBodHRwTWV0aG9kOiAnR0VUJyxcbiAgICAgICAgdXJsUGF0aDogJy9oZWFsdGgqJyxcbiAgICAgICAgdmVyc2lvbjogMSxcbiAgICAgICAgcmVzb3VyY2VBcm46ICcqJyxcbiAgICAgICAgYXR0cmlidXRlczoge31cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYemWouaVsOOBq1gtUmF544OI44Os44O844K344Oz44Kw44KS5pyJ5Yq55YyWXG4gICAgcHJvcHMubGFtYmRhRnVuY3Rpb25zLmZvckVhY2goKGZ1bmMsIGluZGV4KSA9PiB7XG4gICAgICAvLyBYLVJheeODiOODrOODvOOCt+ODs+OCsOioreWumlxuICAgICAgZnVuYy5hZGRFbnZpcm9ubWVudCgnX1hfQU1aTl9UUkFDRV9JRCcsICdSb290PTEtMDAwMDAwMDAtMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJyk7XG4gICAgICBmdW5jLmFkZEVudmlyb25tZW50KCdBV1NfWFJBWV9UUkFDSU5HX05BTUUnLCBgdmotYXBwLSR7cHJvcHMuc3RhZ2V9YCk7XG4gICAgICBmdW5jLmFkZEVudmlyb25tZW50KCdBV1NfWFJBWV9DT05URVhUX01JU1NJTkcnLCAnTE9HX0VSUk9SJyk7XG5cbiAgICAgIC8vIFgtUmF55qip6ZmQ44KS6L+95YqgXG4gICAgICBmdW5jLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICd4cmF5OlB1dFRyYWNlU2VnbWVudHMnLFxuICAgICAgICAgICd4cmF5OlB1dFRlbGVtZXRyeVJlY29yZHMnLFxuICAgICAgICAgICd4cmF5OkdldFNhbXBsaW5nUnVsZXMnLFxuICAgICAgICAgICd4cmF5OkdldFNhbXBsaW5nVGFyZ2V0cycsXG4gICAgICAgICAgJ3hyYXk6R2V0U2FtcGxpbmdTdGF0aXN0aWNTdW1tYXJpZXMnXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgIH0pKTtcblxuICAgICAgLy8gTGFtYmRhIEluc2lnaHRz5pyJ5Yq55YyW77yI44OR44OV44Kp44O844Oe44Oz44K555uj6KaW77yJXG4gICAgICBjb25zdCBpbnNpZ2h0c0xheWVyID0gbGFtYmRhLkxheWVyVmVyc2lvbi5mcm9tTGF5ZXJWZXJzaW9uQXJuKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgTGFtYmRhSW5zaWdodHNMYXllciR7aW5kZXh9YCxcbiAgICAgICAgYGFybjphd3M6bGFtYmRhOiR7dGhpcy5yZWdpb259OjU4MDI0NzI3NTQzNTpsYXllcjpMYW1iZGFJbnNpZ2h0c0V4dGVuc2lvbjoxNGBcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGZ1bmMuYWRkTGF5ZXJzKGluc2lnaHRzTGF5ZXIpO1xuICAgIH0pO1xuXG4gICAgLy8gWC1SYXkgU2VydmljZSBNYXDnlKjjga5JQU3jg63jg7zjg6tcbiAgICBjb25zdCB4cmF5U2VydmljZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1hSYXlTZXJ2aWNlUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCd4cmF5LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FXU1hSYXlSZWFkT25seUFjY2VzcycpXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyDjgqvjgrnjgr/jg6Djg6Hjg4jjg6rjgq/jgrnjga7jgZ/jgoHjga5DbG91ZFdhdGNo5qip6ZmQXG4gICAgeHJheVNlcnZpY2VSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YScsXG4gICAgICAgICdjbG91ZHdhdGNoOkdldE1ldHJpY1N0YXRpc3RpY3MnLFxuICAgICAgICAnY2xvdWR3YXRjaDpMaXN0TWV0cmljcydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdYUmF5Q29uc29sZVVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL3hyYXkvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jL3NlcnZpY2UtbWFwYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnWC1SYXkgU2VydmljZSBNYXAgQ29uc29sZSBVUkwnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnWFJheVRyYWNlc1VybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL3hyYXkvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jL3RyYWNlc2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1gtUmF5IFRyYWNlcyBDb25zb2xlIFVSTCdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTYW1wbGluZ1J1bGVBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zYW1wbGluZ1J1bGUuYXR0clJ1bGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1gtUmF5IFNhbXBsaW5nIFJ1bGUgQVJOJ1xuICAgIH0pO1xuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXBwbGljYXRpb24nLCAndjF6M3InKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWdlJywgcHJvcHMuc3RhZ2UpO1xuICB9XG59Il19