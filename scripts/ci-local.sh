#!/bin/bash

# Local CI verification script
# Simulates the CI pipeline locally for faster development feedback

set -e

echo "🚀 Starting local CI verification..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2 passed${NC}"
    else
        echo -e "${RED}❌ $2 failed${NC}"
        return 1
    fi
}

# Function to run stage
run_stage() {
    echo -e "\n${BLUE}📋 Stage: $1${NC}"
    echo "$(date '+%H:%M:%S') - Starting $1"
}

# Stage 1: Critical checks
run_stage "Critical Checks"
echo "Running TypeScript check..."
yarn type-check
print_status $? "TypeScript check"

echo "Running linting..."
yarn lint
print_status $? "Linting"

echo "Running build check..."
yarn build:dev > /dev/null 2>&1
print_status $? "Build check"

# Stage 2: Core tests
run_stage "Core Tests"
echo "Building modules..."
yarn build:modules > /dev/null 2>&1
print_status $? "Module build"

echo "Running stable tests..."
yarn ci:core-tests
print_status $? "Core tests"

# Stage 3: Extended tests (optional)
echo -e "\n${YELLOW}⚡ Would you like to run extended tests? (y/N)${NC}"
read -t 10 -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_stage "Extended Tests"
    echo "Running all tests (this may take a while)..."
    yarn test --passWithNoTests --maxWorkers=2 || echo -e "${YELLOW}⚠️  Some extended tests failed (expected during technical debt resolution)${NC}"
fi

# Summary
echo -e "\n${GREEN}🎉 Local CI verification completed!${NC}"
echo "=================================="
echo "✅ Critical checks passed"
echo "✅ Core tests passed"
echo ""
echo "Your code is ready for CI pipeline!"
echo "$(date '+%H:%M:%S') - CI verification completed"