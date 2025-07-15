#!/bin/bash

# Production Deployment Pipeline for v1z3r
# Comprehensive deployment with performance optimization and monitoring

set -e

# Configuration
PROJECT_NAME="v1z3r"
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-prod}"
DEPLOY_BUCKET="${DEPLOY_BUCKET:-v1z3r-deployments-prod}"
CLOUDFRONT_DISTRIBUTION="${CLOUDFRONT_DISTRIBUTION_ID}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M%S)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
handle_error() {
    log_error "Deployment failed at step: $1"
    log_error "Rolling back changes..."
    
    # Attempt rollback
    if [ ! -z "$PREVIOUS_VERSION" ]; then
        aws s3 sync "s3://$DEPLOY_BUCKET/releases/$PREVIOUS_VERSION/" "s3://$DEPLOY_BUCKET/current/" --delete --profile $AWS_PROFILE
        if [ ! -z "$CLOUDFRONT_DISTRIBUTION" ]; then
            aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION --paths "/*" --profile $AWS_PROFILE
        fi
        log_info "Rollback completed to version: $PREVIOUS_VERSION"
    fi
    
    exit 1
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        log_error "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi
    
    # Check Node.js and yarn
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install it first."
        exit 1
    fi
    
    if ! command -v yarn &> /dev/null; then
        log_error "Yarn not found. Please install it first."
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$CLOUDFRONT_DISTRIBUTION" ]; then
        log_warning "CLOUDFRONT_DISTRIBUTION_ID not set. CDN invalidation will be skipped."
    fi
    
    # Validate git state
    if [ "$(git status --porcelain | wc -l)" -ne 0 ]; then
        log_error "Working directory is not clean. Please commit or stash changes."
        exit 1
    fi
    
    # Get current deployment version for rollback
    PREVIOUS_VERSION=$(aws s3 ls "s3://$DEPLOY_BUCKET/releases/" --profile $AWS_PROFILE | sort | tail -n 1 | awk '{print $2}' | tr -d '/')
    
    log_success "Pre-deployment checks passed"
}

# Build optimization
build_application() {
    log_info "Building optimized production bundle..."
    
    # Clean previous builds
    rm -rf .next out dist
    
    # Install dependencies with frozen lockfile
    yarn install --frozen-lockfile --production=false
    
    # Build all workspace modules first
    log_info "Building workspace modules..."
    yarn build:modules
    
    # Run linting and type checking
    log_info "Running code quality checks..."
    yarn lint --max-warnings 0 || handle_error "Linting failed"
    yarn type-check || handle_error "Type checking failed"
    
    # Run tests with coverage
    log_info "Running test suite..."
    yarn test --coverage --watchAll=false || handle_error "Tests failed"
    
    # Build Next.js application with production config
    log_info "Building Next.js application..."
    NODE_ENV=production yarn build || handle_error "Build failed"
    
    # Generate bundle analysis
    if [ "$ANALYZE_BUNDLE" = "true" ]; then
        log_info "Analyzing bundle size..."
        ANALYZE=true yarn build
    fi
    
    # Optimize assets
    log_info "Optimizing static assets..."
    optimize_assets
    
    log_success "Build completed successfully"
}

# Asset optimization
optimize_assets() {
    # Compress images if not already optimized
    if command -v imagemin &> /dev/null; then
        find out/static -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | xargs imagemin --out-dir=out/static/optimized/
    fi
    
    # Gzip compress static files
    find out -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" | while read file; do
        gzip -9 -c "$file" > "$file.gz"
    done
    
    # Generate service worker
    if [ -f "out/sw.js" ]; then
        log_info "Service worker generated and optimized"
    fi
}

