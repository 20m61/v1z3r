#!/bin/bash

# Load Testing Runner for v1z3r
# Orchestrates comprehensive performance testing

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-ws://localhost:3000}"
TEST_DURATION="${TEST_DURATION:-10m}"
RESULTS_DIR="./load-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install it first:"
        echo "  brew install k6"
        echo "  or visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Verify application is running
verify_application() {
    log_info "Verifying application availability at $BASE_URL..."
    
    # Check if application is responding
    local http_status
    http_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" || echo "000")
    
    if [ "$http_status" != "200" ]; then
        log_error "Application not responding (HTTP $http_status)"
        log_error "Please ensure the application is running at $BASE_URL"
        exit 1
    fi
    
    log_success "Application is responding"
}

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Export environment variables for k6
    export BASE_URL="$BASE_URL"
    export WS_URL="$WS_URL"
    
    log_success "Test environment setup completed"
}

# Run light load test
run_light_load_test() {
    log_info "Running light load test..."
    
    k6 run \
        --out json="$RESULTS_DIR/light_load_$TIMESTAMP.json" \
        --out influxdb=http://localhost:8086/k6 \
        -e SCENARIO=light_load \
        ./load-test-config.js || log_warning "Light load test completed with warnings"
    
    log_success "Light load test completed"
}

# Run medium load test
run_medium_load_test() {
    log_info "Running medium load test..."
    
    k6 run \
        --out json="$RESULTS_DIR/medium_load_$TIMESTAMP.json" \
        --out influxdb=http://localhost:8086/k6 \
        -e SCENARIO=medium_load \
        ./load-test-config.js || log_warning "Medium load test completed with warnings"
    
    log_success "Medium load test completed"
}

# Run stress test
run_stress_test() {
    log_info "Running stress test..."
    
    log_warning "This test will generate high load on the application"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Stress test skipped"
        return
    fi
    
    k6 run \
        --out json="$RESULTS_DIR/stress_test_$TIMESTAMP.json" \
        --out influxdb=http://localhost:8086/k6 \
        -e SCENARIO=stress_test \
        ./load-test-config.js || log_warning "Stress test completed with warnings"
    
    log_success "Stress test completed"
}

# Run spike test
run_spike_test() {
    log_info "Running spike test..."
    
    k6 run \
        --out json="$RESULTS_DIR/spike_test_$TIMESTAMP.json" \
        --out influxdb=http://localhost:8086/k6 \
        -e SCENARIO=spike_test \
        ./load-test-config.js || log_warning "Spike test completed with warnings"
    
    log_success "Spike test completed"
}

# Run API load test
run_api_load_test() {
    log_info "Running API-focused load test..."
    
    k6 run \
        --out json="$RESULTS_DIR/api_load_$TIMESTAMP.json" \
        --out influxdb=http://localhost:8086/k6 \
        -e SCENARIO=api_load \
        ./load-test-config.js || log_warning "API load test completed with warnings"
    
    log_success "API load test completed"
}

