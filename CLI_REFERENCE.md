# CLI Reference

Complete command-line reference for Claude Code Rust.

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
claude-code auth login          # Interactive provider selection
claude-code auth login claude   # Login to Claude
claude-code auth login openai   # Login to OpenAI
```

**`auth logout [provider]`**
```bash
claude-code auth logout         # Logout from current provider
claude-code auth logout claude  # Logout from specific provider
```

**`auth status`**
```bash
claude-code auth status         # Show authentication status
```

**`auth switch <provider>`**
```bash
claude-code auth switch openai  # Switch to OpenAI
```

**`auth list`**
```bash
claude-code auth list           # List all accounts
```

---

### ask

Ask a single question to the AI.

```bash
claude-code ask "What is Rust?"
claude-code ask "Explain async/await" --provider openai
claude-code ask "How do I parse JSON?" --model gpt-4
```

**Flags:**
- `--provider <name>` - Override default provider
- `--model <name>` - Override default model
- `--no-stream` - Disable streaming responses

---

### explain

Get code explanation.

```bash
claude-code explain src/main.rs
claude-code explain "fn main() { println!(\"Hello\"); }"
```

**Flags:**
- `--context <lines>` - Include surrounding context
- `--detailed` - Get detailed explanation

---

### chat

Start interactive chat mode.

```bash
claude-code chat
claude-code chat --provider gemini
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
claude-code sessions list       # List all sessions
claude-code sessions list --limit 10
```

**`sessions show <id>`**
```bash
claude-code sessions show abc123
```

**`sessions resume <id>`**
```bash
claude-code sessions resume abc123
```

**`sessions delete <id>`**
```bash
claude-code sessions delete abc123
claude-code sessions delete --all  # Delete all sessions
```

---

### providers

Manage AI providers.

**`providers list`**
```bash
claude-code providers list      # List all providers
```

**`providers show <name>`**
```bash
claude-code providers show claude
```

**`providers test <name>`**
```bash
claude-code providers test openai
```

**`providers default <name>`**
```bash
claude-code providers default gemini
```

---

### config

Manage configuration.

**`config show`**
```bash
claude-code config show         # Show all config
claude-code config show api.timeout
```

**`config set <key> <value>`**
```bash
claude-code config set api.timeout 30
claude-code config set ui.colors true
```

**`config reset`**
```bash
claude-code config reset        # Reset to defaults
claude-code config reset api.timeout
```

---

### codebase

Codebase analysis operations.

**`codebase scan`**
```bash
claude-code codebase scan
claude-code codebase scan --max-depth 3
claude-code codebase scan --include-hidden
```

**`codebase index`**
```bash
claude-code codebase index
claude-code codebase index --output index.json
```

**`codebase analyze`**
```bash
claude-code codebase analyze
```

**`codebase stats`**
```bash
claude-code codebase stats      # Show codebase statistics
```

---

### file

File operations.

**`file read <path>`**
```bash
claude-code file read src/main.rs
claude-code file read --lines 10-20 src/main.rs
```

**`file write <path>`**
```bash
claude-code file write output.txt --content "Hello World"
echo "content" | claude-code file write output.txt
```

**`file edit <path>`**
```bash
claude-code file edit src/main.rs \
  --find "old text" \
  --replace "new text"
```

**`file search <pattern>`**
```bash
claude-code file search "TODO"
claude-code file search "fn main" --type rs
```

---

### bash

Execute shell commands.

```bash
claude-code bash "ls -la"
claude-code bash "npm install" --timeout 60
claude-code bash "cargo build" --working-dir /path/to/project
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
claude-code git status
```

**`git log`**
```bash
claude-code git log
claude-code git log --limit 10
claude-code git log --since "2 days ago"
```

**`git diff`**
```bash
claude-code git diff
claude-code git diff --staged
claude-code git diff HEAD~1
```

**`git branch`**
```bash
claude-code git branch          # List branches
claude-code git branch feature  # Create branch
claude-code git branch -d old   # Delete branch
```

**`git commit`**
```bash
claude-code git commit -m "feat: add feature"
claude-code git commit --amend
```

**`git push`**
```bash
claude-code git push
claude-code git push origin main
```

**`git pull`**
```bash
claude-code git pull
claude-code git pull --rebase
```

---

### mcp

Model Context Protocol operations.

**`mcp list`**
```bash
claude-code mcp list            # List MCP servers
```

**`mcp status <server>`**
```bash
claude-code mcp status filesystem
```

**`mcp resources <server>`**
```bash
claude-code mcp resources filesystem
```

**`mcp tools <server>`**
```bash
claude-code mcp tools filesystem
```

---

### hooks

Manage lifecycle hooks.

**`hooks list`**
```bash
claude-code hooks list
claude-code hooks list --type pre-commit
```

**`hooks show <name>`**
```bash
claude-code hooks show linting
```

**`hooks enable <name>`**
```bash
claude-code hooks enable linting
```

**`hooks disable <name>`**
```bash
claude-code hooks disable linting
```

**`hooks test <name>`**
```bash
claude-code hooks test linting
```

---

### tasks

Manage background tasks.

**`tasks list`**
```bash
claude-code tasks list
claude-code tasks list --status running
```

**`tasks show <id>`**
```bash
claude-code tasks show task-123
```

**`tasks cancel <id>`**
```bash
claude-code tasks cancel task-123
```

---

### agents

Manage AI agents.

**`agents list`**
```bash
claude-code agents list
claude-code agents list --type code-review
```

**`agents show <id>`**
```bash
claude-code agents show agent-123
```

**`agents register`**
```bash
claude-code agents register \
  --type code-review \
  --name "My Reviewer"
```

**`agents stats`**
```bash
claude-code agents stats
```

---

## Configuration File

Configuration is stored in:
- Linux/macOS: `~/.config/claude-code/config.toml`
- Windows: `%APPDATA%\claude-code\config.toml`

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
claude-code auth login claude
```

**2. Ask a question:**
```bash
claude-code ask "How do I implement a binary tree in Rust?"
```

**3. Analyze codebase:**
```bash
claude-code codebase scan
claude-code codebase stats
```

**4. Git workflow:**
```bash
claude-code git status
claude-code git commit -m "feat: add new feature"
claude-code git push
```

**5. Background tasks:**
```bash
claude-code tasks list
claude-code tasks show task-123
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