# Infrastructure deployment
deploy_infrastructure() {
    log_info "Deploying infrastructure updates..."
    
    cd infra/cdk
    
    # Install CDK dependencies
    npm install
    
    # Deploy infrastructure stacks
    log_info "Deploying CDK stacks..."
    
    # Deploy in dependency order
    npx cdk deploy VjStorageStack-$ENVIRONMENT --profile $AWS_PROFILE --require-approval never || handle_error "Storage stack deployment failed"
    npx cdk deploy VjApiStack-$ENVIRONMENT --profile $AWS_PROFILE --require-approval never || handle_error "API stack deployment failed"
    npx cdk deploy VjAuthStack-$ENVIRONMENT --profile $AWS_PROFILE --require-approval never || handle_error "Auth stack deployment failed"
    npx cdk deploy VjPerformanceStack-$ENVIRONMENT --profile $AWS_PROFILE --require-approval never || handle_error "Performance stack deployment failed"
    npx cdk deploy VjLoggingStack-$ENVIRONMENT --profile $AWS_PROFILE --require-approval never || handle_error "Logging stack deployment failed"
    
    cd ../..
    
    log_success "Infrastructure deployment completed"
}

# Application deployment
deploy_application() {
    log_info "Deploying application to S3..."
    
    # Create release directory
    RELEASE_DIR="releases/$BUILD_NUMBER"
    
    # Upload to S3 with optimized settings
    aws s3 sync out/ "s3://$DEPLOY_BUCKET/$RELEASE_DIR/" \
        --profile $AWS_PROFILE \
        --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --metadata-directive REPLACE \
        --content-encoding gzip \
        --exclude "*.gz" \
        --include "*.js.gz" \
        --include "*.css.gz" \
        --include "*.html.gz" \
        --include "*.json.gz" || handle_error "S3 upload failed"
    
    # Upload non-compressed files
    aws s3 sync out/ "s3://$DEPLOY_BUCKET/$RELEASE_DIR/" \
        --profile $AWS_PROFILE \
        --cache-control "public, max-age=86400" \
        --exclude "*.gz" \
        --exclude "*.js" \
        --exclude "*.css" \
        --exclude "*.html" \
        --exclude "*.json" || handle_error "S3 upload failed"
    
    # Update current release pointer
    aws s3 sync "s3://$DEPLOY_BUCKET/$RELEASE_DIR/" "s3://$DEPLOY_BUCKET/current/" \
        --profile $AWS_PROFILE \
        --delete || handle_error "Current release update failed"
    
    log_success "Application deployed to S3"
}

# CDN invalidation
invalidate_cdn() {
    if [ ! -z "$CLOUDFRONT_DISTRIBUTION" ]; then
        log_info "Invalidating CloudFront distribution..."
        
        INVALIDATION_ID=$(aws cloudfront create-invalidation \
            --distribution-id $CLOUDFRONT_DISTRIBUTION \
            --paths "/*" \
            --profile $AWS_PROFILE \
            --query 'Invalidation.Id' \
            --output text) || handle_error "CDN invalidation failed"
        
        log_info "Invalidation started with ID: $INVALIDATION_ID"
        
        # Wait for invalidation to complete
        log_info "Waiting for invalidation to complete..."
        aws cloudfront wait invalidation-completed \
            --distribution-id $CLOUDFRONT_DISTRIBUTION \
            --id $INVALIDATION_ID \
            --profile $AWS_PROFILE
        
        log_success "CDN invalidation completed"
    else
        log_warning "Skipping CDN invalidation (no distribution ID provided)"
    fi
}

# Performance validation
validate_deployment() {
    log_info "Validating deployment performance..."
    
    # Get CloudFront URL or S3 website URL
    if [ ! -z "$CLOUDFRONT_DISTRIBUTION" ]; then
        WEBSITE_URL="https://$(aws cloudfront get-distribution --id $CLOUDFRONT_DISTRIBUTION --profile $AWS_PROFILE --query 'Distribution.DomainName' --output text)"
    else
        WEBSITE_URL="https://$DEPLOY_BUCKET.s3-website-$AWS_REGION.amazonaws.com"
    fi
    
    log_info "Testing website: $WEBSITE_URL"
    
    # Health check
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEBSITE_URL" || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        log_success "Health check passed (HTTP $HTTP_STATUS)"
    else
        log_error "Health check failed (HTTP $HTTP_STATUS)"
        handle_error "Deployment validation failed"
    fi
    
    # Performance check with curl timing
    log_info "Checking performance metrics..."
    TIMING=$(curl -s -o /dev/null -w "time_total:%{time_total}\ntime_connect:%{time_connect}\ntime_starttransfer:%{time_starttransfer}\n" "$WEBSITE_URL")
    echo "$TIMING" | while read line; do
        log_info "  $line"
    done
    
    # Run Lighthouse if available
    if command -v lighthouse &> /dev/null; then
        log_info "Running Lighthouse performance audit..."
        lighthouse "$WEBSITE_URL" --chrome-flags="--headless" --output=json --output-path="./lighthouse-report.json" || log_warning "Lighthouse audit failed"
    fi
    
    log_success "Deployment validation completed"
}

