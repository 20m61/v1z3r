# AWS Authentication Setup Guide

This guide explains how to configure AWS authentication for deploying the v1z3r application.

## Prerequisites

- AWS CLI installed (`aws --version`)
- AWS account with appropriate permissions
- Access to AWS IAM console

## Setting Up AWS Profiles

### 1. Configure Development Profile

```bash
aws configure --profile dev
```

Enter the following when prompted:
- **AWS Access Key ID**: Your development access key
- **AWS Secret Access Key**: Your development secret key
- **Default region name**: us-east-1 (or your preferred region)
- **Default output format**: json

### 2. Configure Staging Profile

```bash
aws configure --profile staging
```

### 3. Configure Production Profile

```bash
aws configure --profile prod
```

## Required IAM Permissions

Create an IAM policy with the following permissions for CDK deployment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "apigateway:*",
        "logs:*",
        "iam:*",
        "cloudwatch:*",
        "route53:*",
        "acm:*",
        "cloudfront:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=dev

# CDK Configuration
CDK_DEFAULT_ACCOUNT=your-aws-account-id
CDK_DEFAULT_REGION=us-east-1
```

## CDK Bootstrap

Before first deployment, bootstrap your AWS environment:

```bash
cd infra/cdk
cdk bootstrap --profile dev
cdk bootstrap --profile staging
cdk bootstrap --profile prod
```

## Deployment Commands

### Development Environment
```bash
yarn infra:dev
# or
cd infra/cdk && cdk deploy --all --profile dev
```

### Staging Environment
```bash
yarn infra:staging
# or
cd infra/cdk && cdk deploy --all --profile staging
```

### Production Environment
```bash
yarn infra:prod
# or
cd infra/cdk && cdk deploy --all --profile prod
```

## Verifying Configuration

Test your AWS profile configuration:

```bash
aws sts get-caller-identity --profile dev
```

This should return your AWS account information:
```json
{
    "UserId": "AIDAI23456789EXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

## Troubleshooting

### Profile Not Found Error
```bash
The config profile (dev) could not be found
```
**Solution**: Run `aws configure --profile dev` to create the profile.

### Permission Denied Error
```bash
User: arn:aws:iam::123456789012:user/your-username is not authorized to perform: cloudformation:CreateStack
```
**Solution**: Ensure your IAM user has the necessary permissions listed above.

### Region Not Specified
```bash
Unable to determine the default AWS account
```
**Solution**: Set the `AWS_REGION` environment variable or specify it in your AWS profile.

## Security Best Practices

1. **Never commit AWS credentials** to version control
2. Use **IAM roles** for production deployments
3. Enable **MFA** for AWS accounts
4. Rotate access keys regularly
5. Use **least privilege principle** for IAM permissions

## CI/CD Configuration

For GitHub Actions, add the following secrets:

1. Go to Settings → Secrets → Actions
2. Add these secrets:
   - `AWS_ACCESS_KEY_ID_DEV`
   - `AWS_SECRET_ACCESS_KEY_DEV`
   - `AWS_ACCESS_KEY_ID_STAGING`
   - `AWS_SECRET_ACCESS_KEY_STAGING`
   - `AWS_ACCESS_KEY_ID_PROD`
   - `AWS_SECRET_ACCESS_KEY_PROD`

## Next Steps

After configuring AWS authentication:

1. Bootstrap CDK environment: `cdk bootstrap --profile dev`
2. Deploy infrastructure: `yarn infra:dev`
3. Verify deployment in AWS Console
4. Configure domain names if needed (see `infra/cdk/README_DOMAIN_SETUP.md`)