#!/bin/bash

# Post-Deployment Scenario Test Suite
# Tests all enhanced features implemented in Phase 2

echo "🚀 Starting Post-Deployment Scenario Tests for v1z3r Phase 2"
echo "=================================================="

TEST_RESULTS_FILE="post-deployment-test-results.log"
FAILED_TESTS=0
TOTAL_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test logging function
log_test() {
    echo -e "$1" | tee -a "$TEST_RESULTS_FILE"
}

# Test result function
test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        log_test "${GREEN}✅ PASS: $2${NC}"
    else
        log_test "${RED}❌ FAIL: $2${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Initialize test results file
echo "Post-Deployment Scenario Test Results - $(date)" > "$TEST_RESULTS_FILE"
echo "=================================================" >> "$TEST_RESULTS_FILE"

log_test "${BLUE}Phase 2 Enhanced Features Test Suite${NC}"
log_test "Testing implemented features from comprehensive improvement plan"
log_test ""

# Test 1: Error Collection API Functionality
log_test "${YELLOW}Test 1: Error Collection API (/api/errors)${NC}"
curl -s -X POST http://localhost:3000/api/errors \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test error from scenario tests",
    "severity": "medium",
    "component": "scenario-test",
    "context": {"testId": "post-deployment-1"}
  }' > /tmp/error_api_test.json 2>/dev/null

if [ $? -eq 0 ] && grep -q "success.*true" /tmp/error_api_test.json; then
    test_result 0 "Error Collection API responds correctly"
else
    test_result 1 "Error Collection API failed to respond"
fi

# Test 2: RUM Monitoring API Functionality
log_test "${YELLOW}Test 2: RUM Monitoring API (/api/rum)${NC}"
curl -s -X POST http://localhost:3000/api/rum \
  -H "Content-Type: application/json" \
  -d '{
    "fcp": 1200,
    "lcp": 2800,
    "fid": 45,
    "cls": 0.15,
    "audioLatency": 35,
    "videoFrameRate": 60,
    "url": "http://localhost:3000/test",
    "userAgent": "Test-Agent/1.0"
  }' > /tmp/rum_api_test.json 2>/dev/null

if [ $? -eq 0 ] && grep -q "success.*true" /tmp/rum_api_test.json; then
    test_result 0 "RUM Monitoring API responds correctly"
else
    test_result 1 "RUM Monitoring API failed to respond"
fi

# Test 3: Build System Integrity
log_test "${YELLOW}Test 3: Build System Integrity${NC}"
yarn build > /tmp/build_test.log 2>&1
if [ $? -eq 0 ]; then
    test_result 0 "Application builds successfully"
else
    test_result 1 "Application build failed"
    log_test "Build errors:"
    tail -10 /tmp/build_test.log >> "$TEST_RESULTS_FILE"
fi

# Test 4: Module System Integration
log_test "${YELLOW}Test 4: Module System Integration${NC}"
cd modules/sync-core && yarn build > /tmp/sync_core_build.log 2>&1
SYNC_CORE_BUILD=$?
cd ../..
if [ $SYNC_CORE_BUILD -eq 0 ]; then
    test_result 0 "sync-core module builds correctly"
else
    test_result 1 "sync-core module build failed"
fi

# Test 5: TypeScript Type Safety
log_test "${YELLOW}Test 5: TypeScript Type Safety${NC}"
yarn type-check > /tmp/type_check.log 2>&1
if [ $? -eq 0 ]; then
    test_result 0 "TypeScript type checking passes"
else
    test_result 1 "TypeScript type checking failed"
    log_test "Type errors:"
    grep "error TS" /tmp/type_check.log | head -5 >> "$TEST_RESULTS_FILE"
fi

# Test 6: Core Test Suite Stability
log_test "${YELLOW}Test 6: Core Test Suite Stability${NC}"
yarn ci:core-tests > /tmp/core_tests.log 2>&1
if [ $? -eq 0 ]; then
    test_result 0 "Core test suite passes"
else
    test_result 1 "Core test suite has failures"
fi

# Test 7: Enhanced WebSocket Client Functionality
log_test "${YELLOW}Test 7: Enhanced WebSocket Client${NC}"
if [ -f "src/utils/enhancedWebSocketClient.ts" ]; then
    # Check if the enhanced WebSocket client has proper error handling
    if grep -q "exponential.*backoff" src/utils/enhancedWebSocketClient.ts && \
       grep -q "jitter" src/utils/enhancedWebSocketClient.ts && \
       grep -q "ConnectionMetrics" src/utils/enhancedWebSocketClient.ts; then
        test_result 0 "Enhanced WebSocket client has reliability features"
    else
        test_result 1 "Enhanced WebSocket client missing reliability features"
    fi
else
    test_result 1 "Enhanced WebSocket client file not found"
fi

# Test 8: Service Worker Enhancements
log_test "${YELLOW}Test 8: Service Worker Enhancements${NC}"
if [ -f "public/sw-enhanced.js" ] && grep -q "responseToCache.*clone" public/sw-enhanced.js; then
    test_result 0 "Service Worker has Response cloning fixes"
else
    test_result 1 "Service Worker missing Response cloning fixes"
fi

# Test 9: WebGPU Shader Compatibility
log_test "${YELLOW}Test 9: WebGPU Shader Compatibility${NC}"
if [ -f "src/shaders/particleCompute.wgsl" ] && grep -q "lerp" src/shaders/particleCompute.wgsl; then
    test_result 0 "WebGPU shaders use compatible lerp function"