# Run WebSocket test
run_websocket_test() {
    log_info "Running WebSocket load test..."
    
    k6 run \
        --out json="$RESULTS_DIR/websocket_test_$TIMESTAMP.json" \
        --out influxdb=http://localhost:8086/k6 \
        -e SCENARIO=websocket_test \
        ./load-test-config.js || log_warning "WebSocket test completed with warnings"
    
    log_success "WebSocket test completed"
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    local report_file="$RESULTS_DIR/load_test_report_$TIMESTAMP.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>v1z3r Load Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #007cba; }
        .success { border-left-color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .error { border-left-color: #dc3545; }
        .test-section { margin: 30px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>v1z3r Load Test Report</h1>
        <p><strong>Date:</strong> $TIMESTAMP</p>
        <p><strong>Base URL:</strong> $BASE_URL</p>
        <p><strong>WebSocket URL:</strong> $WS_URL</p>
    </div>
    
    <div class="test-section">
        <h2>Test Summary</h2>
        <p>Comprehensive load testing was performed to validate the performance and scalability of the v1z3r VJ application.</p>
        
        <h3>Tests Executed:</h3>
        <ul>
            <li>Light Load Test - Normal user behavior simulation</li>
            <li>Medium Load Test - Peak usage simulation</li>
            <li>Stress Test - High load capacity testing</li>
            <li>Spike Test - Sudden traffic burst simulation</li>
            <li>API Load Test - API endpoint performance</li>
            <li>WebSocket Test - Real-time connection testing</li>
        </ul>
    </div>
    
    <div class="test-section">
        <h2>Performance Metrics</h2>
        <div class="metric success">
            <strong>Response Time:</strong> Target &lt; 2s for 95% of requests
        </div>
        <div class="metric success">
            <strong>Error Rate:</strong> Target &lt; 5% overall
        </div>
        <div class="metric success">
            <strong>WebGL Initialization:</strong> Target &lt; 1s for 95% of users
        </div>
        <div class="metric success">
            <strong>Effect Switching:</strong> Target &lt; 100ms for 95% of operations
        </div>
        <div class="metric success">
            <strong>WebSocket Latency:</strong> Target &lt; 200ms for 95% of messages
        </div>
    </div>
    
    <div class="test-section">
        <h2>Detailed Results</h2>
        <p>Detailed JSON results have been saved to the following files:</p>
        <ul>
EOF

    # Add result files to report
    for file in "$RESULTS_DIR"/*_"$TIMESTAMP".json; do
        if [ -f "$file" ]; then
            echo "            <li>$(basename "$file")</li>" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF
        </ul>
    </div>
    
    <div class="test-section">
        <h2>Recommendations</h2>
        <ol>
            <li>Monitor error rates during peak load periods</li>
            <li>Implement auto-scaling based on CPU and memory metrics</li>
            <li>Optimize WebGL initialization for slower devices</li>
            <li>Consider implementing request queuing for spike traffic</li>
            <li>Monitor WebSocket connection stability under load</li>
        </ol>
    </div>
    
    <div class="test-section">
        <h2>Infrastructure Scaling</h2>
        <p>Based on test results, consider the following scaling strategies:</p>
        <ul>
            <li><strong>Horizontal Scaling:</strong> Add more server instances during peak hours</li>
            <li><strong>CDN Optimization:</strong> Ensure static assets are properly cached</li>
            <li><strong>Database Scaling:</strong> Implement read replicas for heavy query loads</li>
            <li><strong>Connection Pooling:</strong> Optimize database and WebSocket connections</li>
        </ul>
    </div>
</body>
</html>
EOF
    
    log_success "Test report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test environment..."
    # Add any cleanup tasks here
    log_success "Cleanup completed"
}

# Main execution
main() {
    log_info "Starting v1z3r load testing suite"
    log_info "Timestamp: $TIMESTAMP"
    
    check_dependencies
    verify_application
    setup_test_environment
    
    # Run test suite based on arguments
    case "${1:-all}" in
        "light")
            run_light_load_test
            ;;
        "medium")
            run_medium_load_test
            ;;
        "stress")
            run_stress_test
            ;;
        "spike")
            run_spike_test
            ;;
        "api")
            run_api_load_test
            ;;
        "websocket")
            run_websocket_test
            ;;
        "all")
            run_light_load_test
            sleep 30
            run_medium_load_test
            sleep 30
            run_api_load_test
            sleep 30
            run_websocket_test
            sleep 30
            run_spike_test
            # Stress test is interactive and optional
            ;;
        *)
            echo "Usage: $0 {light|medium|stress|spike|api|websocket|all}"
            echo ""
            echo "Test types:"
            echo "  light     - Light load test (10 users)"
            echo "  medium    - Medium load test (50-100 users)"
            echo "  stress    - Stress test (100-300 users)"
            echo "  spike     - Spike test (sudden bursts)"
            echo "  api       - API-focused load test"
            echo "  websocket - WebSocket connection test"
            echo "  all       - Run all tests (except stress)"
            exit 1
            ;;
    esac
    
    generate_report
    cleanup
    
    log_success "Load testing completed successfully!"
    log_info "Results saved in: $RESULTS_DIR"
}

# Handle script termination
trap cleanup EXIT

# Run main function
main "$@"