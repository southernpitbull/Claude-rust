#!/bin/bash
# Example linting hook
# Hook type: pre-commit
# Description: Run linting on staged files before commit

set -e

echo "Running linting checks..."

# Check if clippy is available
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo not found"
    exit 1
fi

# Run clippy on the project
echo "Running cargo clippy..."
cargo clippy --all-targets --all-features -- -D warnings

# Check formatting
echo "Checking code formatting..."
cargo fmt --all -- --check

echo "✓ All linting checks passed!"
exit 0
