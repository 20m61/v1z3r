# VJ Application Infrastructure (AWS CDK)

## Overview
AWS CDK infrastructure configuration for the modular VJ application, organized into separate stacks for maintainability and scalability.

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
TODO: Implementation details to be added during development.