# CLI Reference

Complete command-line reference for Claude-Rust Rust.

## Table of Contents

- [Global Flags](#global-flags)
- [Commands](#commands)
  - [auth](#auth)
  - [ask](#ask)
  - [explain](#explain)
  - [chat](#chat)
  - [sessions](#sessions)
  - [providers](#providers)
  - [config](#config)
  - [codebase](#codebase)
  - [file](#file)
  - [bash](#bash)
  - [git](#git)
  - [mcp](#mcp)
  - [hooks](#hooks)
  - [tasks](#tasks)
  - [agents](#agents)

## Global Flags

These flags work with any command:

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help information |
| `--version` | `-V` | Show version information |
| `--verbose` | `-v` | Enable verbose output |
| `--quiet` | `-q` | Suppress non-essential output |
| `--config <PATH>` | `-c` | Use custom config file |

## Commands

### auth

Manage authentication with AI providers.

#### Subcommands

**`auth login [provider]`**
```bash
claude-rust auth login          # Interactive provider selection
claude-rust auth login claude   # Login to Claude
claude-rust auth login openai   # Login to OpenAI
```

**`auth logout [provider]`**
```bash
claude-rust auth logout         # Logout from current provider
claude-rust auth logout claude  # Logout from specific provider
```

**`auth status`**
```bash
claude-rust auth status         # Show authentication status
```

**`auth switch <provider>`**
```bash
claude-rust auth switch openai  # Switch to OpenAI
```

**`auth list`**
```bash
claude-rust auth list           # List all accounts
```

---

### ask

Ask a single question to the AI.

```bash
claude-rust ask "What is Rust?"
claude-rust ask "Explain async/await" --provider openai
claude-rust ask "How do I parse JSON?" --model gpt-4
```

**Flags:**
- `--provider <name>` - Override default provider
- `--model <name>` - Override default model
- `--no-stream` - Disable streaming responses

---

### explain

Get code explanation.

```bash
claude-rust explain src/main.rs
claude-rust explain "fn main() { println!(\"Hello\"); }"
```

**Flags:**
- `--context <lines>` - Include surrounding context
- `--detailed` - Get detailed explanation

---

### chat

Start interactive chat mode.

```bash
claude-rust chat
claude-rust chat --provider gemini
```

**Interactive Commands:**
- `/exit` - Exit chat
- `/clear` - Clear chat history
- `/save` - Save conversation
- `/help` - Show help

---

### sessions

Manage conversation sessions.

**`sessions list`**
```bash
claude-rust sessions list       # List all sessions
claude-rust sessions list --limit 10
```

**`sessions show <id>`**
```bash
claude-rust sessions show abc123
```

**`sessions resume <id>`**
```bash
claude-rust sessions resume abc123
```

**`sessions delete <id>`**
```bash
claude-rust sessions delete abc123
claude-rust sessions delete --all  # Delete all sessions
```

---

### providers

Manage AI providers.

**`providers list`**
```bash
claude-rust providers list      # List all providers
```

**`providers show <name>`**
```bash
claude-rust providers show claude
```

**`providers test <name>`**
```bash
claude-rust providers test openai
```

**`providers default <name>`**
```bash
claude-rust providers default gemini
```

---

### config

Manage configuration.

**`config show`**
```bash
claude-rust config show         # Show all config
claude-rust config show api.timeout
```

**`config set <key> <value>`**
```bash
claude-rust config set api.timeout 30
claude-rust config set ui.colors true
```

**`config reset`**
```bash
claude-rust config reset        # Reset to defaults
claude-rust config reset api.timeout
```

---

### codebase

Codebase analysis operations.

**`codebase scan`**
```bash
claude-rust codebase scan
claude-rust codebase scan --max-depth 3
claude-rust codebase scan --include-hidden
```

**`codebase index`**
```bash
claude-rust codebase index
claude-rust codebase index --output index.json
```

**`codebase analyze`**
```bash
claude-rust codebase analyze
```

**`codebase stats`**
```bash
claude-rust codebase stats      # Show codebase statistics
```

---

### file

File operations.

**`file read <path>`**
```bash
claude-rust file read src/main.rs
claude-rust file read --lines 10-20 src/main.rs
```

**`file write <path>`**
```bash
claude-rust file write output.txt --content "Hello World"
echo "content" | claude-rust file write output.txt
```

**`file edit <path>`**
```bash
claude-rust file edit src/main.rs \
  --find "old text" \
  --replace "new text"
```

**`file search <pattern>`**
```bash
claude-rust file search "TODO"
claude-rust file search "fn main" --type rs
```

---

### bash

Execute shell commands.

```bash
claude-rust bash "ls -la"
claude-rust bash "npm install" --timeout 60
claude-rust bash "cargo build" --working-dir /path/to/project
```

**Flags:**
- `--timeout <seconds>` - Command timeout
- `--working-dir <path>` - Working directory
- `--env <KEY=VALUE>` - Environment variables

---

### git

Git operations.

**`git status`**
```bash
claude-rust git status
```

**`git log`**
```bash
claude-rust git log
claude-rust git log --limit 10
claude-rust git log --since "2 days ago"
```

**`git diff`**
```bash
claude-rust git diff
claude-rust git diff --staged
claude-rust git diff HEAD~1
```

**`git branch`**
```bash
claude-rust git branch          # List branches
claude-rust git branch feature  # Create branch
claude-rust git branch -d old   # Delete branch
```

**`git commit`**
```bash
claude-rust git commit -m "feat: add feature"
claude-rust git commit --amend
```

**`git push`**
```bash
claude-rust git push
claude-rust git push origin main
```

**`git pull`**
```bash
claude-rust git pull
claude-rust git pull --rebase
```

---

### mcp

Model Context Protocol operations.

**`mcp list`**
```bash
claude-rust mcp list            # List MCP servers
```

**`mcp status <server>`**
```bash
claude-rust mcp status filesystem
```

**`mcp resources <server>`**
```bash
claude-rust mcp resources filesystem
```

**`mcp tools <server>`**
```bash
claude-rust mcp tools filesystem
```

---

### hooks

Manage lifecycle hooks.

**`hooks list`**
```bash
claude-rust hooks list
claude-rust hooks list --type pre-commit
```

**`hooks show <name>`**
```bash
claude-rust hooks show linting
```

**`hooks enable <name>`**
```bash
claude-rust hooks enable linting
```

**`hooks disable <name>`**
```bash
claude-rust hooks disable linting
```

**`hooks test <name>`**
```bash
claude-rust hooks test linting
```

---

### tasks

Manage background tasks.

**`tasks list`**
```bash
claude-rust tasks list
claude-rust tasks list --status running
```

**`tasks show <id>`**
```bash
claude-rust tasks show task-123
```

**`tasks cancel <id>`**
```bash
claude-rust tasks cancel task-123
```

---

### agents

Manage AI agents.

**`agents list`**
```bash
claude-rust agents list
claude-rust agents list --type code-review
```

**`agents show <id>`**
```bash
claude-rust agents show agent-123
```

**`agents register`**
```bash
claude-rust agents register \
  --type code-review \
  --name "My Reviewer"
```

**`agents stats`**
```bash
claude-rust agents stats
```

---

## Configuration File

Configuration is stored in:
- Linux/macOS: `~/.config/claude-rust/config.toml`
- Windows: `%APPDATA%\claude-rust\config.toml`

Example configuration:

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

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `QWEN_API_KEY` | Alibaba Qwen API key |
| `CLAUDE_CODE_CONFIG` | Custom config file path |
| `CLAUDE_CODE_LOG_LEVEL` | Log level (trace, debug, info, warn, error) |

---

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

---

## Examples

### Common Workflows

**1. Setup and authenticate:**
```bash
claude-rust auth login claude
```

**2. Ask a question:**
```bash
claude-rust ask "How do I implement a binary tree in Rust?"
```

**3. Analyze codebase:**
```bash
claude-rust codebase scan
claude-rust codebase stats
```

**4. Git workflow:**
```bash
claude-rust git status
claude-rust git commit -m "feat: add new feature"
claude-rust git push
```

**5. Background tasks:**
```bash
claude-rust tasks list
claude-rust tasks show task-123
```

---

## Getting Help

- Use `--help` with any command for detailed information
- Check the [README](README.md) for overview
- See [CONTRIBUTING](CONTRIBUTING.md) for development
- Report issues on GitHub

---

## See Also

- [README.md](README.md) - Project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- [todo.md](todo.md) - Implementation status
