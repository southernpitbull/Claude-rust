# Troubleshooting Guide

Common issues and solutions for Claude Code Rust.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Authentication Problems](#authentication-problems)
- [Network Errors](#network-errors)
- [Performance Issues](#performance-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Build Errors](#build-errors)
- [Runtime Errors](#runtime-errors)
- [Getting Help](#getting-help)

---

## Installation Issues

### Rust not installed

**Symptom:** `cargo: command not found`

**Solution:**
```bash
# Install Rust from rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Build fails with missing dependencies

**Symptom:** Compilation errors about missing crates

**Solution:**
```bash
# Update dependencies
cargo update

# Clean and rebuild
cargo clean
cargo build --release
```

### Permission denied during installation

**Symptom:** `Permission denied` when copying binary

**Solution:**
```bash
# Use sudo for system-wide install
sudo ./install.sh

# Or install to user directory
mkdir -p ~/.local/bin
cp target/release/claude-code ~/.local/bin/
```

---

## Authentication Problems

### OAuth flow fails

**Symptom:** Browser doesn't open or redirect fails

**Solution:**
1. Check firewall settings
2. Ensure port 8080 is available
3. Try manual authentication:
   ```bash
   claude-code auth login --manual
   ```

### API key not recognized

**Symptom:** `Authentication failed` error

**Solution:**
```bash
# Verify API key is set
echo $CLAUDE_API_KEY

# Or set it manually
export CLAUDE_API_KEY="your-key-here"

# Re-authenticate
claude-code auth logout
claude-code auth login
```

### Token expired

**Symptom:** `Invalid or expired token` error

**Solution:**
```bash
# Logout and login again
claude-code auth logout
claude-code auth login

# Check token status
claude-code auth status
```

### Cannot switch providers

**Symptom:** `Provider not authenticated` error

**Solution:**
```bash
# Authenticate with the provider first
claude-code auth login openai

# Then switch
claude-code auth switch openai
```

---

## Network Errors

### Connection timeout

**Symptom:** `Network error: connection timeout`

**Solution:**
```bash
# Increase timeout in config
claude-code config set api.timeout 60

# Check network connectivity
ping api.anthropic.com

# Use different network or VPN
```

### SSL/TLS errors

**Symptom:** `SSL handshake failed`

**Solution:**
```bash
# Update system certificates
# On Ubuntu/Debian:
sudo apt-get update && sudo apt-get install ca-certificates

# On macOS:
brew install openssl

# Set SSL environment variable
export SSL_CERT_FILE=/path/to/cacert.pem
```

### Proxy issues

**Symptom:** Cannot connect through corporate proxy

**Solution:**
```bash
# Set proxy environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Or configure in Cargo.toml
# [http]
# proxy = "http://proxy.company.com:8080"
```

### Rate limiting

**Symptom:** `429 Too Many Requests` error

**Solution:**
- Wait before retrying (rate limits usually reset after 60 seconds)
- Reduce request frequency
- Check API quota in provider dashboard

---

## Performance Issues

### Slow startup time

**Symptom:** Application takes long to start

**Solution:**
```bash
# Use release build (much faster)
cargo build --release
./target/release/claude-code

# Check for network delays
claude-code config set api.timeout 5
```

### High memory usage

**Symptom:** Application uses excessive memory

**Solution:**
```bash
# Limit session history
claude-code config set session.max_history 100

# Clear old sessions
claude-code sessions delete --older-than 30d

# Reduce codebase index size
claude-code codebase scan --max-depth 3
```

### Slow codebase scanning

**Symptom:** `codebase scan` takes very long

**Solution:**
```bash
# Limit scan depth
claude-code codebase scan --max-depth 5

# Exclude directories
echo "node_modules/" >> .gitignore
echo "target/" >> .gitignore

# Use smaller file size limit
claude-code config set codebase.max_file_size 1048576  # 1MB
```

---

## Platform-Specific Issues

### Windows

#### PowerShell execution policy

**Symptom:** Cannot run scripts

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Line ending issues

**Symptom:** `\r\n` in output

**Solution:**
```bash
git config --global core.autocrlf true
```

#### PATH not updated

**Symptom:** `claude-code: command not found`

**Solution:**
1. Add to PATH manually:
   - Press Win+R
   - Type `sysdm.cpl`
   - Advanced → Environment Variables
   - Add `C:\Users\YourName\.cargo\bin` to PATH

### macOS

#### Gatekeeper blocks binary

**Symptom:** `"claude-code" cannot be opened because the developer cannot be verified`

**Solution:**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /path/to/claude-code

# Or allow in System Preferences:
# System Preferences → Security & Privacy → Allow
```

#### Keychain access denied

**Symptom:** Cannot store credentials in keychain

**Solution:**
1. Open Keychain Access
2. Find `claude-code` entries
3. Get Info → Access Control → Allow all applications

### Linux

#### Missing libssl

**Symptom:** `error while loading shared libraries: libssl.so`

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install libssl-dev

# Fedora/RHEL
sudo dnf install openssl-devel

# Arch
sudo pacman -S openssl
```

#### SELinux blocks execution

**Symptom:** `Permission denied` despite correct permissions

**Solution:**
```bash
# Check SELinux status
sestatus

# Temporarily disable
sudo setenforce 0

# Or set context
chcon -t bin_t /path/to/claude-code
```

---

## Build Errors

### Compilation errors

**Symptom:** Various compiler errors

**Solution:**
```bash
# Ensure Rust is up to date
rustup update

# Use specific toolchain
rustup default stable

# Clean build cache
cargo clean
rm -rf target/
cargo build
```

### Linking errors

**Symptom:** `error: linking with cc failed`

**Solution:**
```bash
# Install build tools
# Ubuntu/Debian:
sudo apt-get install build-essential

# macOS:
xcode-select --install

# Windows:
# Install Visual Studio Build Tools
```

### Dependency conflicts

**Symptom:** `conflicting requirements` error

**Solution:**
```bash
# Update Cargo.lock
cargo update

# Or remove it and regenerate
rm Cargo.lock
cargo build
```

---

## Runtime Errors

### File not found errors

**Symptom:** `No such file or directory`

**Solution:**
```bash
# Check current directory
pwd

# Use absolute paths
claude-code file read /absolute/path/to/file.rs

# Check file permissions
ls -la /path/to/file
```

### JSON parse errors

**Symptom:** `Failed to parse JSON`

**Solution:**
```bash
# Validate JSON file
cat config.json | jq .

# Check file encoding
file config.json

# Recreate config from template
claude-code config reset
```

### Database/session errors

**Symptom:** Session corruption errors

**Solution:**
```bash
# Backup sessions
cp -r ~/.local/share/claude-code ~/.local/share/claude-code.backup

# Clear sessions
claude-code sessions delete --all

# Reset session storage
rm -rf ~/.local/share/claude-code/sessions
```

---

## Common Error Messages

### `Authentication required`

**Cause:** Not logged in to any provider

**Fix:** Run `claude-code auth login`

### `Invalid configuration`

**Cause:** Malformed config file

**Fix:**
```bash
claude-code config reset
# Or manually edit: ~/.config/claude-code/config.toml
```

### `No provider selected`

**Cause:** Haven't set a default provider

**Fix:** `claude-code providers default claude`

### `Command execution timeout`

**Cause:** Command took longer than timeout limit

**Fix:**
```bash
# Increase timeout
claude-code bash "long-command" --timeout 300
# Or in config:
claude-code config set execution.timeout 300
```

### `File too large`

**Cause:** File exceeds size limit

**Fix:**
```bash
# Increase limit
claude-code config set files.max_size 10485760  # 10MB
```

---

## Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Environment variable
export RUST_LOG=debug
claude-code ask "test"

# Or use CLI flag
claude-code --verbose ask "test"

# Maximum verbosity
export RUST_LOG=trace
claude-code ask "test"
```

## Log Files

Logs are stored in:
- Linux: `~/.local/share/claude-code/logs/`
- macOS: `~/Library/Application Support/claude-code/logs/`
- Windows: `%APPDATA%\claude-code\logs\`

View recent logs:
```bash
# Linux/macOS
tail -f ~/.local/share/claude-code/logs/latest.log

# Windows
Get-Content -Wait "$env:APPDATA\claude-code\logs\latest.log"
```

---

## Getting Help

If you're still experiencing issues:

1. **Check existing issues:** https://github.com/anthropic/claude-code-rust/issues

2. **Create a new issue:** Include:
   - OS and version
   - Rust version (`rustc --version`)
   - Claude Code version (`claude-code --version`)
   - Full error message
   - Steps to reproduce
   - Relevant logs (with sensitive data removed)

3. **Community support:**
   - GitHub Discussions
   - Discord (if available)

4. **Debug information to include:**
   ```bash
   # System info
   uname -a
   rustc --version
   cargo --version
   claude-code --version

   # Configuration
   claude-code config show

   # Auth status
   claude-code auth status
   ```

---

## Clean Reinstall

If all else fails, perform a clean reinstall:

```bash
# 1. Backup configuration
cp -r ~/.config/claude-code ~/claude-code-config-backup

# 2. Backup sessions
cp -r ~/.local/share/claude-code ~/claude-code-data-backup

# 3. Uninstall
rm ~/.local/bin/claude-code
rm -rf ~/.config/claude-code
rm -rf ~/.local/share/claude-code

# 4. Reinstall
./install.sh

# 5. Restore config if needed
cp -r ~/claude-code-config-backup ~/.config/claude-code
```
