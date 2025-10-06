# Example Hooks

This directory contains example hooks that demonstrate how to use the Claude Code hooks system.

## Available Hooks

### Linting Hook (`linting.sh`)
- **Type**: pre-commit
- **Description**: Runs clippy and formatting checks before committing
- **Requirements**: Rust toolchain with clippy

### Formatting Hook (`formatting.sh`)
- **Type**: pre-commit
- **Description**: Auto-formats code and stages changes before committing
- **Requirements**: Rust toolchain with rustfmt

### Testing Hook (`testing.sh`)
- **Type**: pre-push
- **Description**: Runs full test suite before pushing
- **Requirements**: Rust toolchain

### Security Scan Hook (`security_scan.sh`)
- **Type**: pre-push
- **Description**: Checks for security vulnerabilities in dependencies
- **Requirements**: cargo-audit (`cargo install cargo-audit`)

## How to Use

1. **Install a hook**:
   ```bash
   # Copy hook to your hooks directory
   cp crates/hooks/examples/linting.sh .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

2. **Configure via Claude Code**:
   ```bash
   # Add hook to hooks config
   claude-code hooks add \
     --name linting \
     --type pre-commit \
     --command "./crates/hooks/examples/linting.sh" \
     --priority 10
   ```

3. **Test the hook**:
   ```bash
   claude-code hooks test linting
   ```

## Creating Custom Hooks

Hooks can be written in any language. They should:
1. Exit with code 0 on success
2. Exit with non-zero code to block the operation
3. Print meaningful error messages to stderr
4. Be executable (`chmod +x hookfile`)

### Hook Types

- **user-prompt-submit**: Before user input is sent to AI
- **before-tool-use**: Before any tool is executed
- **after-tool-use**: After tool execution completes
- **before-file-save**: Before file is written
- **after-file-save**: After file write completes
- **pre-commit**: Before git commit
- **post-commit**: After git commit
- **pre-push**: Before git push
- **post-push**: After git push

### Example Python Hook

```python
#!/usr/bin/env python3
import sys

def main():
    print("Running custom Python hook...")
    # Your validation logic here
    if some_condition:
        print("Hook failed!", file=sys.stderr)
        return 1
    print("✓ Hook passed!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### Example JavaScript Hook

```javascript
#!/usr/bin/env node

console.log("Running custom Node.js hook...");

// Your validation logic here
if (someCondition) {
    console.error("Hook failed!");
    process.exit(1);
}

console.log("✓ Hook passed!");
process.exit(0);
```

## Best Practices

1. **Keep hooks fast**: Hooks that take too long will slow down development
2. **Fail gracefully**: Print helpful error messages
3. **Make hooks optional**: Use non-blocking mode for checks that can be slow
4. **Set timeouts**: Configure appropriate timeouts for your hooks
5. **Test thoroughly**: Always test hooks before enabling them
