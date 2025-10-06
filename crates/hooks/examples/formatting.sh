#!/bin/bash
# Example formatting hook
# Hook type: pre-commit
# Description: Auto-format code before commit

set -e

echo "Running code formatting..."

# Check if rustfmt is available
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo not found"
    exit 1
fi

# Format all Rust code
echo "Formatting Rust code..."
cargo fmt --all

# Add formatted files to staging
echo "Adding formatted files to staging area..."
git add -u

echo "✓ Code formatting complete!"
exit 0
