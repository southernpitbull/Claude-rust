#!/bin/bash
# Example security scanning hook
# Hook type: pre-push
# Description: Run security audit before pushing

set -e

echo "Running security audit..."

# Check if cargo-audit is available
if ! command -v cargo-audit &> /dev/null; then
    echo "Warning: cargo-audit not installed. Install with: cargo install cargo-audit"
    echo "Skipping security audit..."
    exit 0
fi

# Run cargo audit
echo "Checking for known security vulnerabilities..."
cargo audit

# Check for outdated dependencies with security issues
echo "Checking dependency versions..."
cargo audit --deny warnings || {
    echo "Warning: Security vulnerabilities found in dependencies"
    echo "Run 'cargo audit' for details"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
}

echo "✓ Security scan complete!"
exit 0
