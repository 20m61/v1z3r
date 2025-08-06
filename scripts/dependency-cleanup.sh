#!/bin/bash

# v1z3r Dependency Cleanup Script
# Purpose: Clean and optimize project dependencies
# Date: August 5, 2025

set -e  # Exit on error

echo "🧹 v1z3r Dependency Cleanup Script"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Backup current state
echo "📦 Step 1: Creating backup..."
if [ -f "package.json" ]; then
    cp package.json package.json.backup
    cp yarn.lock yarn.lock.backup 2>/dev/null || true
    print_status "Backup created: package.json.backup, yarn.lock.backup"
else
    print_error "package.json not found!"
    exit 1
fi

# Step 2: Clean node_modules and cache
echo ""
echo "🗑️ Step 2: Cleaning node_modules and cache..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    print_status "Removed node_modules"
fi

if [ -d ".next" ]; then
    rm -rf .next
    print_status "Removed .next build cache"
fi

yarn cache clean
print_status "Cleared yarn cache"

# Step 3: Remove yarn.lock for fresh resolution
echo ""
echo "🔄 Step 3: Removing yarn.lock for fresh dependency resolution..."
if [ -f "yarn.lock" ]; then
    rm yarn.lock
    print_status "Removed yarn.lock"
fi

# Step 4: Install dependencies fresh
echo ""
echo "📥 Step 4: Installing dependencies fresh..."
yarn install
print_status "Dependencies installed"

# Step 5: Deduplicate dependencies
echo ""
echo "🔀 Step 5: Deduplicating dependencies..."
yarn dedupe
print_status "Dependencies deduplicated"

# Step 6: Audit for vulnerabilities
echo ""
echo "🔒 Step 6: Running security audit..."
yarn audit || print_warning "Some vulnerabilities found - review manually"

# Step 7: Check for outdated packages
echo ""
echo "📊 Step 7: Checking for outdated packages..."
echo "Major updates available:"
yarn outdated || true

# Step 8: Build modules
echo ""
echo "🏗️ Step 8: Building workspace modules..."
yarn build:modules || print_warning "Some modules failed to build"

# Step 9: Run type check
echo ""
echo "📝 Step 9: Running TypeScript type check..."
yarn type-check || print_warning "TypeScript errors found - fix manually"

# Step 10: Run tests
echo ""
echo "🧪 Step 10: Running tests..."
yarn test --passWithNoTests || print_warning "Some tests failed"

# Step 11: Verify integrity
echo ""
echo "✅ Step 11: Verifying package integrity..."
yarn check --integrity || print_warning "Integrity check failed - may need manual intervention"

# Summary
echo ""
echo "==================================="
echo "📋 Dependency Cleanup Summary"
echo "==================================="

# Count packages
TOTAL_PACKAGES=$(yarn list --depth=0 2>/dev/null | grep -c "├─" || echo "0")
echo "Total packages: $TOTAL_PACKAGES"

# Check for vulnerabilities
VULNERABILITIES=$(yarn audit --json 2>/dev/null | grep -c '"type":"auditAdvisory"' || echo "0")
if [ "$VULNERABILITIES" -eq "0" ]; then
    print_status "No vulnerabilities found"
else
    print_warning "$VULNERABILITIES vulnerabilities found"
fi

# Check build status
if yarn build 2>/dev/null; then
    print_status "Build successful"
else
    print_error "Build failed - manual fixes required"
fi

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review and fix any TypeScript errors"
echo "2. Update outdated packages as needed"
echo "3. Fix any failing tests"
echo "4. Commit the updated yarn.lock file"
echo ""
echo "To restore backup if needed:"
echo "  mv package.json.backup package.json"
echo "  mv yarn.lock.backup yarn.lock"
echo "  yarn install"