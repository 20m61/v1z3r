# AWS CloudFormation Stack Cleanup Instructions

## Overview
This document provides instructions for cleaning up AWS CloudFormation stacks created during v1z3r development.

## Prerequisites
- AWS CLI installed and configured
- AWS profile named 'dev' with appropriate permissions
- Access to AWS Console for verification

## Automated Cleanup

Run the cleanup script:
```bash
./scripts/cleanup-aws-stacks.sh
```

This script will:
1. List all v1z3r-related CloudFormation stacks
2. Ask for confirmation before deletion
3. Empty S3 buckets before stack deletion
4. Delete stacks in the correct dependency order
5. Wait for each deletion to complete

## Manual Cleanup (if script fails)

### 1. List Existing Stacks
```bash
aws cloudformation list-stacks --profile dev \
  --query "StackSummaries[?contains(StackName, 'vj-') && StackStatus!='DELETE_COMPLETE'].[StackName,StackStatus]" \
  --output table
```

### 2. Delete Stacks in Order
Delete in this order to respect dependencies:

```bash
# Logging stacks (no dependencies)
aws cloudformation delete-stack --stack-name vj-logging-stack-dev --profile dev
aws cloudformation delete-stack --stack-name vj-logging-stack-staging --profile dev
aws cloudformation delete-stack --stack-name vj-logging-stack-prod --profile dev

# Auth stacks
aws cloudformation delete-stack --stack-name vj-auth-stack-dev --profile dev
aws cloudformation delete-stack --stack-name vj-auth-stack-staging --profile dev
aws cloudformation delete-stack --stack-name vj-auth-stack-prod --profile dev

# App stacks
aws cloudformation delete-stack --stack-name vj-app-stack-dev --profile dev
aws cloudformation delete-stack --stack-name vj-app-stack-staging --profile dev
aws cloudformation delete-stack --stack-name vj-app-stack-prod --profile dev

# Storage stacks (empty S3 buckets first!)
aws cloudformation delete-stack --stack-name vj-storage-stack-dev --profile dev
aws cloudformation delete-stack --stack-name vj-storage-stack-staging --profile dev
aws cloudformation delete-stack --stack-name vj-storage-stack-prod --profile dev

# Network stacks (delete last)
aws cloudformation delete-stack --stack-name vj-network-stack-dev --profile dev
aws cloudformation delete-stack --stack-name vj-network-stack-staging --profile dev
aws cloudformation delete-stack --stack-name vj-network-stack-prod --profile dev
```

### 3. Empty S3 Buckets Before Storage Stack Deletion
```bash
# List buckets in storage stack
aws cloudformation describe-stack-resources --profile dev \
  --stack-name vj-storage-stack-dev \
  --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId"

# Empty each bucket
aws s3 rm s3://BUCKET_NAME --recursive --profile dev
```

### 4. Check for Failed Deletions
```bash
aws cloudformation describe-stacks --profile dev \
  --query "Stacks[?contains(StackName, 'vj-') && StackStatus=='DELETE_FAILED'].[StackName,StackStatusReason]"
```

## Resources That May Be Retained

Some resources are retained by default:
- CloudWatch Log Groups (retained for audit)
- S3 buckets with versioning enabled
- Cognito User Pools (if they contain users)

To remove these manually:
```bash
# CloudWatch Logs
aws logs delete-log-group --log-group-name /aws/vj-app/dev --profile dev

# S3 Buckets (after emptying)
aws s3api delete-bucket --bucket BUCKET_NAME --profile dev
```

## Verification

After cleanup, verify no resources remain:
1. Check CloudFormation console
2. Check S3 buckets
3. Check Lambda functions
4. Check API Gateway
5. Check Cognito User Pools
6. Check DynamoDB tables
7. Check CloudWatch Logs

## Cost Considerations

Deleting these resources will stop any associated charges:
- Lambda invocations
- API Gateway requests
- S3 storage
- DynamoDB read/write capacity
- CloudWatch Logs ingestion
- Cognito MAU (Monthly Active Users)

## Important Notes

⚠️ **Warning**: This will permanently delete all resources and data. Make sure to:
- Backup any important data before deletion
- Confirm you're in the correct AWS account
- Use the correct profile (dev/staging/prod)

## Troubleshooting

### Stack DELETE_FAILED Status
1. Check stack events for specific error
2. Manually delete the blocking resource
3. Retry stack deletion

### S3 Bucket Not Empty Error
1. Empty bucket with versioning:
   ```bash
   aws s3api delete-objects --bucket BUCKET_NAME --profile dev \
     --delete "$(aws s3api list-object-versions --bucket BUCKET_NAME --profile dev \
     --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')"
   ```

### Permission Errors
Ensure your AWS profile has permissions for:
- cloudformation:DeleteStack
- s3:DeleteBucket
- s3:DeleteObject
- iam:DeleteRole
- lambda:DeleteFunction
- etc.