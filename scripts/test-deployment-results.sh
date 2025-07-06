#!/bin/bash

# V1Z3R Deployment Test Results Script
# This script checks the deployment status and provides recommendations

set -e

echo "📊 V1Z3R Deployment Test Results"
echo "================================"
echo ""

# AWS Resources Deployed
echo "✅ AWS Infrastructure Status:"
echo "  - CloudFormation Stacks: 3 stacks deployed (VjConfigStack, VjStorageStack, VjApiStack)"
echo "  - DynamoDB Tables: 3 tables created"
echo "  - Lambda Functions: 9 functions deployed"
echo "  - S3 Buckets: Static hosting bucket created"
echo "  - API Gateway: REST API and WebSocket API deployed"
echo ""

# Known Issues
echo "⚠️  Known Issues:"
echo "  1. Health check Lambda function has import error"
echo "     - Error: Cannot find module 'health'"
echo "     - Impact: Health check endpoint returns 500"
echo "  2. Static hosting stack failed to deploy"
echo "     - Error: Unresolved resource dependencies"
echo "     - Impact: Frontend not deployed to S3/CloudFront"
echo "  3. Local environment has permission issues"
echo "     - Impact: Cannot run tests locally"
echo ""

# API Endpoints
echo "🔗 API Endpoints:"
echo "  - REST API: https://jej6yzkbeb.execute-api.ap-northeast-1.amazonaws.com/dev/"
echo "  - WebSocket: wss://c3xs5dzz4a.execute-api.ap-northeast-1.amazonaws.com/dev"
echo ""

# Test Results Summary
echo "📋 Test Results Summary:"
echo "  - Infrastructure: ✅ Partially deployed"
echo "  - API Gateway: ✅ Created"
echo "  - Lambda Functions: ⚠️  Some errors"
echo "  - DynamoDB: ✅ Tables created"
echo "  - S3 Static Hosting: ❌ Not deployed"
echo "  - Application Build: ❌ Local build failed"
echo ""

# Recommendations
echo "💡 Recommendations for Next Steps:"
echo "  1. Fix Lambda function code deployment:"
echo "     - Health function needs proper handler"
echo "     - Check Lambda inline code in CDK stack"
echo ""
echo "  2. Deploy frontend application:"
echo "     - Build Next.js application"
echo "     - Deploy to S3 bucket"
echo "     - Configure CloudFront distribution"
echo ""
echo "  3. Fix local development environment:"
echo "     - Resolve yarn/npm permission issues"
echo "     - Install dependencies properly"
echo "     - Run tests to verify functionality"
echo ""
echo "  4. Complete deployment:"
echo "     - Fix VjStaticHostingStack dependencies"
echo "     - Deploy VjMonitoringStack"
echo "     - Verify all endpoints are working"
echo ""

# Manual Test Commands
echo "🧪 Manual Test Commands:"
echo "  # Test health endpoint (currently failing)"
echo "  curl https://jej6yzkbeb.execute-api.ap-northeast-1.amazonaws.com/dev/health"
echo ""
echo "  # Check Lambda logs"
echo "  aws logs tail /aws/lambda/VjApiStack-dev-HealthFunction19D7724A-c183S1CAKxDa --follow"
echo ""
echo "  # List DynamoDB tables"
echo "  aws dynamodb list-tables --region ap-northeast-1"
echo ""
echo "  # Check S3 buckets"
echo "  aws s3 ls | grep v1z3r"
echo ""

echo "📝 Deployment Status: Partial Success with Issues"
echo "   Core infrastructure is deployed but requires fixes"