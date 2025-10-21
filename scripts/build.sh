#!/bin/bash

# AIrchitect CLI Build Script
# This script builds all components of the AIrchitect CLI system

set -e  # Exit on any error

echo "=== AIrchitect CLI Build Script ==="
echo "Building multi-language components..."
echo

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command_exists rustc; then
    echo "Error: Rust compiler (rustc) not found"
    echo "Please install Rust from https://rustup.rs/"
    exit 1
fi

if ! command_exists node; then
    echo "Error: Node.js not found"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

if ! command_exists python3; then
    echo "Error: Python 3 not found"
    echo "Please install Python 3 from https://www.python.org/"
    exit 1
fi

if ! command_exists cargo; then
    echo "Error: Cargo not found"
    echo "Please install Rust with Cargo from https://rustup.rs/"
    exit 1
fi

echo "All prerequisites found!"
echo

# Build Rust components
echo "Building Rust components..."
cargo build --release
echo "Rust components built successfully!"
echo

# Build TypeScript components
echo "Building TypeScript components..."
npm run build
echo "TypeScript components built successfully!"
echo

# Set up Python environment
echo "Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate  # On Windows, use venv\Scripts\activate
pip install -e .
echo "Python environment set up successfully!"
echo

# Build Python bindings
echo "Building Python bindings..."
cd bindings/python
maturin develop
cd ../..
echo "Python bindings built successfully!"
echo

# Create distribution directories
echo "Creating distribution directories..."
mkdir -p dist/bin
mkdir -p dist/lib
mkdir -p dist/plugins
echo "Distribution directories created!"
echo

# Copy binaries
echo "Copying binaries..."
cp target/release/ai-cli-core dist/bin/
cp target/release/ai-cli-* dist/bin/
echo "Binaries copied!"
echo

# Copy TypeScript bundles
echo "Copying TypeScript bundles..."
cp -r dist/* dist/
echo "TypeScript bundles copied!"
echo

# Copy Python packages
echo "Copying Python packages..."
cp -r plugins/* dist/plugins/
echo "Python packages copied!"
echo

echo "=== Build Complete ==="
echo "AIrchitect CLI has been built successfully!"
echo
echo "To run the application:"
echo "  ./dist/bin/ai-cli-core --help"
echo
echo "To install globally:"
echo "  cd dist && pip install ."
echo "  npm install -g ."
echo