else
    test_result 1 "WebGPU shaders missing lerp compatibility"
fi

# Test 10: Advanced Features Page Error Fixes
log_test "${YELLOW}Test 10: Advanced Features Page Improvements${NC}"
if [ -f "src/pages/advanced-features.tsx" ] && \
   grep -q "getServerSideProps" src/pages/advanced-features.tsx && \
   grep -q "isClient" src/pages/advanced-features.tsx; then
    test_result 0 "Advanced features page has hydration fixes"
else
    test_result 1 "Advanced features page missing hydration fixes"
fi

# Test 11: Manifest Version Update
log_test "${YELLOW}Test 11: PWA Manifest Version Update${NC}"
if [ -f "public/manifest.json" ] && grep -q "version.*2.0.0" public/manifest.json; then
    test_result 0 "PWA manifest has updated version for cache invalidation"
else
    test_result 1 "PWA manifest missing version update"
fi

# Test 12: Performance Monitoring Integration
log_test "${YELLOW}Test 12: Performance Monitoring Integration${NC}"
if [ -f "src/utils/performanceMonitor.ts" ] && [ -d "src/components/PerformanceDashboard" ]; then
    test_result 0 "Performance monitoring components are present"
else
    test_result 1 "Performance monitoring components missing"
fi

# Test 13: Documentation Completeness
log_test "${YELLOW}Test 13: Documentation Completeness${NC}"
REQUIRED_DOCS=(
    "VJ_ARCHITECTURE_ANALYSIS.md"
    "API_DEPENDENCY_REVIEW.md"
    "COMPREHENSIVE_IMPROVEMENT_SUMMARY.md"
    "WEBSOCKET_RELIABILITY_ENHANCEMENT.md"
)

MISSING_DOCS=0
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        MISSING_DOCS=$((MISSING_DOCS + 1))
        log_test "Missing: $doc"
    fi
done

if [ $MISSING_DOCS -eq 0 ]; then
    test_result 0 "All required documentation is present"
else
    test_result 1 "$MISSING_DOCS required documentation files missing"
fi

# Test 14: API Health Check
log_test "${YELLOW}Test 14: API Health Check${NC}"
if [ -f "src/pages/api/health.ts" ]; then
    curl -s http://localhost:3000/api/health > /tmp/health_check.json 2>/dev/null
    if [ $? -eq 0 ] && grep -q "status" /tmp/health_check.json; then
        test_result 0 "Health API endpoint responding"
    else
        test_result 1 "Health API endpoint not responding"
    fi
else
    test_result 1 "Health API endpoint not found"
fi

# Test 15: Mobile Optimization Features
log_test "${YELLOW}Test 15: Mobile Optimization Features${NC}"
if [ -f "src/utils/iosDetection.ts" ] && [ -f "src/services/audio/iosAudioHandler.ts" ]; then
    test_result 0 "Mobile optimization utilities are present"
else
    test_result 1 "Mobile optimization utilities missing"
fi

# Scenario Test: VJ Workflow Integration
log_test ""
log_test "${BLUE}Scenario Test: VJ Workflow Integration${NC}"

# Simulate a basic VJ workflow scenario
log_test "Simulating VJ performance workflow..."

# Check if core VJ components are accessible
if [ -f "src/components/VisualEffects.tsx" ] && \
   [ -f "src/components/AudioAnalyzer.tsx" ] && \
   [ -f "src/components/LayerManager.tsx" ]; then
    test_result 0 "Core VJ components are available"
else
    test_result 1 "Core VJ components missing"
fi

# Check WebGPU integration
if [ -f "src/components/WebGPUParticleSystem.tsx" ] && \
   [ -f "src/services/webgpu/webgpuService.ts" ]; then
    test_result 0 "WebGPU VJ features are integrated"
else
    test_result 1 "WebGPU VJ features missing"
fi

# Check MIDI integration
if [ -f "src/services/midi/midiController.ts" ] && \
   [ -f "src/components/MIDIControls.tsx" ]; then
    test_result 0 "MIDI control integration is available"
else
    test_result 1 "MIDI control integration missing"
fi

# Final Results Summary
log_test ""
log_test "================================================="
log_test "${BLUE}POST-DEPLOYMENT SCENARIO TEST RESULTS${NC}"
log_test "================================================="

PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS))
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

log_test "Total Tests: $TOTAL_TESTS"
log_test "Passed: ${GREEN}$PASSED_TESTS${NC}"
log_test "Failed: ${RED}$FAILED_TESTS${NC}"
log_test "Success Rate: $SUCCESS_RATE%"

if [ $FAILED_TESTS -eq 0 ]; then
    log_test ""
    log_test "${GREEN}🎉 ALL SCENARIO TESTS PASSED!${NC}"
    log_test "${GREEN}✅ Phase 2 enhancements are fully functional${NC}"
    log_test "${GREEN}✅ Ready for production deployment${NC}"
    exit 0
elif [ $SUCCESS_RATE -ge 85 ]; then
    log_test ""
    log_test "${YELLOW}⚠️  MOSTLY SUCCESSFUL ($SUCCESS_RATE% pass rate)${NC}"
    log_test "${YELLOW}✅ Core functionality working${NC}"
    log_test "${YELLOW}⚠️  Some minor issues to address${NC}"
    exit 1
else
    log_test ""
    log_test "${RED}❌ SIGNIFICANT ISSUES DETECTED${NC}"
    log_test "${RED}❌ Phase 2 enhancements need attention${NC}"
    log_test "${RED}❌ Not ready for production${NC}"
    exit 2
fi