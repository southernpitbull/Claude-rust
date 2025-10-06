# Contributing to Claude Code Rust

Thank you for your interest in contributing to Claude Code Rust! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-code-rust.git
   cd claude-code-rust
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/anthropic/claude-code-rust.git
   ```

## Development Setup

### Prerequisites

- **Rust 1.70+**: Install via [rustup](https://rustup.rs/)
- **Git**: For version control
- **Build tools**: Platform-specific (see below)

#### Platform-Specific Requirements

**Windows:**
- Visual Studio Build Tools or MinGW
- PowerShell 5.1+

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Linux:**
- Build essentials: `sudo apt install build-essential` (Debian/Ubuntu)

### Building the Project

```bash
# Build all crates
cargo build

# Build with optimizations
cargo build --release

# Build a specific crate
cargo build --package claude-code-cli
```

### Running Tests

```bash
# Run all tests
cargo test --all

# Run tests for a specific crate
cargo test --package claude-code-core

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

### Running the CLI

```bash
# Development build
cargo run -- auth login

# Release build
cargo run --release -- ask "What is Rust?"
```

## Project Structure

```
claude-code-rust/
├── crates/
│   ├── cli/          # Main CLI application
│   ├── core/         # Core functionality
│   ├── ai/           # AI provider integrations
│   ├── auth/         # Authentication system
│   ├── terminal/     # Terminal UI components
│   ├── utils/        # Utility functions
│   ├── mcp/          # Model Context Protocol
│   ├── hooks/        # Lifecycle hooks
│   ├── tasks/        # Background tasks
│   ├── agents/       # Agent system
│   └── tools/        # Tool execution system
├── Cargo.toml        # Workspace configuration
├── README.md         # Project documentation
└── todo.md           # Implementation tracking
```

### Key Crates

- **cli**: Entry point, command parsing, handlers
- **core**: Error handling, file ops, execution, sessions
- **ai**: Multi-provider AI client (Claude, OpenAI, Gemini, etc.)
- **auth**: OAuth flows, token management, credential storage
- **terminal**: Formatting, spinners, tables, prompts
- **tools**: Tool registry, execution, permissions

## Making Changes

### Creating a Feature Branch

```bash
# Update your fork
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/my-new-feature
```

### Development Workflow

1. **Make your changes** in logical commits
2. **Write or update tests** for your changes
3. **Update documentation** if needed
4. **Run tests** to ensure nothing breaks
5. **Run linting** to check code style
6. **Update todo.md** if implementing tracked items

### Code Guidelines

- **Use descriptive variable names**
- **Add doc comments** for public APIs (`///`)
- **Add module comments** for files (`//!`)
- **Handle errors properly** using `Result` types
- **Avoid unwrap()** in production code (use `?` or proper handling)
- **Use async/await** for I/O operations
- **Follow Rust idioms** and best practices

## Testing

### Writing Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_function() {
        let result = my_function();
        assert_eq!(result, expected);
    }

    #[tokio::test]
    async fn test_async_function() {
        let result = async_function().await.unwrap();
        assert!(result.is_ok());
    }
}
```

### Test Categories

- **Unit tests**: Test individual functions/methods
- **Integration tests**: Test interaction between modules
- **Doc tests**: Examples in documentation that run as tests

### Running Specific Test Suites

```bash
# Unit tests only
cargo test --lib

# Integration tests only
cargo test --test '*'

# Doc tests only
cargo test --doc
```

### Code Coverage

We aim for high test coverage across the codebase. Coverage targets are configured in `tarpaulin.toml`:

**Coverage Targets:**
- **Overall Project**: 80%+
- **Core Packages** (core, ai, auth): 85%+
- **Infrastructure** (config, session, mcp, tasks, agents): 80%+
- **Tools** (tools, hooks, terminal): 75%+
- **CLI Package**: 70%+

**Generate Coverage Report:**

```bash
# Install tarpaulin (one-time)
cargo install cargo-tarpaulin

# Generate coverage report
cargo tarpaulin --config tarpaulin.toml --engine llvm

# View HTML report
open target/coverage/index.html  # macOS
xdg-open target/coverage/index.html  # Linux
start target/coverage/index.html  # Windows
```

**Coverage in CI/CD:**

Coverage is automatically generated and reported on every PR. The CI will fail if coverage drops below the thresholds defined in `tarpaulin.toml`.

## Code Style

### Formatting

Run `rustfmt` before committing:

```bash
cargo fmt --all
```

### Linting

Run `clippy` to catch common mistakes:

```bash
cargo clippy --all-targets --all-features -- -D warnings
```

### Style Guidelines

- **Line length**: 100 characters max
- **Indentation**: 4 spaces (no tabs)
- **Imports**: Group by std, external crates, internal modules
- **Error messages**: Use lowercase, no trailing punctuation
- **Comments**: Full sentences with proper punctuation

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): brief description

Longer description if needed.

- Bullet points for details
- Multiple lines OK

Fixes #123
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system changes
- **ci**: CI configuration changes
- **chore**: Maintenance tasks

### Examples

```
feat(auth): add OAuth support for Google provider

Implements OAuth 2.0 with PKCE for Google authentication.
Includes token refresh and secure credential storage.

- Add GoogleProvider struct
- Implement OAuth flow
- Add integration tests
```

```
fix(cli): handle missing config file gracefully

Previously crashed when config file didn't exist.
Now creates default config with helpful message.

Fixes #45
```

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run full test suite**:
   ```bash
   cargo test --all
   cargo clippy --all-targets -- -D warnings
   cargo fmt --all -- --check
   ```

3. **Update documentation**:
   - Update README.md if adding features
   - Update todo.md if completing items
   - Add/update doc comments

### Submitting PR

1. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```

2. **Create Pull Request** on GitHub

3. **Fill out PR template** with:
   - Description of changes
   - Motivation and context
   - Testing done
   - Breaking changes (if any)
   - Related issues

### PR Review Process

- Maintainers will review your PR
- Address feedback by pushing new commits
- Once approved, maintainer will merge
- Delete your feature branch after merge

## Additional Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Async Book](https://rust-lang.github.io/async-book/)
- [Cargo Book](https://doc.rust-lang.org/cargo/)

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues and discussions first

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
