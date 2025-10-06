#!/bin/bash
# Example testing hook
# Hook type: pre-push
# Description: Run tests before pushing to remote

set -e

echo "Running test suite..."

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo not found"
    exit 1
fi

# Run all tests
echo "Running cargo test..."
cargo test --all --all-features

# Run doc tests
echo "Running documentation tests..."
cargo test --doc

echo "✓ All tests passed!"
exit 0
