# V1Z3R Development Workflows 2025

**Updated**: July 28, 2025  
**Branch**: comprehensive-review/system-audit-2025  

## Overview

This document outlines the comprehensive development workflows for the V1Z3R project, including current processes, tooling, and recommended practices based on the 2025 system audit.

## Quick Reference Commands

### Essential Development Commands
```bash
# Environment Setup
yarn install                    # Install all dependencies
yarn build:modules             # Build all workspace modules  
yarn setup:dev                 # Complete development setup

# Development Server
yarn dev                       # Start development server (port 3000)
yarn dev:local                 # Start with .env.local config
yarn dev:dev                   # Start with .env.dev config

# Build & Deploy
yarn build                     # Production build
yarn build:dev                 # Build with dev environment
yarn build:prod                # Build with production environment

# Quality Assurance
yarn lint                      # Run ESLint
yarn type-check               # TypeScript type checking
yarn test                     # Run all tests (1,060 tests)
yarn test:watch               # Run tests in watch mode
yarn test:e2e                 # End-to-end tests with Playwright

# Infrastructure
yarn infra:dev                # Deploy dev infrastructure
yarn infra:prod               # Deploy production infrastructure

# Manual CI (GitHub Actions Alternative)
./scripts/manual-ci-check.sh  # Complete CI verification
```

## Current CI/CD Status ⚠️

### GitHub Actions Status: DISABLED
- **Reason**: Billing constraints
- **Impact**: No automated testing, builds, or deployments
- **Workaround**: Manual CI script available

### Manual CI Process
The project includes a comprehensive manual CI script that replaces GitHub Actions:

```bash
#!/bin/bash
# Manual CI Check Process
./scripts/manual-ci-check.sh

# This script includes:
# 1. TypeScript type checking
# 2. ESLint validation  
# 3. Unit test execution
# 4. Build verification
# 5. Module integration tests
```

### Staged CI Pipeline Design
When GitHub Actions is restored, the project uses a 4-stage pipeline:

1. **Stage 1**: Critical Checks (10min timeout)
   - TypeScript compilation
   - ESLint validation
   - Build verification

2. **Stage 2**: Core Tests (15min timeout)
   - Stable test suite
   - Auth, utils, services tests
   - Integration verification

3. **Stage 3**: Extended Tests (20min timeout)
   - Full test suite
   - Failure tolerance enabled
   - Coverage reporting

4. **Stage 4**: E2E Tests (25min timeout)
   - Playwright tests
   - Main branch only
   - Artifact collection

## Development Environment Setup

### Prerequisites
- **Node.js**: v20+ (specified in workflow)
- **Package Manager**: Yarn 1.22.22+
- **AWS CLI**: For infrastructure management
- **Docker**: For containerized development (optional)

### Initial Setup Process
```bash
# 1. Clone and navigate to project
git clone <repository-url>
cd v1z3r

# 2. Install dependencies
yarn install

# 3. Build all workspace modules
yarn build:modules

# 4. Set up environment configuration
cp .env.example .env.local
# Edit .env.local with appropriate values

# 5. Verify setup
yarn setup:dev

# 6. Start development server
yarn dev
```

### Environment Configuration
The project supports multiple environment configurations:

```bash
# Local Development
yarn env:local    # Uses .env.local
yarn dev:local    # Start with local config

# Development Environment  
yarn env:dev      # Uses .env.dev
yarn dev:dev      # Start with dev config

# Production Environment
yarn env:prod     # Uses .env.prod
yarn build:prod   # Build with prod config
```

## Module Development Workflow

### Workspace Module Structure
```
modules/
├── types/                    # @vj-app/types
├── test-utils/              # @vj-app/test-utils  
├── ui-components/           # @vj-app/ui-components
├── visual-renderer/         # @vj-app/visual-renderer
├── vj-controller/           # @vj-app/vj-controller
├── sync-core/               # @vj-app/sync-core
├── preset-storage/          # @vj-app/preset-storage
└── lyrics-engine/           # @vj-app/lyrics-engine
```

