#!/bin/bash

# Docker Environment Setup Script for v1z3r VJ Application
set -e

echo "🚀 Setting up Docker environment for v1z3r VJ Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to build and start services
start_production() {
    print_status "Building and starting production environment..."
    docker-compose build v1z3r-app
    docker-compose up -d v1z3r-app
    print_status "Production environment started on http://localhost:3000"
}

start_development() {
    print_status "Building and starting development environment..."
    docker-compose --profile dev build v1z3r-dev
    docker-compose --profile dev up -d v1z3r-dev
    print_status "Development environment started on http://localhost:3001"
}

start_full_stack() {
    print_status "Building and starting full stack with Nginx..."
    docker-compose --profile production build
    docker-compose --profile production up -d
    print_status "Full stack environment started on http://localhost"
}

# Function to show status
show_status() {
    print_status "Container status:"
    docker-compose ps
    echo ""
    print_status "Health checks:"
    docker-compose exec v1z3r-app wget -qO- http://localhost:3000/api/health 2>/dev/null || print_warning "Health check failed"
}

# Function to show logs
show_logs() {
    docker-compose logs -f
}

# Function to stop services
stop_services() {
    print_status "Stopping all services..."
    docker-compose --profile dev --profile production down
    print_status "All services stopped."
}

# Function to clean up
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose --profile dev --profile production down -v --rmi all
    docker system prune -f
    print_status "Cleanup completed."
}

# Function to run tests in container
run_tests() {
    print_status "Running tests in container..."
    docker-compose exec v1z3r-app yarn test
}

# Main menu
case "${1:-help}" in
    "prod"|"production")
        start_production
        show_status
        ;;
    "dev"|"development")
        start_development
        show_status
        ;;
    "full"|"fullstack")
        start_full_stack
        show_status
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "stop")
        stop_services
        ;;
    "test")
        run_tests
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|*)
        echo "🐳 v1z3r Docker Environment Manager"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  prod, production  - Start production environment (port 3000)"
        echo "  dev, development  - Start development environment (port 3001)"
        echo "  full, fullstack   - Start full stack with Nginx (port 80)"
        echo "  status           - Show container status and health"
        echo "  logs             - Show container logs"
        echo "  test             - Run tests in container"
        echo "  stop             - Stop all services"
        echo "  cleanup          - Clean up all Docker resources"
        echo "  help             - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 prod          # Start production environment"
        echo "  $0 dev           # Start development environment"
        echo "  $0 status        # Check service status"
        echo "  $0 logs          # View logs"
        ;;
esac