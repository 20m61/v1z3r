import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SecureLambdaRoleProps {
  stage: string;
  functionName: string;
  managedPolicies?: iam.IManagedPolicy[];
  inlinePolicies?: { [name: string]: iam.PolicyDocument };
}

export class SecureLambdaRole extends Construct {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: SecureLambdaRoleProps) {
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
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    // Add X-Ray tracing permissions if enabled
    if (stage !== 'dev') {
      this.role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
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

export interface LambdaPolicyFactoryProps {
  region: string;
  accountId: string;
  stage: string;
}

export class LambdaPolicyFactory {
  constructor(private props: LambdaPolicyFactoryProps) {}

  // DynamoDB table access policy
  public createDynamoDBPolicy(tableArns: string[]): iam.PolicyDocument {
    const statements: iam.PolicyStatement[] = [];

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
  public createS3Policy(bucketArns: string[], readOnly: boolean = false): iam.PolicyDocument {
    const statements: iam.PolicyStatement[] = [];

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
  public createSSMPolicy(parameterPaths: string[]): iam.PolicyDocument {
    const statements: iam.PolicyStatement[] = [];

    statements.push(new iam.PolicyStatement({
      sid: 'SSMReadAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: parameterPaths.map(path => 
        `arn:aws:ssm:${this.props.region}:${this.props.accountId}:parameter${path}`
      ),
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
  public createWebSocketPolicy(apiId: string): iam.PolicyDocument {
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
  public createLogsPolicy(logGroupName: string): iam.PolicyDocument {
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
  public createEventBridgePolicy(ruleName: string): iam.PolicyDocument {
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