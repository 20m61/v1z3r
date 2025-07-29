#!/bin/bash
# Container initialization script for v1z3r devcontainer
# Simplified version without complex firewall rules

set -euo pipefail

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Initializing v1z3r development container..."

# Ensure proper ownership of workspace
if [[ -d /workspace ]]; then
    log "Setting workspace permissions..."
    # Only fix obvious permission issues, don't force chown everything
    if [[ ! -w /workspace ]]; then
        sudo chown -R vscode:vscode /workspace 2>/dev/null || true
    fi
fi

# Create necessary cache directories
log "Setting up cache directories..."
mkdir -p ~/.cache/yarn ~/.config ~/.local/share

# Set up git configuration (safe defaults)
log "Configuring git defaults..."
git config --global init.defaultBranch main 2>/dev/null || true
git config --global pull.rebase false 2>/dev/null || true
git config --global fetch.prune true 2>/dev/null || true

# Wait for services to be ready
log "Waiting for services..."
if command -v wait-on >/dev/null 2>&1; then
    # Wait for Redis and PostgreSQL if they're available
    timeout 30s wait-on tcp:redis:6379 2>/dev/null || log "Redis not available (optional)"
    timeout 30s wait-on tcp:postgres:5432 2>/dev/null || log "PostgreSQL not available (optional)"
else
    sleep 2
fi

# Test basic connectivity
log "Testing basic connectivity..."
if curl -s --max-time 5 https://registry.npmjs.org/ >/dev/null 2>&1; then
    log "✓ npm registry accessible"
else
    log "⚠ npm registry may not be accessible"
fi

if curl -s --max-time 5 https://api.github.com/ >/dev/null 2>&1; then
    log "✓ GitHub API accessible"
else
    log "⚠ GitHub API may not be accessible"
fi

log "Container initialization complete"

# Start the main development environment
log "Starting development environment..."
exec "$@"