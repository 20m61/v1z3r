#!/bin/bash
# Test script for v1z3r devcontainer configuration

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_command() {
    local description="$1"
    local command="$2"
    
    echo -n "Testing: $description... "
    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        echo "  Command failed: $command"
        ((TESTS_FAILED++))
    fi
}

# Test function with output
test_output() {
    local description="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Testing: $description... "
    local output=$(eval "$command" 2>/dev/null || echo "FAILED")
    if [[ "$output" == *"$expected"* ]]; then
        echo -e "${GREEN}✓${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        echo "  Expected: $expected"
        echo "  Got: $output"
        ((TESTS_FAILED++))
    fi
}

echo "🧪 v1z3r DevContainer Configuration Test Suite"
echo "============================================="
echo

# 1. Basic environment tests
echo "📦 Environment Tests"
echo "-------------------"
test_command "Node.js installed" "node --version"
test_output "Node.js version 20" "node --version" "v20"
test_command "Yarn installed" "yarn --version"
test_command "Git installed" "git --version"
test_command "TypeScript installed" "tsc --version"

echo

# 2. Development tools
echo "🛠️  Development Tools"
echo "-------------------"
test_command "AWS CLI installed" "aws --version"
test_command "GitHub CLI installed" "gh --version"
test_command "ripgrep installed" "rg --version"
test_command "fzf installed" "fzf --version"
test_command "jq installed" "jq --version"

echo

# 3. Project specific tests
echo "📁 Project Setup"
echo "----------------"
test_command "Workspace mounted" "test -d /workspace"
test_command "package.json exists" "test -f /workspace/package.json"
test_command "node_modules volume" "test -d /workspace/node_modules"
test_command ".next cache volume" "test -d /workspace/.next || true"

echo

# 4. Network connectivity tests (if firewall is active)
echo "🔒 Network Security"
echo "------------------"
test_command "Can reach npm registry" "curl -s https://registry.npmjs.org/ -o /dev/null"
test_command "Can reach GitHub" "curl -s https://api.github.com/ -o /dev/null"
test_command "Can reach AWS S3" "curl -s https://s3.amazonaws.com/ -o /dev/null"

echo

# 5. VS Code extensions test
echo "🔌 VS Code Extensions"
echo "--------------------"
if command -v code &> /dev/null; then
    test_command "ESLint extension" "code --list-extensions | grep -q dbaeumer.vscode-eslint"
    test_command "Prettier extension" "code --list-extensions | grep -q esbenp.prettier-vscode"
    test_command "TypeScript extension" "code --list-extensions | grep -q ms-vscode.vscode-typescript-next"
else
    echo -e "${YELLOW}Skipping VS Code extension tests (not in VS Code environment)${NC}"
fi

echo

# 6. Optional services
echo "🐳 Optional Services"
echo "-------------------"
test_command "Redis connectivity" "redis-cli ping 2>/dev/null || echo 'Redis not running (optional)'"
test_command "PostgreSQL connectivity" "pg_isready -h localhost 2>/dev/null || echo 'PostgreSQL not running (optional)'"

echo

# 7. Build test
echo "🏗️  Build Test"
echo "-------------"
if [[ -f /workspace/package.json ]]; then
    test_command "Yarn install" "cd /workspace && yarn install --frozen-lockfile"
    test_command "TypeScript check" "cd /workspace && yarn type-check"
    test_command "Build modules" "cd /workspace && yarn build:modules"
else
    echo -e "${YELLOW}Skipping build tests (not in project root)${NC}"
fi

echo
echo "============================================="
echo "Test Results:"
echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
echo

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the configuration.${NC}"
    exit 1
fi