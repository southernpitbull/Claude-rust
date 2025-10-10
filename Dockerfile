# Claude Code Docker Image
#
# Multi-stage Dockerfile for building and running Claude Code
# Optimized for size and performance

# --------------------------------------------------------------------------
# Build Stage
# --------------------------------------------------------------------------
FROM rust:1.75 AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/claude-code

# Copy manifests
COPY Cargo.toml .
COPY crates/*/Cargo.toml ./crates/

# Create dummy source files to satisfy Cargo
RUN mkdir -p crates/{agents,ai,auth,cli,core,hooks,mcp,tasks,terminal,tools,utils,web}/src && \
    echo "fn main() {}" > crates/cli/src/main.rs && \
    touch crates/{agents,ai,auth,core,hooks,mcp,tasks,terminal,tools,utils,web}/src/lib.rs && \
    touch crates/web/src/lib.rs

# Build dependencies (this speeds up rebuilds)
RUN cargo build --release --bins && \
    rm -rf crates

# Copy source code
COPY . .

# Build the application
RUN cargo build --release --bin claude-code

# --------------------------------------------------------------------------
# Runtime Stage
# --------------------------------------------------------------------------
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Create non-root user
RUN groupadd -r claude && useradd -r -g claude claude

# Create app directory
WORKDIR /home/claude/app

# Copy the binary from the build stage
COPY --from=builder /usr/src/claude-code/target/release/claude-code ./claude-code

# Create directories for config and data
RUN mkdir -p /home/claude/.claude \
    && chown -R claude:claude /home/claude

# Switch to non-root user
USER claude

# Set environment variables
ENV HOME=/home/claude
ENV CLAUDE_HOME=/home/claude/.claude
ENV PATH="/home/claude/app:$PATH"

# Expose default web server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD claude-code --help || exit 1

# Default command
ENTRYPOINT ["./claude-code"]

# Default arguments (can be overridden)
CMD ["--help"]