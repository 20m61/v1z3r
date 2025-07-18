# VJ Application Infrastructure (AWS CDK)

## Overview
Production-ready AWS CDK infrastructure for the v1z3r VJ application. This infrastructure supports real-time audio-visual performances with global scalability, high availability, and comprehensive monitoring.

## Stack Organization

### 1. vj-api-stack
**Purpose**: API Gateway and Lambda functions for WebSocket and REST APIs
- API Gateway (WebSocket for real-time sync)
- API Gateway (REST for preset management)
- Lambda functions for business logic
- IAM roles and policies

### 2. vj-storage-stack
**Purpose**: Data storage and persistence layer
- DynamoDB tables (sessions, presets, users)
- S3 buckets (preset files, media assets)
- DynamoDB Streams (real-time triggers)
- Backup and lifecycle policies

### 3. vj-static-hosting-stack
**Purpose**: Frontend hosting and CDN
- S3 bucket for static website hosting
- CloudFront distribution for global CDN
- ACM SSL certificates
- Route 53 DNS configuration (optional)

### 4. vj-monitoring-stack
**Purpose**: Observability and alerting
- CloudWatch Log Groups
- CloudWatch Metrics and Dashboards
- CloudWatch Alarms for error rates
- SNS topics for notifications

### 5. vj-config-stack
**Purpose**: Configuration and secrets management
- SSM Parameter Store for configuration
- AWS Secrets Manager for sensitive data
- Environment-specific parameters

## Directory Structure
```
infra/cdk/
├── lib/
│   ├── stacks/
│   │   ├── vj-api-stack.ts
│   │   ├── vj-storage-stack.ts
│   │   ├── vj-static-hosting-stack.ts
│   │   ├── vj-monitoring-stack.ts
│   │   └── vj-config-stack.ts
│   ├── constructs/     # Reusable CDK constructs
│   └── utils/          # Helper utilities
├── bin/
│   └── vj-app.ts       # CDK app entry point
├── config/
│   ├── dev.json        # Development environment config
│   ├── staging.json    # Staging environment config
│   └── prod.json       # Production environment config
├── cdk.json            # CDK configuration
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript configuration
```

## Deployment Commands
```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
cdk deploy --all

# Deploy specific stack
cdk deploy VjApiStack

# Destroy all stacks
cdk destroy --all
```

## Environment Configuration
Each environment (dev/staging/prod) has its own configuration file with:
- Stack naming conventions
- Resource sizing parameters
- Security settings
- Cost optimization settings

## Getting Started

### Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js 18.x or higher
- AWS CDK CLI: `npm install -g aws-cdk`

### Quick Start
```bash
# Clone the repository
git clone https://github.com/20m61/v1z3r.git
cd v1z3r/infra/cdk

# Install dependencies
npm install

# Deploy to development
cdk deploy VjUnifiedStack-dev

# Deploy to production
cdk deploy VjUnifiedStack-prod --profile prod
```

## Current Infrastructure

### Deployed Environments

#### Development
- Frontend: https://d2nebch0xgucwg.cloudfront.net/
- API: https://vphbflpav3.execute-api.ap-northeast-1.amazonaws.com/dev/

#### Production  
- Frontend: http://vj-unified-frontend-prod-822063948773.s3-website-ap-northeast-1.amazonaws.com/
- API: https://izn3rhan4m.execute-api.ap-northeast-1.amazonaws.com/prod/

### Key Features
- **Serverless Architecture**: Auto-scaling Lambda functions
- **Global CDN**: CloudFront distribution for low latency
- **Real-time Collaboration**: WebSocket API for live sync
- **Data Persistence**: DynamoDB tables with on-demand billing
- **Security**: IAM roles with minimal permissions, HTTPS/WSS everywhere
- **Monitoring**: CloudWatch dashboards and alarms

## Testing

### Lambda Function Tests
```bash
cd lambda/preset
npm test
```

### Infrastructure Tests
```bash
npm run test
```

## Security Considerations
- All Lambda functions use minimal IAM permissions
- S3 buckets have appropriate access policies
- API Gateway configured with throttling
- CloudFront with security headers
- Environment-specific configurations

## Cost Optimization
- DynamoDB on-demand billing
- S3 lifecycle policies for old data
- CloudFront caching strategies
- Lambda reserved capacity for production

## Monitoring and Alerts
- API error rate and latency monitoring
- Lambda function errors and throttles
- DynamoDB capacity and throttling
- CloudFront cache hit rates
- Custom metrics dashboard

## Documentation
- [SSL Certificate Setup](./SSL_CERTIFICATE_SETUP.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Environment Variables](./.env.example)