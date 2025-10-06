#!/bin/bash
# Claude Code Rust - Installation Script
# Supports Linux, macOS, and Windows (via Git Bash/WSL)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="anthropic/claude-code-rust"
INSTALL_DIR="${HOME}/.local/bin"
BINARY_NAME="claude-code"

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="linux";;
        Darwin*)    OS="macos";;
        CYGWIN*|MINGW*|MSYS*) OS="windows";;
        *)          OS="unknown";;
    esac
    echo "$OS"
}

# Detect architecture
detect_arch() {
    case "$(uname -m)" in
        x86_64)  ARCH="x86_64";;
        aarch64|arm64) ARCH="aarch64";;
        *)       ARCH="unknown";;
    esac
    echo "$ARCH"
}

# Check if Rust is installed
check_rust() {
    if ! command -v cargo &> /dev/null; then
        error "Rust is not installed"
        info "Install Rust from: https://rustup.rs/"
        exit 1
    fi
    success "Rust is installed: $(cargo --version)"
}

# Check if Git is installed
check_git() {
    if ! command -v git &> /dev/null; then
        error "Git is not installed"
        info "Install Git from: https://git-scm.com/"
        exit 1
    fi
    success "Git is installed: $(git --version)"
}

# Install from source
install_from_source() {
    info "Installing Claude Code Rust from source..."

    # Create temporary directory
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"

    info "Cloning repository..."
    git clone "https://github.com/${REPO}.git" .

    info "Building release binary..."
    cargo build --release --package claude-code-cli

    # Create install directory if it doesn't exist
    mkdir -p "$INSTALL_DIR"

    info "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."

    # Copy binary
    if [ "$OS" = "windows" ]; then
        cp "target/release/claude-code.exe" "${INSTALL_DIR}/${BINARY_NAME}.exe"
    else
        cp "target/release/claude-code" "${INSTALL_DIR}/${BINARY_NAME}"
        chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    fi

    # Cleanup
    cd -
    rm -rf "$TMP_DIR"

    success "Claude Code Rust installed successfully!"
}

# Check if install directory is in PATH
check_path() {
    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        warning "${INSTALL_DIR} is not in your PATH"
        echo ""
        echo "Add the following to your shell configuration file:"
        echo ""

        if [ -f "$HOME/.bashrc" ]; then
            echo "  echo 'export PATH=\"\$PATH:${INSTALL_DIR}\"' >> ~/.bashrc"
        elif [ -f "$HOME/.zshrc" ]; then
            echo "  echo 'export PATH=\"\$PATH:${INSTALL_DIR}\"' >> ~/.zshrc"
        else
            echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
        fi

        echo ""
        echo "Then reload your shell or run:"
        echo "  source ~/.bashrc  # or ~/.zshrc"
        echo ""
    else
        success "${INSTALL_DIR} is in your PATH"
    fi
}

# Verify installation
verify_installation() {
    info "Verifying installation..."

    BINARY_PATH="${INSTALL_DIR}/${BINARY_NAME}"
    if [ "$OS" = "windows" ]; then
        BINARY_PATH="${BINARY_PATH}.exe"
    fi

    if [ -f "$BINARY_PATH" ]; then
        success "Binary installed at: ${BINARY_PATH}"

        # Try to run it
        if command -v "${BINARY_NAME}" &> /dev/null; then
            VERSION=$("${BINARY_NAME}" --version 2>&1 || echo "unknown")
            success "Claude Code Rust ${VERSION}"
        fi
    else
        error "Installation verification failed"
        exit 1
    fi
}

# Main installation process
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Claude Code Rust - Installation"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Detect system
    OS=$(detect_os)
    ARCH=$(detect_arch)

    info "Detected OS: ${OS}"
    info "Detected Architecture: ${ARCH}"
    echo ""

    if [ "$OS" = "unknown" ] || [ "$ARCH" = "unknown" ]; then
        error "Unsupported system: ${OS} ${ARCH}"
        exit 1
    fi

    # Check prerequisites
    info "Checking prerequisites..."
    check_rust
    check_git
    echo ""

    # Install
    install_from_source
    echo ""

    # Verify
    verify_installation
    echo ""

    # Check PATH
    check_path

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    success "Installation complete!"
    echo ""
    echo "Get started with:"
    echo "  ${BINARY_NAME} --help"
    echo "  ${BINARY_NAME} auth login"
    echo ""
    echo "For more information:"
    echo "  https://github.com/${REPO}"
    echo ""
}

# Run main installation
main "$@"
