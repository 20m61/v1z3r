#!/bin/bash
# Firewall initialization script for v1z3r devcontainer
# Based on Anthropic's security recommendations

set -euo pipefail

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Check if running as root (required for iptables)
if [[ $EUID -ne 0 ]]; then
   log "Warning: This script should be run as root for firewall configuration"
   exit 0
fi

log "Initializing firewall rules for v1z3r devcontainer..."

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# Set default policies - deny all by default
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow loopback traffic
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS (required for package installation and AWS services)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow HTTPS outbound (for npm, yarn, git, AWS)
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# Allow HTTP outbound (for some package registries)
iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT

# Allow Git SSH
iptables -A OUTPUT -p tcp --dport 22 -d github.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -d gitlab.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -d bitbucket.org -j ACCEPT

# Allow development server (internal only)
iptables -A INPUT -p tcp --dport 3000 -s 127.0.0.1 -j ACCEPT
iptables -A OUTPUT -p tcp --sport 3000 -d 127.0.0.1 -j ACCEPT

# Allow Redis (internal only)
iptables -A INPUT -p tcp --dport 6379 -s 127.0.0.1 -j ACCEPT
iptables -A OUTPUT -p tcp --sport 6379 -d 127.0.0.1 -j ACCEPT

# AWS services whitelist
# DynamoDB
iptables -A OUTPUT -p tcp --dport 443 -d dynamodb.*.amazonaws.com -j ACCEPT
# S3
iptables -A OUTPUT -p tcp --dport 443 -d s3.*.amazonaws.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d *.s3.*.amazonaws.com -j ACCEPT
# Lambda
iptables -A OUTPUT -p tcp --dport 443 -d lambda.*.amazonaws.com -j ACCEPT
# CloudFormation (for CDK)
iptables -A OUTPUT -p tcp --dport 443 -d cloudformation.*.amazonaws.com -j ACCEPT
# STS (for authentication)
iptables -A OUTPUT -p tcp --dport 443 -d sts.*.amazonaws.com -j ACCEPT

# NPM/Yarn registries
iptables -A OUTPUT -p tcp --dport 443 -d registry.npmjs.org -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d registry.yarnpkg.com -j ACCEPT

# GitHub API and raw content
iptables -A OUTPUT -p tcp --dport 443 -d api.github.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d raw.githubusercontent.com -j ACCEPT

# Log dropped packets (for debugging)
iptables -A INPUT -j LOG --log-prefix "DROPPED INPUT: " --log-level 4
iptables -A OUTPUT -j LOG --log-prefix "DROPPED OUTPUT: " --log-level 4

log "Firewall rules initialized successfully"

# Save rules (Debian/Ubuntu)
if command -v iptables-save &> /dev/null; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
fi

# Validate critical rules
log "Validating firewall rules..."
if iptables -L OUTPUT -n | grep -q "443.*ACCEPT"; then
    log "✓ HTTPS outbound allowed"
else
    log "✗ Warning: HTTPS outbound may be blocked"
fi

if iptables -L INPUT -n | grep -q "3000.*ACCEPT"; then
    log "✓ Development server port accessible"
else
    log "✗ Warning: Development server port may not be accessible"
fi

log "Firewall initialization complete"