# Production Deployment Guide for v1z3r

## Current Status (2025-07-13)

### Completed Tasks
1. ✅ Fixed Lambda Runtime.ImportModuleError - Updated to AWS SDK v3
2. ✅ Created and validated SSL certificates for staging and production
3. ✅ Tested API functionality (health check and presets endpoints)
4. ✅ Configured monitoring metrics
5. ✅ DNS records created for staging.v1z3r.sc4pe.net

### Pending Issues
1. ❌ CloudFront S3 access permissions need fixing
2. ❌ Static hosting stack deployment failing due to IAM permissions

## Production Deployment Steps

### Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js 18+ installed
- CDK CLI installed (`npm install -g aws-cdk`)

### 1. Build Frontend Application
```bash
cd /home/ec2-user/workspace/v1z3r
yarn build
EXPORT_MODE=true yarn build
```

### 2. Deploy Infrastructure
```bash
cd infra/cdk
export CDK_DEFAULT_ACCOUNT=822063948773
export CDK_DEFAULT_REGION=ap-northeast-1

# Deploy all stacks in order
cdk deploy --all --context stage=prod --require-approval never
```

### 3. Upload Frontend Assets
```bash
# After infrastructure deployment
aws s3 sync /home/ec2-user/workspace/v1z3r/out/ s3://vj-frontend-prod-822063948773/ --delete
```

### 4. Create CloudFront Invalidation
```bash
# Get distribution ID from stack outputs
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name VjStaticHostingStack-prod --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)

# Invalidate cache
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

### 5. Update DNS Records
The production certificate ARN is: `arn:aws:acm:us-east-1:822063948773:certificate/7038c1fa-8b70-4822-ade0-a325dafffcd3`

DNS validation record has been created for certificate validation.

### 6. Post-Deployment Testing
```bash
# Test API endpoints
curl https://api.v1z3r.sc4pe.net/prod/health
curl https://api.v1z3r.sc4pe.net/prod/presets

# Test WebSocket connection
wscat -c wss://ws.v1z3r.sc4pe.net/prod

# Test frontend
curl -I https://v1z3r.sc4pe.net
```

## Configuration Updates Needed

### Lambda Functions
All Lambda functions have been updated to use AWS SDK v3. The following functions need the updated code:
- PresetFunction
- ConnectionFunction  
- MessageFunction

### Environment Variables
Production environment uses:
```javascript
{
  domainName: 'v1z3r.sc4pe.net',
  enableAuth: true,
  enableCloudFront: true,
  enableBackup: true,
}
```

## Known Issues and Workarounds

### CloudFront S3 Access
If CloudFront returns 403 errors:
1. Ensure S3 bucket has proper OAI permissions
2. Check that CloudFront origin is using S3 bucket (not website endpoint)
3. Verify index.html exists in S3 bucket root

### Lambda SDK Errors
All Lambda functions must use AWS SDK v3 packages:
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `@aws-sdk/client-apigatewaymanagementapi`

## Monitoring
Basic CloudWatch metrics are available:
- API Gateway: 4XX/5XX errors, latency
- Lambda: Errors, duration, throttles
- DynamoDB: Read/write capacity, errors

## Cost Optimization
- CloudFront logging disabled for non-production
- DynamoDB using on-demand billing
- Lambda functions sized appropriately (512MB)
- S3 lifecycle policies for old versions

## Security Considerations
- All APIs use HTTPS/WSS
- CloudFront configured with security headers
- S3 buckets private with OAI access only
- Secrets stored in AWS Secrets Manager

## Rollback Procedure
1. Update CloudFront origin to previous S3 version
2. Redeploy previous Lambda function code
3. Restore DynamoDB tables from backup (if enabled)

## Support Contacts
- Infrastructure: CDK deployment logs in CloudFormation
- Application logs: CloudWatch Logs
- Metrics: CloudWatch Metrics and Dashboards