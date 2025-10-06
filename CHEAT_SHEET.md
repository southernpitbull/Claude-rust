# Claude Code Rust - Quick Reference Cheat Sheet

## Installation

```bash
# Install from source
git clone https://github.com/anthropic/claude-code-rust
cd claude-code-rust
./install.sh

# Or build manually
cargo build --release --package claude-code-cli
```

## Authentication

```bash
# Login to provider
claude-code auth login              # Interactive
claude-code auth login claude       # Claude (Anthropic)
claude-code auth login openai       # OpenAI
claude-code auth login gemini       # Google Gemini

# Check auth status
claude-code auth status

# Switch providers
claude-code auth switch <provider>

# Logout
claude-code auth logout
```

## Basic Usage

```bash
# Ask a question
claude-code ask "How do I use async/await in Rust?"

# Explain code
claude-code explain src/main.rs
claude-code explain "fn main() { println!(\"Hello\"); }"

# Interactive chat
claude-code chat
```

## Codebase Analysis

```bash
# Scan codebase
claude-code codebase scan
claude-code codebase scan --max-depth 3

# Show stats
claude-code codebase stats

# Index codebase
claude-code codebase index
```

## File Operations

```bash
# Read file
claude-code file read <path>
claude-code file read --lines 10-20 <path>

# Write file
claude-code file write <path> --content "text"
echo "content" | claude-code file write <path>

# Edit file
claude-code file edit <path> \
  --find "old" \
  --replace "new"

# Search files
claude-code file search "pattern"
claude-code file search "fn main" --type rs
```

## Git Operations

```bash
# Status
claude-code git status

# Commit
claude-code git commit -m "message"

# Diff
claude-code git diff
claude-code git diff --staged

# Log
claude-code git log
claude-code git log --limit 10

# Branch
claude-code git branch              # List
claude-code git branch <name>       # Create

# Push/Pull
claude-code git push
claude-code git pull
```

## Sessions

```bash
# List sessions
claude-code sessions list
claude-code sessions list --limit 10

# Show session
claude-code sessions show <id>

# Resume session
claude-code sessions resume <id>

# Delete session
claude-code sessions delete <id>
claude-code sessions delete --all
```

## Configuration

```bash
# Show config
claude-code config show
claude-code config show api.timeout

# Set config
claude-code config set api.timeout 30
claude-code config set ui.colors true

# Reset config
claude-code config reset
claude-code config reset api.timeout
```

## Providers

```bash
# List providers
claude-code providers list

# Show provider details
claude-code providers show claude

# Test provider
claude-code providers test openai

# Set default provider
claude-code providers default gemini
```

## MCP (Model Context Protocol)

```bash
# List MCP servers
claude-code mcp list

# Check server status
claude-code mcp status <server>

# List resources
claude-code mcp resources <server>

# List tools
claude-code mcp tools <server>
```

## Hooks

```bash
# List hooks
claude-code hooks list
claude-code hooks list --type pre-commit

# Show hook
claude-code hooks show <name>

# Enable/disable hook
claude-code hooks enable <name>
claude-code hooks disable <name>

# Test hook
claude-code hooks test <name>
```

## Tasks & Agents

```bash
# List tasks
claude-code tasks list
claude-code tasks list --status running

# Show task
claude-code tasks show <id>

# Cancel task
claude-code tasks cancel <id>

# List agents
claude-code agents list
claude-code agents list --type code-review

# Show agent
claude-code agents show <id>

# Agent stats
claude-code agents stats
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
~/.config/claude-code/config.toml

# Windows
%APPDATA%\claude-code\config.toml
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
claude-code auth login claude
claude-code codebase scan
```

### 2. Ask Question
```bash
claude-code ask "How do I implement X?"
```

### 3. Git Workflow
```bash
claude-code git status
claude-code git commit -m "feat: add feature"
claude-code git push
```

### 4. Code Analysis
```bash
claude-code codebase scan
claude-code codebase stats
claude-code file search "TODO"
```

### 5. Session Management
```bash
claude-code sessions list
claude-code sessions resume <id>
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
claude-code ask "test"

# Or use flag
claude-code --verbose ask "test"

# Maximum verbosity
export RUST_LOG=trace
```

## Log Files

```bash
# Linux/macOS
~/.local/share/claude-code/logs/latest.log

# Windows
%APPDATA%\claude-code\logs\latest.log

# View logs
tail -f ~/.local/share/claude-code/logs/latest.log
```

## Getting Help

```bash
# Command help
claude-code --help
claude-code <command> --help

# Report issues
https://github.com/anthropic/claude-code-rust/issues
```

## Tips

- Use `--verbose` for debugging
- Set `RUST_LOG=debug` for detailed logs
- Use tab completion (if enabled)
- Check `~/.config/claude-code/config.toml` for config
- Use `claude-code config show` to see all settings
- Run `claude-code auth status` to check auth state
- Use `--help` with any command for details

## See Also

- [README.md](README.md) - Full documentation
- [CLI_REFERENCE.md](CLI_REFERENCE.md) - Complete command reference
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Troubleshooting guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