### Module Development Process
```bash
# 1. Navigate to specific module
cd modules/visual-renderer

# 2. Install dependencies (if needed)
yarn install

# 3. Make changes to module source

# 4. Build the module
yarn build  # or cd to root and run yarn build:modules

# 5. Test the module
yarn test

# 6. Test integration with main app
cd ../..
yarn dev    # Verify in main application
```

### Module Testing Workflow
```bash
# Test individual modules
yarn workspace @vj-app/visual-renderer test
yarn workspace @vj-app/vj-controller test  
yarn workspace @vj-app/sync-core test
yarn workspace @vj-app/preset-storage test

# Test all modules
yarn test:modules

# Integration testing
yarn test tests/integration/modules.test.ts
```

## Testing Workflows

### Current Test Metrics (July 2025)
- **Total Tests**: 1,060
- **Passed**: 844 (79.6%)
- **Failed**: 40 (3.8%)
- **Skipped**: 176 (16.6%)
- **Test Suites**: 51 total, 38 passed, 7 failed, 6 skipped

### Test Categories

#### Unit Tests
```bash
# Run all unit tests
yarn test

# Run specific test files
yarn test src/components/__tests__/AudioAnalyzer.test.tsx
yarn test src/utils/__tests__/errorHandler.test.ts

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:coverage
```

#### Integration Tests
```bash
# Run integration tests
yarn test tests/integration/

# Run module integration tests specifically  
yarn test tests/integration/modules.test.ts
```

#### End-to-End Tests
```bash
# Run E2E tests
yarn test:e2e

# Run specific E2E test suites
yarn test:e2e tests/e2e/auth/
yarn test:e2e tests/e2e/visualizer/
```

### Test Development Guidelines

#### Writing Unit Tests
```typescript
// Example test structure
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup mocks and test environment
  });

  it('should handle expected behavior', () => {
    // Test implementation
  });

  afterEach(() => {
    // Cleanup
  });
});
```

#### Mocking Guidelines
- **WebGL/Canvas**: Use provided mocks in `modules/test-utils`
- **Audio API**: Mock AudioContext and related APIs
- **AWS Services**: Mock with proper error handling
- **WebGPU**: Use fallback detection in tests

## Code Quality Workflows

### Pre-commit Process
```bash
# Current pre-commit hooks (via Husky)
yarn prepare    # Install Husky hooks

# Manual quality checks
yarn lint       # ESLint validation
yarn type-check # TypeScript type checking
```

### Code Review Process
1. **Branch Creation**: Feature branches from `main`
2. **Development**: Follow coding standards and test requirements
3. **Quality Gates**: 
   - All tests passing
   - TypeScript compilation successful
   - ESLint validation passing
4. **Pull Request**: Comprehensive description with testing notes
5. **Review**: Code review focusing on architecture and quality
6. **Merge**: Squash and merge to main branch

### Coding Standards
- **TypeScript**: Strict mode enabled
- **Components**: React functional components with hooks
- **Styling**: Tailwind CSS with CSS Modules for complex cases
- **State Management**: Zustand for global state
- **Error Handling**: Comprehensive error boundaries and logging
- **Performance**: Memo optimization for expensive components

## Infrastructure Workflows

### AWS CDK Management
```bash
# Deploy development infrastructure
yarn infra:dev

# Deploy production infrastructure  
yarn infra:prod

# Destroy infrastructure (use with caution)
yarn infra:destroy:dev
yarn infra:destroy:prod
```

### Infrastructure Components
- **Unified Stack**: Single CDK stack per environment
- **Services**: Lambda, DynamoDB, S3, API Gateway, CloudFront
- **Monitoring**: CloudWatch, X-Ray tracing
- **Security**: IAM roles, security groups, encryption

