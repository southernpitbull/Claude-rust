# AIrchitect CLI Makefile
# This Makefile provides common build tasks for the multi-language project

# Variables
RUST_TARGET_DIR = target
TS_DIST_DIR = dist
PYTHON_VENV_DIR = venv
PLUGIN_DIR = plugins

# Default target
.PHONY: all
all: build

# Build all components
.PHONY: build
build: build-rust build-ts build-python

# Build Rust components
.PHONY: build-rust
build-rust:
	@echo "Building Rust components..."
	cargo build --release
	@echo "Rust components built successfully!"

# Build TypeScript components
.PHONY: build-ts
build-ts:
	@echo "Building TypeScript components..."
	npm run build
	@echo "TypeScript components built successfully!"

# Build Python components
.PHONY: build-python
build-python:
	@echo "Building Python components..."
	cd $(PLUGIN_DIR) && poetry build
	@echo "Python components built successfully!"

# Install dependencies
.PHONY: install
install: install-rust install-ts install-python

# Install Rust dependencies
.PHONY: install-rust
install-rust:
	@echo "Installing Rust dependencies..."
	cargo check
	@echo "Rust dependencies installed!"

# Install TypeScript dependencies
.PHONY: install-ts
install-ts:
	@echo "Installing TypeScript dependencies..."
	npm install
	@echo "TypeScript dependencies installed!"

# Install Python dependencies
.PHONY: install-python
install-python:
	@echo "Installing Python dependencies..."
	cd $(PLUGIN_DIR) && poetry install
	@echo "Python dependencies installed!"

# Set up Python virtual environment
.PHONY: setup-python-venv
setup-python-venv:
	@echo "Setting up Python virtual environment..."
	python3 -m venv $(PYTHON_VENV_DIR)
	@echo "Python virtual environment set up!"

# Activate Python virtual environment
.PHONY: activate-python-venv
activate-python-venv:
	@echo "Activating Python virtual environment..."
	@echo "Run: source $(PYTHON_VENV_DIR)/bin/activate (Unix) or $(PYTHON_VENV_DIR)\\Scripts\\activate (Windows)"

# Clean build artifacts
.PHONY: clean
clean: clean-rust clean-ts clean-python

# Clean Rust build artifacts
.PHONY: clean-rust
clean-rust:
	@echo "Cleaning Rust build artifacts..."
	cargo clean
	@echo "Rust build artifacts cleaned!"

# Clean TypeScript build artifacts
.PHONY: clean-ts
clean-ts:
	@echo "Cleaning TypeScript build artifacts..."
	rm -rf $(TS_DIST_DIR)
	@echo "TypeScript build artifacts cleaned!"

# Clean Python build artifacts
.PHONY: clean-python
clean-python:
	@echo "Cleaning Python build artifacts..."
	cd $(PLUGIN_DIR) && rm -rf build dist *.egg-info
	@echo "Python build artifacts cleaned!"

# Run tests
.PHONY: test
test: test-rust test-ts test-python

# Run Rust tests
.PHONY: test-rust
test-rust:
	@echo "Running Rust tests..."
	cargo test
	@echo "Rust tests completed!"

# Run TypeScript tests
.PHONY: test-ts
test-ts:
	@echo "Running TypeScript tests..."
	npm test
	@echo "TypeScript tests completed!"

# Run Python tests
.PHONY: test-python
test-python:
	@echo "Running Python tests..."
	cd $(PLUGIN_DIR) && poetry run pytest
	@echo "Python tests completed!"

# Lint code
.PHONY: lint
lint: lint-rust lint-ts lint-python

# Lint Rust code
.PHONY: lint-rust
lint-rust:
	@echo "Linting Rust code..."
	cargo clippy
	@echo "Rust code linted!"

# Lint TypeScript code
.PHONY: lint-ts
lint-ts:
	@echo "Linting TypeScript code..."
	npm run lint
	@echo "TypeScript code linted!"

# Lint Python code
.PHONY: lint-python
lint-python:
	@echo "Linting Python code..."
	cd $(PLUGIN_DIR) && poetry run flake8 .
	cd $(PLUGIN_DIR) && poetry run black --check .
	@echo "Python code linted!"