# Monitoring setup
setup_monitoring() {
    log_info "Setting up monitoring and alerting..."
    
    # Create CloudWatch alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "v1z3r-high-error-rate-$ENVIRONMENT" \
        --alarm-description "High error rate detected" \
        --metric-name "ErrorRate" \
        --namespace "AWS/CloudFront" \
        --statistic "Average" \
        --period 300 \
        --threshold 5 \
        --comparison-operator "GreaterThanThreshold" \
        --evaluation-periods 2 \
        --profile $AWS_PROFILE || log_warning "Failed to create error rate alarm"
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "v1z3r-slow-response-$ENVIRONMENT" \
        --alarm-description "Slow response time detected" \
        --metric-name "ResponseTime" \
        --namespace "AWS/CloudFront" \
        --statistic "Average" \
        --period 300 \
        --threshold 2000 \
        --comparison-operator "GreaterThanThreshold" \
        --evaluation-periods 2 \
        --profile $AWS_PROFILE || log_warning "Failed to create response time alarm"
    
    log_success "Monitoring setup completed"
}

# Deployment notification
send_notification() {
    local status=$1
    local message="v1z3r deployment $status - Environment: $ENVIRONMENT, Build: $BUILD_NUMBER"
    
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
    fi
    
    log_info "Deployment notification sent: $message"
}

# Main deployment workflow
main() {
    log_info "Starting production deployment for $PROJECT_NAME"
    log_info "Environment: $ENVIRONMENT"
    log_info "Build Number: $BUILD_NUMBER"
    log_info "AWS Profile: $AWS_PROFILE"
    
    send_notification "STARTED"
    
    # Deployment steps
    pre_deployment_checks
    build_application
    deploy_infrastructure
    deploy_application
    invalidate_cdn
    validate_deployment
    setup_monitoring
    
    log_success "Production deployment completed successfully!"
    log_info "Build Number: $BUILD_NUMBER"
    log_info "Website URL: https://$(aws cloudfront get-distribution --id $CLOUDFRONT_DISTRIBUTION --profile $AWS_PROFILE --query 'Distribution.DomainName' --output text 2>/dev/null || echo "$DEPLOY_BUCKET.s3-website-$AWS_REGION.amazonaws.com")"
    
    send_notification "SUCCEEDED"
}

# Rollback function
rollback() {
    local target_version=$1
    
    if [ -z "$target_version" ]; then
        log_error "Please specify a version to rollback to"
        log_info "Available versions:"
        aws s3 ls "s3://$DEPLOY_BUCKET/releases/" --profile $AWS_PROFILE | awk '{print $2}' | tr -d '/'
        exit 1
    fi
    
    log_info "Rolling back to version: $target_version"
    
    # Copy target version to current
    aws s3 sync "s3://$DEPLOY_BUCKET/releases/$target_version/" "s3://$DEPLOY_BUCKET/current/" --delete --profile $AWS_PROFILE
    
    # Invalidate CDN
    if [ ! -z "$CLOUDFRONT_DISTRIBUTION" ]; then
        aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION --paths "/*" --profile $AWS_PROFILE
    fi
    
    log_success "Rollback completed"
    send_notification "ROLLED_BACK to $target_version"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback $2
        ;;
    "validate")
        validate_deployment
        ;;
    *)
        echo "Usage: $0 {deploy|rollback <version>|validate}"
        exit 1
        ;;
esac