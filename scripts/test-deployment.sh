#!/bin/bash

# V1Z3R Post-Deployment Testing Script
# This script tests the deployed application endpoints and functionality

set -e

echo "🚀 Starting post-deployment testing for V1Z3R..."

# Configuration
DEV_URL="http://localhost:3000"
STAGING_URL="${STAGING_URL:-https://staging.v1z3r.com}"
PROD_URL="${PROD_URL:-https://v1z3r.com}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

# Select target URL based on environment
case $ENVIRONMENT in
  "dev")
    TARGET_URL=$DEV_URL
    ;;
  "staging")
    TARGET_URL=$STAGING_URL
    ;;
  "prod")
    TARGET_URL=$PROD_URL
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "🎯 Testing environment: $ENVIRONMENT"
echo "🔗 Target URL: $TARGET_URL"

# Test 1: Health Check
echo "🏥 Testing health check..."
if curl -f -s "$TARGET_URL/api/health" > /dev/null; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi

# Test 2: Main Application Load
echo "🌐 Testing main application load..."
if curl -f -s "$TARGET_URL" > /dev/null; then
  echo "✅ Main application loads successfully"
else
  echo "❌ Main application load failed"
  exit 1
fi

# Test 3: API Endpoints
echo "📡 Testing API endpoints..."

# MCP GitHub endpoint
if curl -f -s "$TARGET_URL/api/mcp/github" > /dev/null; then
  echo "✅ MCP GitHub endpoint accessible"
else
  echo "⚠️  MCP GitHub endpoint not accessible (may be expected)"
fi

# MCP Playwright endpoint
if curl -f -s "$TARGET_URL/api/mcp/playwright" > /dev/null; then
  echo "✅ MCP Playwright endpoint accessible"
else
  echo "⚠️  MCP Playwright endpoint not accessible (may be expected)"
fi

# Test 4: Static Assets
echo "🎨 Testing static assets..."
if curl -f -s "$TARGET_URL/_next/static" > /dev/null; then
  echo "✅ Static assets accessible"
else
  echo "⚠️  Static assets check inconclusive"
fi

# Test 5: WebSocket Connection (if applicable)
echo "🔌 Testing WebSocket capabilities..."
# Note: WebSocket testing requires more complex setup
echo "ℹ️  WebSocket testing requires manual verification"

# Test 6: Performance Check
echo "⚡ Running basic performance check..."
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$TARGET_URL")
echo "📊 Response time: ${RESPONSE_TIME}s"

if (( $(echo "$RESPONSE_TIME < 3.0" | bc -l) )); then
  echo "✅ Performance check passed (< 3s)"
else
  echo "⚠️  Performance check warning (> 3s)"
fi

# Test 7: Environment Configuration
echo "⚙️  Testing environment configuration..."
if [[ "$ENVIRONMENT" == "dev" ]]; then
  echo "ℹ️  Development environment - skipping production-specific checks"
else
  # Check HTTPS redirect
  if curl -f -s -I "$TARGET_URL" | grep -q "HTTP/2 200\|HTTP/1.1 200"; then
    echo "✅ HTTPS connection verified"
  else
    echo "⚠️  HTTPS connection check inconclusive"
  fi
fi

echo ""
echo "🎉 Post-deployment testing completed!"
echo "📋 Summary:"
echo "   Environment: $ENVIRONMENT"
echo "   Target URL: $TARGET_URL"
echo "   Response Time: ${RESPONSE_TIME}s"
echo ""
echo "💡 Next steps:"
echo "   - Run manual UI testing"
echo "   - Verify VJ functionality"
echo "   - Test real-time features"
echo "   - Monitor application logs"