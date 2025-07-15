#!/bin/bash
# Script to clean up CloudFormation stacks
# This script safely removes v1z3r-related AWS resources

set -e

echo "=== CloudFormation Stack Cleanup Script ==="
echo "This script will remove v1z3r-related CloudFormation stacks"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile dev >/dev/null 2>&1; then
  echo "Error: AWS CLI is not configured with 'dev' profile"
  echo "Please run: aws configure --profile dev"
  exit 1
fi

# List all v1z3r related stacks
echo "Listing v1z3r-related stacks..."
STACKS=$(aws cloudformation list-stacks --profile dev \
  --query "StackSummaries[?contains(StackName, 'vj-') && StackStatus!='DELETE_COMPLETE'].StackName" \
  --output text 2>/dev/null || echo "")

if [ -z "$STACKS" ]; then
  echo "No v1z3r stacks found to delete."
  exit 0
fi

echo "Found the following stacks:"
echo "$STACKS" | tr '\t' '\n'
echo ""

# Confirm deletion
read -p "Do you want to delete these stacks? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

# Delete stacks in reverse dependency order
ORDERED_STACKS=(
  "vj-logging-stack-prod"
  "vj-logging-stack-staging"
  "vj-logging-stack-dev"
  "vj-auth-stack-prod"
  "vj-auth-stack-staging"
  "vj-auth-stack-dev"
  "vj-app-stack-prod"
  "vj-app-stack-staging"
  "vj-app-stack-dev"
  "vj-storage-stack-prod"
  "vj-storage-stack-staging"
  "vj-storage-stack-dev"
  "vj-network-stack-prod"
  "vj-network-stack-staging"
  "vj-network-stack-dev"
)

for STACK in "${ORDERED_STACKS[@]}"; do
  if echo "$STACKS" | grep -q "$STACK"; then
    echo "Deleting stack: $STACK"
    
    # Empty S3 buckets first if this is a storage stack
    if [[ "$STACK" == *"storage-stack"* ]]; then
      echo "Emptying S3 buckets for $STACK..."
      BUCKETS=$(aws cloudformation describe-stack-resources --profile dev \
        --stack-name "$STACK" \
        --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" \
        --output text 2>/dev/null || echo "")
      
      for BUCKET in $BUCKETS; do
        echo "Emptying bucket: $BUCKET"
        aws s3 rm "s3://$BUCKET" --recursive --profile dev 2>/dev/null || true
      done
    fi
    
    # Delete the stack
    aws cloudformation delete-stack --stack-name "$STACK" --profile dev
    
    # Wait for deletion to complete
    echo "Waiting for $STACK deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name "$STACK" --profile dev || {
      echo "Warning: Stack deletion may have issues. Check AWS Console."
    }
    
    echo "✓ $STACK deleted"
  fi
done

echo ""
echo "=== Cleanup Complete ==="
echo "All v1z3r CloudFormation stacks have been removed."
echo ""
echo "Note: Some resources like CloudWatch Logs may be retained by default."
echo "Check the AWS Console for any remaining resources if needed."