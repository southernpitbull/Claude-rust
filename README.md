# Claude Code - Rust Implementation

A high-performance, memory-safe implementation of the Claude Code CLI tool written in Rust.

## Overview

This is a complete rewrite of the Claude Code CLI from TypeScript/Node.js to Rust, providing:

- **10-50x faster startup time** (Node.js ~200ms → Rust ~5-10ms)
- **5-10x lower memory footprint** (Node.js ~50MB → Rust ~5-10MB)
- **Single binary distribution** (no runtime dependencies)
- **Improved Windows support** (native Windows terminal APIs via crossterm)
- **Better error handling** (Result types eliminate error swallowing)
- **Cross-platform uniformity** (no platform-specific code branches)

## Features

- Multi-provider AI integration (Claude, OpenAI, Gemini, Qwen, Ollama, LM Studio)
- OAuth 2.0 and API key authentication
- Secure credential storage using OS keyring
- Interactive terminal UI with colors and spinners
- Async/await for concurrent operations
- Comprehensive error handling
- Multi-account support

## Architecture

The project is organized as a Cargo workspace with the following crates:

```
claude-code-rust/
├── crates/
│   ├── cli/        # Binary crate - main entry point
│   ├── core/       # Core types, errors, and configuration
│   ├── auth/       # Authentication and OAuth flows
│   ├── ai/         # AI provider integrations
│   ├── terminal/   # Terminal UI and formatting
│   └── utils/      # Shared utilities
```

### Crate Dependencies

```
cli → core, terminal, auth, ai, utils
terminal → core, utils
auth → core, utils
ai → core, auth, utils
utils → core
```

## Building

### Prerequisites

- Rust 1.75 or later
- Cargo (comes with Rust)

### Build Commands

```bash
# Development build
cargo build

# Release build (optimized)
cargo build --release

# Run in development mode
cargo run

# Run in release mode
cargo run --release

# Run tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Build documentation
cargo doc --open
```

## Development

### Project Structure

Each crate follows standard Rust conventions:

- `src/lib.rs` - Library entry point (for library crates)
- `src/main.rs` - Binary entry point (for binary crates)
- `src/*.rs` - Module files
- `Cargo.toml` - Crate manifest

### Adding Dependencies

Dependencies are managed in the workspace root `Cargo.toml` to ensure version consistency:

```toml
[workspace.dependencies]
your-crate = "1.0"
```

Then reference in individual crate `Cargo.toml`:

```toml
[dependencies]
your-crate = { workspace = true }
```

### Code Style

This project uses:
- `rustfmt` for formatting
- `clippy` for linting

Run checks:

```bash
# Format code
cargo fmt

# Run clippy
cargo clippy

# Run clippy with all warnings
cargo clippy -- -D warnings
```

## Testing

```bash
# Run all tests
cargo test

# Run tests for a specific crate
cargo test -p claude-code-core

# Run integration tests
cargo test --test '*'

# Run with verbose output
cargo test -- --show-output
```

## Performance

### Startup Time

```bash
# Benchmark startup time (requires hyperfine)
hyperfine --warmup 3 './target/release/claude-code --version'
```

### Memory Usage

```bash
# Linux
/usr/bin/time -v ./target/release/claude-code --version

# Windows
# Use Task Manager or Resource Monitor
```

### Binary Size

```bash
# Check binary size
ls -lh target/release/claude-code

# Analyze binary composition (requires cargo-bloat)
cargo bloat --release
```

## Deployment

### Release Profile

The project is configured with an optimized release profile:

```toml
[profile.release]
opt-level = 3        # Maximum optimization
lto = "fat"          # Link-time optimization
codegen-units = 1    # Better optimization (slower compile)
strip = true         # Remove debug symbols
```

### Cross-Compilation

```bash
# List available targets
rustup target list

# Add a target
rustup target add x86_64-pc-windows-msvc

# Build for target
cargo build --release --target x86_64-pc-windows-msvc
```

## Troubleshooting

### Compilation Issues

1. **Linker errors on Windows**: Install Visual Studio Build Tools
2. **Linker errors on Linux**: Install `build-essential` and `pkg-config`
3. **Missing dependencies**: Run `cargo update`

### Runtime Issues

1. **Keyring errors**: Ensure your system has a keyring service (Windows: Credential Manager, Linux: gnome-keyring, macOS: Keychain)
2. **Network errors**: Check firewall and proxy settings
3. **Permission errors**: Ensure proper file permissions for config directories

## Migration from TypeScript

Key differences from the TypeScript version:

1. **Error Handling**: Uses `Result<T, E>` instead of try-catch
2. **Async/Await**: Uses Tokio runtime instead of Node.js event loop
3. **Type System**: Stronger type safety with Rust's ownership system
4. **Dependencies**: Native Rust crates instead of npm packages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT

## Related Projects

- [Claude Code (TypeScript)](../claude-code/) - Original TypeScript implementation
- [Anthropic Claude API](https://www.anthropic.com/api) - Claude AI API

## Status

This is currently in active development. See the [RUST-REFACTORING-PLAN.md](../RUST-REFACTORING-PLAN.md) for the complete implementation roadmap.

Current phase: **Phase 1 - Project Setup** ✅