### Deployment Process
```bash
# Development deployment
yarn deploy:dev

# Production deployment
yarn deploy:prod

# Manual deployment verification
./scripts/test-deployment.sh
./scripts/test-vj-functionality.sh
```

## Performance Optimization Workflows

### Performance Monitoring
- **Real-time Metrics**: Built-in performance monitor
- **Mobile Optimization**: iOS Safari specific handling
- **WebGPU Detection**: Automatic fallback management
- **Memory Management**: Buffer pooling and cleanup

### Performance Testing
```bash
# Run performance tests
yarn test src/utils/__tests__/performance.test.ts

# Load testing (requires setup)
cd tests/load/
./run-load-tests.sh

# Browser-specific testing
open http://localhost:3000/performance-test
```

### Optimization Guidelines
1. **Component Optimization**: Use React.memo for expensive renders
2. **Bundle Optimization**: Dynamic imports for large dependencies
3. **Asset Optimization**: Image optimization and lazy loading
4. **Network Optimization**: Caching strategies and compression

## Troubleshooting Common Issues

### Module Resolution Failures
```bash
# If modules are not found
yarn build:modules

# If workspace issues persist
rm -rf node_modules modules/*/node_modules
yarn install
yarn build:modules
```

### Test Failures
```bash
# Clear Jest cache
yarn test --clearCache

# Run tests with verbose output
yarn test --verbose

# Run specific failing tests
yarn test --testNamePattern="failing test name"
```

### Build Issues
```bash
# Clear Next.js cache
rm -rf .next
yarn build

# Clear TypeScript cache
rm -rf tsconfig.tsbuildinfo
yarn type-check
```

### Development Server Issues
```bash
# Reset development environment
yarn clean  # If available
rm -rf .next node_modules
yarn install
yarn build:modules
yarn dev
```

## Security Workflows

### Authentication Testing
```bash
# Test authentication flows
yarn test src/services/auth/__tests__/
yarn test src/components/auth/__tests__/

# Manual authentication testing
open http://localhost:3000/auth/login
```

### Security Validation
```bash
# Environment variable validation
yarn test src/config/

# Input validation testing
yarn test src/utils/__tests__/validation.test.ts

# Security-focused tests
yarn test --testPathPattern="security|auth"
```

## Documentation Workflows

### Documentation Structure
```
docs/
├── api/                     # API documentation
├── architecture/            # System architecture
├── deployment/             # Deployment guides
├── development/            # Development workflows (this file)
├── legacy/                # Historical documentation
└── audits/                # System audits and reviews
```

### Documentation Updates
1. **Update on Major Changes**: Architecture, API, or workflow changes
2. **Version Documentation**: Keep documentation in sync with releases
3. **Review Process**: Documentation reviews alongside code reviews
4. **Automation**: Generate API docs from TypeScript interfaces

## Emergency Procedures

### Production Issues
1. **Immediate**: Check CloudWatch logs and metrics
2. **Rollback**: Use CDK to rollback to previous stable version
3. **Communication**: Update status page and notify stakeholders
4. **Investigation**: Use X-Ray tracing for detailed analysis

### CI/CD Failures
1. **GitHub Actions Down**: Use manual CI script
2. **Build Failures**: Check dependencies and environment configs
3. **Test Failures**: Identify critical vs non-critical failures
4. **Deployment Issues**: Use manual deployment verification scripts

## Future Improvements

### Planned Enhancements
1. **Restore GitHub Actions**: Resolve billing and restore automation
2. **Test Stabilization**: Achieve 95%+ test success rate
3. **Performance Optimization**: Further mobile and WebGPU improvements
4. **Documentation**: Automated API documentation generation

### Workflow Optimization
1. **Development Speed**: Faster build times and hot reload
2. **Testing Efficiency**: Parallel test execution and better mocking
3. **Deployment Automation**: One-click deployments with verification
4. **Quality Gates**: Automated quality checks and notifications

---
*Updated by Claude Code System Audit - July 28, 2025*