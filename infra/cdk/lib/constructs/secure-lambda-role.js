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
exports.LambdaPolicyFactory = exports.SecureLambdaRole = void 0;
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cdk = __importStar(require("aws-cdk-lib"));
const constructs_1 = require("constructs");
class SecureLambdaRole extends constructs_1.Construct {
    role;
    constructor(scope, id, props) {
        super(scope, id);
        const { stage, functionName, managedPolicies = [], inlinePolicies = {} } = props;
        // Create role with minimal trust policy
        this.role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: `Execution role for ${functionName} Lambda function in ${stage}`,
            roleName: `${functionName}-${stage}-role`,
            maxSessionDuration: cdk.Duration.hours(1),
        });
        // Add basic Lambda execution policy
        this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        // Add X-Ray tracing permissions if enabled
        if (stage !== 'dev') {
            this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
        }
        // Add additional managed policies
        managedPolicies.forEach(policy => {
            this.role.addManagedPolicy(policy);
        });
        // Add inline policies
        Object.entries(inlinePolicies).forEach(([name, document]) => {
            this.role.attachInlinePolicy(new iam.Policy(this, name, {
                policyName: `${functionName}-${stage}-${name}`,
                document,
            }));
        });
        // Add resource tags
        cdk.Tags.of(this.role).add('Function', functionName);
        cdk.Tags.of(this.role).add('Stage', stage);
        cdk.Tags.of(this.role).add('SecurityLevel', 'minimal-permissions');
    }
}
exports.SecureLambdaRole = SecureLambdaRole;
class LambdaPolicyFactory {
    props;
    constructor(props) {
        this.props = props;
    }
    // DynamoDB table access policy
    createDynamoDBPolicy(tableArns) {
        const statements = [];
        // Read-only operations
        statements.push(new iam.PolicyStatement({
            sid: 'DynamoDBReadAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:DescribeTable',
                'dynamodb:DescribeTimeToLive',
            ],
            resources: [...tableArns, ...tableArns.map(arn => `${arn}/index/*`)],
        }));
        // Write operations (conditional)
        statements.push(new iam.PolicyStatement({
            sid: 'DynamoDBWriteAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:BatchWriteItem',
            ],
            resources: tableArns,
            conditions: {
                StringEquals: {
                    'dynamodb:LeadingKeys': ['${aws:RequestTag/userId}'],
                },
            },
        }));
        return new iam.PolicyDocument({ statements });
    }
    // S3 bucket access policy
    createS3Policy(bucketArns, readOnly = false) {
        const statements = [];
        // Read operations
        statements.push(new iam.PolicyStatement({
            sid: 'S3ReadAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:GetObjectVersion',
                's3:GetObjectMetadata',
                's3:GetObjectVersionMetadata',
                's3:ListBucket',
            ],
            resources: [
                ...bucketArns,
                ...bucketArns.map(arn => `${arn}/*`),
            ],
        }));
        // Write operations (if not read-only)
        if (!readOnly) {
            statements.push(new iam.PolicyStatement({
                sid: 'S3WriteAccess',
                effect: iam.Effect.ALLOW,
                actions: [
                    's3:PutObject',
                    's3:PutObjectAcl',
                    's3:DeleteObject',
                ],
                resources: bucketArns.map(arn => `${arn}/*`),
                conditions: {
                    StringLike: {
                        's3:x-amz-server-side-encryption': 'AES256',
                    },
                },
            }));
        }
        return new iam.PolicyDocument({ statements });
    }
    // SSM Parameter Store access policy
    createSSMPolicy(parameterPaths) {
        const statements = [];
        statements.push(new iam.PolicyStatement({
            sid: 'SSMReadAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
            ],
            resources: parameterPaths.map(path => `arn:aws:ssm:${this.props.region}:${this.props.accountId}:parameter${path}`),
        }));
        // KMS decrypt for SecureString parameters
        statements.push(new iam.PolicyStatement({
            sid: 'KMSDecryptAccess',
            effect: iam.Effect.ALLOW,
            actions: ['kms:Decrypt'],
            resources: [`arn:aws:kms:${this.props.region}:${this.props.accountId}:key/*`],
            conditions: {
                StringEquals: {
                    'kms:ViaService': `ssm.${this.props.region}.amazonaws.com`,
                },
            },
        }));
        return new iam.PolicyDocument({ statements });
    }
    // API Gateway management policy for WebSocket
    createWebSocketPolicy(apiId) {
        return new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: 'WebSocketManagement',
                    effect: iam.Effect.ALLOW,
                    actions: ['execute-api:ManageConnections'],
                    resources: [
                        `arn:aws:execute-api:${this.props.region}:${this.props.accountId}:${apiId}/${this.props.stage}/*`,
                    ],
                }),
            ],
        });
    }
    // CloudWatch Logs policy (minimal)
    createLogsPolicy(logGroupName) {
        return new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: 'CloudWatchLogsAccess',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'logs:CreateLogStream',
                        'logs:PutLogEvents',
                    ],
                    resources: [
                        `arn:aws:logs:${this.props.region}:${this.props.accountId}:log-group:${logGroupName}:*`,
                    ],
                }),
            ],
        });
    }
    // EventBridge policy for scheduled functions
    createEventBridgePolicy(ruleName) {
        return new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: 'EventBridgeAccess',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'events:PutEvents',
                    ],
                    resources: [
                        `arn:aws:events:${this.props.region}:${this.props.accountId}:event-bus/default`,
                    ],
                    conditions: {
                        StringEquals: {
                            'events:detail-type': [`${ruleName}-event`],
                        },
                    },
                }),
            ],
        });
    }
}
exports.LambdaPolicyFactory = LambdaPolicyFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJlLWxhbWJkYS1yb2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VjdXJlLWxhbWJkYS1yb2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEseURBQTJDO0FBQzNDLGlEQUFtQztBQUNuQywyQ0FBdUM7QUFTdkMsTUFBYSxnQkFBaUIsU0FBUSxzQkFBUztJQUM3QixJQUFJLENBQVc7SUFFL0IsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLGVBQWUsR0FBRyxFQUFFLEVBQUUsY0FBYyxHQUFHLEVBQUUsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVqRix3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRTtZQUNyQyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsV0FBVyxFQUFFLHNCQUFzQixZQUFZLHVCQUF1QixLQUFLLEVBQUU7WUFDN0UsUUFBUSxFQUFFLEdBQUcsWUFBWSxJQUFJLEtBQUssT0FBTztZQUN6QyxrQkFBa0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsb0NBQW9DO1FBQ3BDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQ3hCLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUMsQ0FDdkYsQ0FBQztRQUVGLDJDQUEyQztRQUMzQyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FDeEIsR0FBRyxDQUFDLGFBQWEs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aEY7b0JBQ0QsVUFBVSxFQUFFO3dCQUNWLFlBQVksRUFBRTs0QkFDWixvQkFBb0IsRUFBRSxDQUFDLEdBQUcsUUFBUSxRQUFRLENBQUM7eUJBQzVDO3FCQUNGO2lCQUNGLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWhMRCxrREFnTEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJlTGFtYmRhUm9sZVByb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgZnVuY3Rpb25OYW1lOiBzdHJpbmc7XG4gIG1hbmFnZWRQb2xpY2llcz86IGlhbS5JTWFuYWdlZFBvbGljeVtdO1xuICBpbmxpbmVQb2xpY2llcz86IHsgW25hbWU6IHN0cmluZ106IGlhbS5Qb2xpY3lEb2N1bWVudCB9O1xufVxuXG5leHBvcnQgY2xhc3MgU2VjdXJlTGFtYmRhUm9sZSBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSByb2xlOiBpYW0uUm9sZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VjdXJlTGFtYmRhUm9sZVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGZ1bmN0aW9uTmFtZSwgbWFuYWdlZFBvbGljaWVzID0gW10sIGlubGluZVBvbGljaWVzID0ge30gfSA9IHByb3BzO1xuXG4gICAgLy8gQ3JlYXRlIHJvbGUgd2l0aCBtaW5pbWFsIHRydXN0IHBvbGljeVxuICAgIHRoaXMucm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246IGBFeGVjdXRpb24gcm9sZSBmb3IgJHtmdW5jdGlvbk5hbWV9IExhbWJkYSBmdW5jdGlvbiBpbiAke3N0YWdlfWAsXG4gICAgICByb2xlTmFtZTogYCR7ZnVuY3Rpb25OYW1lfS0ke3N0YWdlfS1yb2xlYCxcbiAgICAgIG1heFNlc3Npb25EdXJhdGlvbjogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGJhc2ljIExhbWJkYSBleGVjdXRpb24gcG9saWN5XG4gICAgdGhpcy5yb2xlLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKVxuICAgICk7XG5cbiAgICAvLyBBZGQgWC1SYXkgdHJhY2luZyBwZXJtaXNzaW9ucyBpZiBlbmFibGVkXG4gICAgaWYgKHN0YWdlICE9PSAnZGV2Jykge1xuICAgICAgdGhpcy5yb2xlLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQVdTWFJheURhZW1vbldyaXRlQWNjZXNzJylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFkZGl0aW9uYWwgbWFuYWdlZCBwb2xpY2llc1xuICAgIG1hbmFnZWRQb2xpY2llcy5mb3JFYWNoKHBvbGljeSA9PiB7XG4gICAgICB0aGlzLnJvbGUuYWRkTWFuYWdlZFBvbGljeShwb2xpY3kpO1xuICAgIH0pO1xuXG4gICAgLy8gQWRkIGlubGluZSBwb2xpY2llc1xuICAgIE9iamVjdC5lbnRyaWVzKGlubGluZVBvbGljaWVzKS5mb3JFYWNoKChbbmFtZSwgZG9jdW1lbnRdKSA9PiB7XG4gICAgICB0aGlzLnJvbGUuYXR0YWNoSW5saW5lUG9saWN5KG5ldyBpYW0uUG9saWN5KHRoaXMsIG5hbWUsIHtcbiAgICAgICAgcG9saWN5TmFtZTogYCR7ZnVuY3Rpb25OYW1lfS0ke3N0YWdlfS0ke25hbWV9YCxcbiAgICAgICAgZG9jdW1lbnQsXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgcmVzb3VyY2UgdGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMucm9sZSkuYWRkKCdGdW5jdGlvbicsIGZ1bmN0aW9uTmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5yb2xlKS5hZGQoJ1N0YWdlJywgc3RhZ2UpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMucm9sZSkuYWRkKCdTZWN1cml0eUxldmVsJywgJ21pbmltYWwtcGVybWlzc2lvbnMnKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIExhbWJkYVBvbGljeUZhY3RvcnlQcm9wcyB7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBhY2NvdW50SWQ6IHN0cmluZztcbiAgc3RhZ2U6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIExhbWJkYVBvbGljeUZhY3Rvcnkge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHByb3BzOiBMYW1iZGFQb2xpY3lGYWN0b3J5UHJvcHMpIHt9XG5cbiAgLy8gRHluYW1vREIgdGFibGUgYWNjZXNzIHBvbGljeVxuICBwdWJsaWMgY3JlYXRlRHluYW1vREJQb2xpY3kodGFibGVBcm5zOiBzdHJpbmdbXSk6IGlhbS5Qb2xpY3lEb2N1bWVudCB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogaWFtLlBvbGljeVN0YXRlbWVudFtdID0gW107XG5cbiAgICAvLyBSZWFkLW9ubHkgb3BlcmF0aW9uc1xuICAgIHN0YXRlbWVudHMucHVzaChuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBzaWQ6ICdEeW5hbW9EQlJlYWRBY2Nlc3MnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgJ2R5bmFtb2RiOkJhdGNoR2V0SXRlbScsXG4gICAgICAgICdkeW5hbW9kYjpEZXNjcmliZVRhYmxlJyxcbiAgICAgICAgJ2R5bmFtb2RiOkRlc2NyaWJlVGltZVRvTGl2ZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbLi4udGFibGVBcm5zLCAuLi50YWJsZUFybnMubWFwKGFybiA9PiBgJHthcm59L2luZGV4LypgKV0sXG4gICAgfSkpO1xuXG4gICAgLy8gV3JpdGUgb3BlcmF0aW9ucyAoY29uZGl0aW9uYWwpXG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ0R5bmFtb0RCV3JpdGVBY2Nlc3MnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAnZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW0nLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogdGFibGVBcm5zLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnZHluYW1vZGI6TGVhZGluZ0tleXMnOiBbJyR7YXdzOlJlcXVlc3RUYWcvdXNlcklkfSddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7IHN0YXRlbWVudHMgfSk7XG4gIH1cblxuICAvLyBTMyBidWNrZXQgYWNjZXNzIHBvbGljeVxuICBwdWJsaWMgY3JlYXRlUzNQb2xpY3koYnVja2V0QXJuczogc3RyaW5nW10sIHJlYWRPbmx5OiBib29sZWFuID0gZmFsc2UpOiBpYW0uUG9saWN5RG9jdW1lbnQge1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IGlhbS5Qb2xpY3lTdGF0ZW1lbnRbXSA9IFtdO1xuXG4gICAgLy8gUmVhZCBvcGVyYXRpb25zXG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ1MzUmVhZEFjY2VzcycsXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAnczM6R2V0T2JqZWN0VmVyc2lvbicsXG4gICAgICAgICdzMzpHZXRPYmplY3RNZXRhZGF0YScsXG4gICAgICAgICdzMzpHZXRPYmplY3RWZXJzaW9uTWV0YWRhdGEnLFxuICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIC4uLmJ1Y2tldEFybnMsXG4gICAgICAgIC4uLmJ1Y2tldEFybnMubWFwKGFybiA9PiBgJHthcm59LypgKSxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gV3JpdGUgb3BlcmF0aW9ucyAoaWYgbm90IHJlYWQtb25seSlcbiAgICBpZiAoIXJlYWRPbmx5KSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBzaWQ6ICdTM1dyaXRlQWNjZXNzJyxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgJ3MzOlB1dE9iamVjdEFjbCcsXG4gICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogYnVja2V0QXJucy5tYXAoYXJuID0+IGAke2Fybn0vKmApLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgU3RyaW5nTGlrZToge1xuICAgICAgICAgICAgJ3MzOngtYW16LXNlcnZlci1zaWRlLWVuY3J5cHRpb24nOiAnQUVTMjU2JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHsgc3RhdGVtZW50cyB9KTtcbiAgfVxuXG4gIC8vIFNTTSBQYXJhbWV0ZXIgU3RvcmUgYWNjZXNzIHBvbGljeVxuICBwdWJsaWMgY3JlYXRlU1NNUG9saWN5KHBhcmFtZXRlclBhdGhzOiBzdHJpbmdbXSk6IGlhbS5Qb2xpY3lEb2N1bWVudCB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogaWFtLlBvbGljeVN0YXRlbWVudFtdID0gW107XG5cbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgc2lkOiAnU1NNUmVhZEFjY2VzcycsXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzQnlQYXRoJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IHBhcmFtZXRlclBhdGhzLm1hcChwYXRoID0+IFxuICAgICAgICBgYXJuOmF3czpzc206JHt0aGlzLnByb3BzLnJlZ2lvbn06JHt0aGlzLnByb3BzLmFjY291bnRJZH06cGFyYW1ldGVyJHtwYXRofWBcbiAgICAgICksXG4gICAgfSkpO1xuXG4gICAgLy8gS01TIGRlY3J5cHQgZm9yIFNlY3VyZVN0cmluZyBwYXJhbWV0ZXJzXG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ0tNU0RlY3J5cHRBY2Nlc3MnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydrbXM6RGVjcnlwdCddLFxuICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6a21zOiR7dGhpcy5wcm9wcy5yZWdpb259OiR7dGhpcy5wcm9wcy5hY2NvdW50SWR9OmtleS8qYF0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdrbXM6VmlhU2VydmljZSc6IGBzc20uJHt0aGlzLnByb3BzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbWAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pKTtcblxuICAgIHJldHVybiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHsgc3RhdGVtZW50cyB9KTtcbiAgfVxuXG4gIC8vIEFQSSBHYXRld2F5IG1hbmFnZW1lbnQgcG9saWN5IGZvciBXZWJTb2NrZXRcbiAgcHVibGljIGNyZWF0ZVdlYlNvY2tldFBvbGljeShhcGlJZDogc3RyaW5nKTogaWFtLlBvbGljeURvY3VtZW50IHtcbiAgICByZXR1cm4gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBzaWQ6ICdXZWJTb2NrZXRNYW5hZ2VtZW50JyxcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnByb3BzLnJlZ2lvbn06JHt0aGlzLnByb3BzLmFjY291bnRJZH06JHthcGlJZH0vJHt0aGlzLnByb3BzLnN0YWdlfS8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICAvLyBDbG91ZFdhdGNoIExvZ3MgcG9saWN5IChtaW5pbWFsKVxuICBwdWJsaWMgY3JlYXRlTG9nc1BvbGljeShsb2dHcm91cE5hbWU6IHN0cmluZyk6IGlhbS5Qb2xpY3lEb2N1bWVudCB7XG4gICAgcmV0dXJuIG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgc2lkOiAnQ2xvdWRXYXRjaExvZ3NBY2Nlc3MnLFxuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucHJvcHMucmVnaW9ufToke3RoaXMucHJvcHMuYWNjb3VudElkfTpsb2ctZ3JvdXA6JHtsb2dHcm91cE5hbWV9OipgLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEV2ZW50QnJpZGdlIHBvbGljeSBmb3Igc2NoZWR1bGVkIGZ1bmN0aW9uc1xuICBwdWJsaWMgY3JlYXRlRXZlbnRCcmlkZ2VQb2xpY3kocnVsZU5hbWU6IHN0cmluZyk6IGlhbS5Qb2xpY3lEb2N1bWVudCB7XG4gICAgcmV0dXJuIG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgc2lkOiAnRXZlbnRCcmlkZ2VBY2Nlc3MnLFxuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnZXZlbnRzOlB1dEV2ZW50cycsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgIGBhcm46YXdzOmV2ZW50czoke3RoaXMucHJvcHMucmVnaW9ufToke3RoaXMucHJvcHMuYWNjb3VudElkfTpldmVudC1idXMvZGVmYXVsdGAsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgICAgJ2V2ZW50czpkZXRhaWwtdHlwZSc6IFtgJHtydWxlTmFtZX0tZXZlbnRgXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG59Il19