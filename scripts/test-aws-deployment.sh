#!/bin/bash

# V1Z3R AWS Deployment Testing Script
# This script tests AWS infrastructure and deployed services

set -e

echo "☁️  Starting AWS deployment testing for V1Z3R..."

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed."; exit 1; }

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_PREFIX="${STACK_PREFIX:-Vj}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

echo "🎯 Testing AWS environment: $ENVIRONMENT"
echo "🌍 AWS Region: $AWS_REGION"

# AWS CLI check is already done in prerequisites

# Test 1: Check CloudFormation Stacks
echo "📋 Testing CloudFormation stacks..."
STACKS=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --region $AWS_REGION --query 'StackSummaries[?contains(StackName, `'$STACK_PREFIX'`)].StackName' --output text)

if [ -z "$STACKS" ]; then
    echo "❌ No CloudFormation stacks found with prefix: $STACK_PREFIX"
    exit 1
else
    echo "✅ Found CloudFormation stacks:"
    echo "$STACKS" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 2: Check S3 Buckets
echo "🪣 Testing S3 buckets..."
S3_BUCKETS=$(aws s3 ls | grep -i v1z3r || echo "")
if [ -z "$S3_BUCKETS" ]; then
    echo "⚠️  No S3 buckets found with 'v1z3r' in name"
else
    echo "✅ Found S3 buckets:"
    echo "$S3_BUCKETS" | sed 's/^/   - /'
fi

# Test 3: Check Lambda Functions
echo "λ Testing Lambda functions..."
LAMBDA_FUNCTIONS=$(aws lambda list-functions --region $AWS_REGION --query 'Functions[?contains(FunctionName, `'$STACK_PREFIX'`)].FunctionName' --output text)
if [ -z "$LAMBDA_FUNCTIONS" ]; then
    echo "⚠️  No Lambda functions found with prefix: $STACK_PREFIX"
else
    echo "✅ Found Lambda functions:"
    echo "$LAMBDA_FUNCTIONS" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 4: Check API Gateway
echo "🚪 Testing API Gateway..."
API_GATEWAYS=$(aws apigateway get-rest-apis --region $AWS_REGION --query 'items[?contains(name, `'$STACK_PREFIX'`)].name' --output text)
if [ -z "$API_GATEWAYS" ]; then
    echo "⚠️  No API Gateways found with prefix: $STACK_PREFIX"
else
    echo "✅ Found API Gateways:"
    echo "$API_GATEWAYS" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 5: Check DynamoDB Tables
echo "📊 Testing DynamoDB tables..."
DYNAMODB_TABLES=$(aws dynamodb list-tables --region $AWS_REGION --query 'TableNames[?contains(@, `'$STACK_PREFIX'`)]' --output text)
if [ -z "$DYNAMODB_TABLES" ]; then
    echo "⚠️  No DynamoDB tables found with prefix: $STACK_PREFIX"
else
    echo "✅ Found DynamoDB tables:"
    echo "$DYNAMODB_TABLES" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 6: Check CloudWatch Logs
echo "📝 Testing CloudWatch logs..."
LOG_GROUPS=$(aws logs describe-log-groups --region $AWS_REGION --query 'logGroups[?contains(logGroupName, `'$STACK_PREFIX'`)].logGroupName' --output text)
if [ -z "$LOG_GROUPS" ]; then
    echo "⚠️  No CloudWatch log groups found with prefix: $STACK_PREFIX"
else
    echo "✅ Found CloudWatch log groups:"
    echo "$LOG_GROUPS" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 7: Check CloudFront Distributions
echo "🌐 Testing CloudFront distributions..."
DISTRIBUTIONS=$(aws cloudfront list-distributions --region $AWS_REGION --query 'DistributionList.Items[?contains(Comment, `'$STACK_PREFIX'`)].Comment' --output text 2>/dev/null || echo "")
if [ -z "$DISTRIBUTIONS" ]; then
    echo "⚠️  No CloudFront distributions found with prefix: $STACK_PREFIX"
else
    echo "✅ Found CloudFront distributions:"
    echo "$DISTRIBUTIONS" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 8: Check Resource Tags
echo "🏷️  Testing resource tags..."
TAGGED_RESOURCES=$(aws resourcegroupstaggingapi get-resources --region $AWS_REGION --tag-filters Key=Project,Values=V1Z3R --query 'ResourceTagMappingList[].ResourceARN' --output text 2>/dev/null || echo "")
if [ -z "$TAGGED_RESOURCES" ]; then
    echo "⚠️  No resources found with Project=V1Z3R tag"
else
    echo "✅ Found tagged resources:"
    echo "$TAGGED_RESOURCES" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 9: Check IAM Roles
echo "👤 Testing IAM roles..."
IAM_ROLES=$(aws iam list-roles --query 'Roles[?contains(RoleName, `'$STACK_PREFIX'`)].RoleName' --output text)
if [ -z "$IAM_ROLES" ]; then
    echo "⚠️  No IAM roles found with prefix: $STACK_PREFIX"
else
    echo "✅ Found IAM roles:"
    echo "$IAM_ROLES" | tr '\t' '\n' | sed 's/^/   - /'
fi

# Test 10: Health Check Summary
echo "🏥 Running deployment health check..."
HEALTHY_SERVICES=0
TOTAL_SERVICES=0

# Check each service type
for SERVICE in "CloudFormation" "S3" "Lambda" "API Gateway" "DynamoDB" "CloudWatch" "IAM"; do
    TOTAL_SERVICES=$((TOTAL_SERVICES + 1))
    case $SERVICE in
        "CloudFormation") [ -n "$STACKS" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
        "S3") [ -n "$S3_BUCKETS" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
        "Lambda") [ -n "$LAMBDA_FUNCTIONS" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
        "API Gateway") [ -n "$API_GATEWAYS" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
        "DynamoDB") [ -n "$DYNAMODB_TABLES" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
        "CloudWatch") [ -n "$LOG_GROUPS" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
        "IAM") [ -n "$IAM_ROLES" ] && HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1)) ;;
    esac
done

echo ""
echo "🎉 AWS deployment testing completed!"
echo "📋 Summary:"
echo "   Environment: $ENVIRONMENT"
echo "   Region: $AWS_REGION"
echo "   Stack Prefix: $STACK_PREFIX"
echo "   Healthy Services: $HEALTHY_SERVICES/$TOTAL_SERVICES"
echo ""
echo "💡 Next steps:"
echo "   - Test application endpoints"
echo "   - Verify DNS and SSL configuration"
echo "   - Monitor CloudWatch metrics"
echo "   - Test auto-scaling policies"