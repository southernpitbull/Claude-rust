# Claude-Rust Rust - Quick Reference Cheat Sheet

## Installation

```bash
# Install from source
git clone https://github.com/anthropic/claude-rust-rust
cd claude-rust-rust
./install.sh

# Or build manually
cargo build --release --package claude-rust-cli
```

## Authentication

```bash
# Login to provider
claude-rust auth login              # Interactive
claude-rust auth login claude       # Claude (Anthropic)
claude-rust auth login openai       # OpenAI
claude-rust auth login gemini       # Google Gemini

# Check auth status
claude-rust auth status

# Switch providers
claude-rust auth switch <provider>

# Logout
claude-rust auth logout
```

## Basic Usage

```bash
# Ask a question
claude-rust ask "How do I use async/await in Rust?"

# Explain code
claude-rust explain src/main.rs
claude-rust explain "fn main() { println!(\"Hello\"); }"

# Interactive chat
claude-rust chat
```

## Codebase Analysis

```bash
# Scan codebase
claude-rust codebase scan
claude-rust codebase scan --max-depth 3

# Show stats
claude-rust codebase stats

# Index codebase
claude-rust codebase index
```

## File Operations

```bash
# Read file
claude-rust file read <path>
claude-rust file read --lines 10-20 <path>

# Write file
claude-rust file write <path> --content "text"
echo "content" | claude-rust file write <path>

# Edit file
claude-rust file edit <path> \
  --find "old" \
  --replace "new"

# Search files
claude-rust file search "pattern"
claude-rust file search "fn main" --type rs
```

## Git Operations

```bash
# Status
claude-rust git status

# Commit
claude-rust git commit -m "message"

# Diff
claude-rust git diff
claude-rust git diff --staged

# Log
claude-rust git log
claude-rust git log --limit 10

# Branch
claude-rust git branch              # List
claude-rust git branch <name>       # Create

# Push/Pull
claude-rust git push
claude-rust git pull
```

## Sessions

```bash
# List sessions
claude-rust sessions list
claude-rust sessions list --limit 10

# Show session
claude-rust sessions show <id>

# Resume session
claude-rust sessions resume <id>

# Delete session
claude-rust sessions delete <id>
claude-rust sessions delete --all
```

## Configuration

```bash
# Show config
claude-rust config show
claude-rust config show api.timeout

# Set config
claude-rust config set api.timeout 30
claude-rust config set ui.colors true

# Reset config
claude-rust config reset
claude-rust config reset api.timeout
```

## Providers

```bash
# List providers
claude-rust providers list

# Show provider details
claude-rust providers show claude

# Test provider
claude-rust providers test openai

# Set default provider
claude-rust providers default gemini
```

## MCP (Model Context Protocol)

```bash
# List MCP servers
claude-rust mcp list

# Check server status
claude-rust mcp status <server>

# List resources
claude-rust mcp resources <server>

# List tools
claude-rust mcp tools <server>
```

## Hooks

```bash
# List hooks
claude-rust hooks list
claude-rust hooks list --type pre-commit

# Show hook
claude-rust hooks show <name>

# Enable/disable hook
claude-rust hooks enable <name>
claude-rust hooks disable <name>

# Test hook
claude-rust hooks test <name>
```

## Tasks & Agents

```bash
# List tasks
claude-rust tasks list
claude-rust tasks list --status running

# Show task
claude-rust tasks show <id>

# Cancel task
claude-rust tasks cancel <id>

# List agents
claude-rust agents list
claude-rust agents list --type code-review

# Show agent
claude-rust agents show <id>

# Agent stats
claude-rust agents stats
```

## Global Flags

```bash
-h, --help         Show help
-V, --version      Show version
-v, --verbose      Verbose output
-q, --quiet        Quiet mode
-c, --config PATH  Custom config file
```

## Environment Variables

```bash
export CLAUDE_API_KEY="your-key"          # Anthropic API key
export OPENAI_API_KEY="your-key"          # OpenAI API key
export GEMINI_API_KEY="your-key"          # Google Gemini API key
export QWEN_API_KEY="your-key"            # Alibaba Qwen API key
export CLAUDE_CODE_CONFIG="path"          # Custom config path
export CLAUDE_CODE_LOG_LEVEL="debug"      # Log level
```

## Configuration File Locations

```bash
# Linux/macOS
~/.config/claude-rust/config.toml

# Windows
%APPDATA%\claude-rust\config.toml
```

## Common Config Options

```toml
[api]
timeout = 30
max_retries = 3

[ui]
colors = true
streaming = true

[providers.claude]
default_model = "claude-3-5-sonnet-20241022"

[providers.openai]
default_model = "gpt-4"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | CLI argument error |
| 3 | Authentication error |
| 4 | Network error |
| 5 | File I/O error |
| 6 | Configuration error |

## Quick Workflows

### 1. Setup
```bash
claude-rust auth login claude
claude-rust codebase scan
```

### 2. Ask Question
```bash
claude-rust ask "How do I implement X?"
```

### 3. Git Workflow
```bash
claude-rust git status
claude-rust git commit -m "feat: add feature"
claude-rust git push
```

### 4. Code Analysis
```bash
claude-rust codebase scan
claude-rust codebase stats
claude-rust file search "TODO"
```

### 5. Session Management
```bash
claude-rust sessions list
claude-rust sessions resume <id>
```

## Keyboard Shortcuts (Interactive Mode)

```
Ctrl+C    Exit
Ctrl+D    Exit
/exit     Exit chat
/clear    Clear history
/save     Save conversation
/help     Show help
```

## Debug Mode

```bash
# Enable verbose logging
export RUST_LOG=debug
claude-rust ask "test"

# Or use flag
claude-rust --verbose ask "test"

# Maximum verbosity
export RUST_LOG=trace
```

## Log Files

```bash
# Linux/macOS
~/.local/share/claude-rust/logs/latest.log

# Windows
%APPDATA%\claude-rust\logs\latest.log

# View logs
tail -f ~/.local/share/claude-rust/logs/latest.log
```

## Getting Help

```bash
# Command help
claude-rust --help
claude-rust <command> --help

# Report issues
https://github.com/anthropic/claude-rust-rust/issues
```

## Tips

- Use `--verbose` for debugging
- Set `RUST_LOG=debug` for detailed logs
- Use tab completion (if enabled)
- Check `~/.config/claude-rust/config.toml` for config
- Use `claude-rust config show` to see all settings
- Run `claude-rust auth status` to check auth state
- Use `--help` with any command for details

## See Also

- [README.md](README.md) - Full documentation
- [CLI_REFERENCE.md](CLI_REFERENCE.md) - Complete command reference
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Troubleshooting guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