# Format code
.PHONY: format
format: format-rust format-ts format-python

# Format Rust code
.PHONY: format-rust
format-rust:
	@echo "Formatting Rust code..."
	cargo fmt
	@echo "Rust code formatted!"

# Format TypeScript code
.PHONY: format-ts
format-ts:
	@echo "Formatting TypeScript code..."
	npm run format
	@echo "TypeScript code formatted!"

# Format Python code
.PHONY: format-python
format-python:
	@echo "Formatting Python code..."
	cd $(PLUGIN_DIR) && poetry run black .
	cd $(PLUGIN_DIR) && poetry run isort .
	@echo "Python code formatted!"

# Run the application
.PHONY: run
run: run-rust

# Run the Rust application
.PHONY: run-rust
run-rust:
	@echo "Running AIrchitect CLI..."
	cargo run --release

# Run the TypeScript application
.PHONY: run-ts
run-ts:
	@echo "Running TypeScript frontend..."
	node $(TS_DIST_DIR)/index.js

# Run the Python plugin system
.PHONY: run-python
run-python:
	@echo "Running Python plugin system..."
	cd $(PLUGIN_DIR) && poetry run python -m ai_cli_python

# Create distribution packages
.PHONY: dist
dist: dist-rust dist-ts dist-python

# Create Rust distribution
.PHONY: dist-rust
dist-rust:
	@echo "Creating Rust distribution..."
	cargo build --release
	@echo "Rust distribution created!"

# Create TypeScript distribution
.PHONY: dist-ts
dist-ts:
	@echo "Creating TypeScript distribution..."
	npm run build
	@echo "TypeScript distribution created!"

# Create Python distribution
.PHONY: dist-python
dist-python:
	@echo "Creating Python distribution..."
	cd $(PLUGIN_DIR) && poetry build
	@echo "Python distribution created!"

# Install in development mode
.PHONY: dev
dev: install-dev link-dev

# Install development dependencies
.PHONY: install-dev
install-dev: install-rust install-ts install-python
	@echo "Installing development dependencies..."
	cd $(PLUGIN_DIR) && poetry install --with dev
	npm install --save-dev
	@echo "Development dependencies installed!"

# Link packages for development
.PHONY: link-dev
link-dev:
	@echo "Linking packages for development..."
	cd $(PLUGIN_DIR) && poetry develop
	npm link
	@echo "Packages linked for development!"

# Show help
.PHONY: help
help:
	@echo "AIrchitect CLI Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  all              Build all components"
	@echo "  build            Build all components"
	@echo "  build-rust       Build Rust components"
	@echo "  build-ts         Build TypeScript components"
	@echo "  build-python     Build Python components"
	@echo "  install          Install all dependencies"
	@echo "  install-rust     Install Rust dependencies"
	@echo "  install-ts       Install TypeScript dependencies"
	@echo "  install-python   Install Python dependencies"
	@echo "  clean            Clean all build artifacts"
	@echo "  clean-rust       Clean Rust build artifacts"
	@echo "  clean-ts         Clean TypeScript build artifacts"
	@echo "  clean-python     Clean Python build artifacts"
	@echo "  test             Run all tests"
	@echo "  test-rust        Run Rust tests"
	@echo "  test-ts          Run TypeScript tests"
	@echo "  test-python      Run Python tests"
	@echo "  lint             Lint all code"
	@echo "  lint-rust        Lint Rust code"
	@echo "  lint-ts          Lint TypeScript code"
	@echo "  lint-python      Lint Python code"
	@echo "  format           Format all code"
	@echo "  format-rust      Format Rust code"
	@echo "  format-ts        Format TypeScript code"
	@echo "  format-python    Format Python code"
	@echo "  run              Run the application"
	@echo "  run-rust         Run the Rust application"
	@echo "  run-ts           Run the TypeScript application"
	@echo "  run-python       Run the Python plugin system"
	@echo "  dist             Create distribution packages"
	@echo "  dist-rust        Create Rust distribution"
	@echo "  dist-ts          Create TypeScript distribution"
	@echo "  dist-python      Create Python distribution"
	@echo "  dev              Install in development mode"
	@echo "  help             Show this help"

.DEFAULT_GOAL := help