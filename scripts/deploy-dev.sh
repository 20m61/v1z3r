#!/bin/bash

# Simple deployment script for v1z3r development environment
# Deploys static build to S3

set -e

# Configuration
S3_BUCKET="vj-unified-frontend-dev-822063948773"
BUILD_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
AWS_REGION="ap-northeast-1"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting deployment to development environment${NC}"
echo -e "${BLUE}   S3 Bucket: ${S3_BUCKET}${NC}"
echo -e "${BLUE}   Build: ${BUILD_TIMESTAMP}${NC}"

# Check if out directory exists
if [ ! -d "out" ]; then
    echo -e "${RED}❌ Error: 'out' directory not found. Please run build first.${NC}"
    exit 1
fi

# Upload to S3
echo -e "${BLUE}📤 Uploading to S3...${NC}"

# Upload HTML files with no-cache
aws s3 sync out/ s3://${S3_BUCKET}/ \
    --delete \
    --exclude "*.js" \
    --exclude "*.css" \
    --exclude "*.map" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html" \
    --region ${AWS_REGION}

# Upload JS/CSS files with long cache
aws s3 sync out/ s3://${S3_BUCKET}/ \
    --exclude "*" \
    --include "*.js" \
    --include "*.css" \
    --include "*.map" \
    --cache-control "public, max-age=31536000, immutable" \
    --region ${AWS_REGION}

# Upload static assets
aws s3 sync out/ s3://${S3_BUCKET}/ \
    --exclude "*.html" \
    --exclude "*.js" \
    --exclude "*.css" \
    --exclude "*.map" \
    --cache-control "public, max-age=86400" \
    --region ${AWS_REGION}

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application available at: https://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com${NC}"

# Save deployment info
echo "${BUILD_TIMESTAMP}" > last-deployment.txt
echo -e "${BLUE}📝 Deployment info saved to last-deployment.txt${NC}"