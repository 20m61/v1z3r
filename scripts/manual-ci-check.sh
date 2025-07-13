#!/bin/bash
# Manual CI Check Script
# Run this script to manually execute CI checks when GitHub Actions is unavailable

set -e

echo "🔍 Manual CI Check Starting..."
echo "================================"

# Function to print status
print_status() {
    if [ $? -eq 0 ]; then
        echo "✅ $1 - PASSED"
    else
        echo "❌ $1 - FAILED"
        exit 1
    fi
}

# 1. TypeScript Type Check
echo "📝 Running TypeScript type check..."
yarn type-check
print_status "TypeScript type check"

# 2. Linting
echo "🔍 Running ESLint..."
yarn lint
print_status "ESLint"

# 3. Unit Tests
echo "🧪 Running unit tests..."
yarn test --passWithNoTests
print_status "Unit tests"

# 4. Build Check
echo "🏗️ Running build check..."
yarn build
print_status "Build process"

# 5. Module Build Check
echo "📦 Building workspace modules..."
cd modules/vj-controller && yarn build
print_status "Module build"

echo ""
echo "🎉 All manual CI checks passed!"
echo "✨ Ready for merge!"
echo ""
echo "Note: This script replaces GitHub Actions when billing issues prevent automated CI"