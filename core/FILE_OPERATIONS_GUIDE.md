# File Operations Module - Quick Reference Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Basic Operations](#basic-operations)
3. [Advanced Features](#advanced-features)
4. [Error Handling](#error-handling)
5. [Best Practices](#best-practices)

## Quick Start

```rust
use claude_code_core::fileops::{FileOperations, WriteOptions, ListOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create file operations handler
    let file_ops = FileOperations::new();

    // Write a file
    file_ops.write_string("hello.txt", "Hello, World!").await?;

    // Read it back
    let content = file_ops.read_file_to_string("hello.txt").await?;
    println!("{}", content);

    Ok(())
}
```

## Basic Operations

### Reading Files

```rust
// Read as bytes
let bytes = file_ops.read_file("file.bin").await?;

// Read as string
let text = file_ops.read_file_to_string("file.txt").await?;

// Read with size limit
use claude_code_core::fileops::ReadOptions;
let options = ReadOptions {
    max_size: Some(1024 * 1024), // 1MB limit
    follow_symlinks: false,
};
let bytes = file_ops.read_file_with_options("large.bin", options).await?;
```

### Writing Files

```rust
// Write bytes
file_ops.write_file("file.bin", &bytes).await?;

// Write string
file_ops.write_string("file.txt", "content").await?;

// Append to file
file_ops.append_string("log.txt", "New log entry\n").await?;

// Write with options
use claude_code_core::fileops::WriteOptions;
let options = WriteOptions {
    create_dirs: true,  // Create parent directories
    atomic: true,       // Use atomic write
    mode: Some(0o644),  // Unix permissions
    append: false,
};
file_ops.write_file_with_options("nested/dir/file.txt", b"content", options).await?;
```

### File Operations

```rust
// Copy file
file_ops.copy_file("source.txt", "destination.txt").await?;

// Move/rename file
file_ops.move_file("old.txt", "new.txt").await?;

// Delete file
file_ops.remove_file("unwanted.txt").await?;

// Check if file exists
if file_ops.file_exists("config.toml").await {
    println!("Config exists!");
}
```

### Directory Operations

```rust
// Create directory
file_ops.create_directory("my/nested/dir").await?;

// Or use ensure_dir (same thing)
file_ops.ensure_dir("my/nested/dir").await?;

// Remove directory and all contents
file_ops.remove_directory("temp/").await?;

// Check if directory exists
if file_ops.directory_exists("data/").await {
    println!("Data directory exists!");
}
```

### File Metadata

```rust
let info = file_ops.get_file_info("document.pdf").await?;
println!("Size: {} bytes", info.size);
println!("Is directory: {}", info.is_dir);
println!("MIME type: {:?}", info.mime_type);
println!("Modified: {:?}", info.modified);
println!("Read-only: {}", info.readonly);
```

### Listing Directories

```rust
// Simple listing
let entries = file_ops.list_directory(".").await?;
for entry in entries {
    println!("{}: {} bytes", entry.path.display(), entry.size);
}

// Recursive listing with pattern
use claude_code_core::fileops::ListOptions;
let options = ListOptions {
    recursive: true,
    max_depth: Some(3),
    pattern: Some("*.rs".to_string()),
    include_hidden: false,
    follow_symlinks: false,
};
let rust_files = file_ops.list_directory_with_options("src/", options).await?;
```

## Advanced Features

### Safe Write with Automatic Backup

Automatically creates a backup before writing. If the write fails, the backup is restored.

```rust
// Safely overwrite important file
file_ops.safe_write_with_backup("important.json", new_content).await?;
// If write fails, original content is automatically restored
```

### Transactional Operations

Group multiple file operations into a transaction that can be committed or rolled back.

```rust
use claude_code_core::fileops::FileTransaction;

// Create transaction
let mut tx = FileTransaction::new(".");

// Perform operations
tx.write_file("config.toml", b"[settings]\nkey = \"value\"").await?;
tx.write_file("data.json", b"{}").await?;
tx.delete_file("old_config.toml").await?;
tx.move_file("temp.txt", "final.txt").await?;

// Commit if all succeeded
tx.commit()?;

// Or rollback on error
// tx.rollback().await?;
```

**Error Handling with Transactions:**

```rust
let mut tx = FileTransaction::new(".");

match perform_complex_operations(&mut tx).await {
    Ok(_) => {
        println!("Committing transaction");
        tx.commit()?;
    }
    Err(e) => {
        println!("Error occurred, rolling back: {}", e);
        tx.rollback().await?;
        return Err(e);
    }
}
```

### File Watching

#### Simple Callback Watcher

```rust
use notify::Event;

let _watcher = file_ops.watch_file("./watched", |result: notify::Result<Event>| {
    match result {
        Ok(event) => println!("Event: {:?}", event),
        Err(e) => println!("Watch error: {:?}", e),
    }
})?;

// Keep watcher alive
std::thread::park();
```

#### Debounced Watcher

Better for rapid changes - only triggers after changes settle down.

```rust
use claude_code_core::fileops::DebouncedFileWatcher;
use std::time::Duration;

// Create watcher with 500ms debounce
let mut watcher = DebouncedFileWatcher::new(
    "./watched",
    Duration::from_millis(500)
)?;

// Process events
while let Some(path) = watcher.next_event().await {
    println!("File changed: {:?}", path);
    // React to change
}
```

### .gitignore Integration

Respect .gitignore patterns when processing files.

```rust
// Load .gitignore from current directory
let gitignore = file_ops.load_gitignore(".")?;

// List all non-ignored files
let entries = file_ops.list_directory(".")?.await;
for entry in entries {
    if file_ops.is_ignored(&entry.path, &gitignore) {
        continue; // Skip ignored files
    }
    println!("Processing: {}", entry.path.display());
}
```

### Path Normalization

Resolve `.` and `..` components in paths.

```rust
let normalized = file_ops.normalize_path("./src/../tests/./test.rs")?;
// Result: "tests/test.rs"
```

## Error Handling

All operations return `AppResult<T>` which is `Result<T, AppError>`.

### Common Error Patterns

```rust
use claude_code_core::error::AppError;

match file_ops.read_file("config.toml").await {
    Ok(content) => process_config(content),
    Err(AppError::FileNotFound { path }) => {
        println!("Config not found at: {}", path.display());
        create_default_config().await?;
    }
    Err(AppError::PermissionDenied { path, operation }) => {
        println!("Permission denied to {} {}", operation, path.display());
    }
    Err(e) => {
        println!("Unexpected error: {}", e);
        return Err(e);
    }
}
```

### Error Context

Add context to errors for better debugging:

```rust
use claude_code_core::error::ErrorContext;

file_ops
    .read_file("config.toml")
    .await
    .context("Failed to load application configuration")?;
```

## Best Practices

### 1. Use Atomic Writes for Critical Data

```rust
let options = WriteOptions {
    atomic: true,
    create_dirs: true,
    ..Default::default()
};

file_ops.write_file_with_options("critical.json", data, options).await?;
```

### 2. Use Transactions for Multiple Related Changes

```rust
let mut tx = FileTransaction::new(".");
tx.write_file("part1.dat", part1).await?;
tx.write_file("part2.dat", part2).await?;
tx.write_file("index.dat", index).await?;
tx.commit()?; // All or nothing
```

### 3. Always Handle Errors Appropriately

```rust
// Bad: Unwrapping can panic
let content = file_ops.read_file("file.txt").await.unwrap();

// Good: Handle errors gracefully
let content = file_ops.read_file("file.txt").await
    .unwrap_or_else(|e| {
        eprintln!("Failed to read file: {}", e);
        Default::default()
    });
```

### 4. Use Safe Write for Important Files

```rust
// Protects against data loss if write fails
file_ops.safe_write_with_backup("database.db", new_data).await?;
```

### 5. Respect .gitignore in File Processing

```rust
let gitignore = file_ops.load_gitignore(".")?;

for entry in file_ops.list_directory_with_options(".", recursive_opts).await? {
    if file_ops.is_ignored(&entry.path, &gitignore) {
        continue;
    }
    process_file(&entry.path).await?;
}
```

### 6. Use Debouncing for File Watchers

```rust
// Avoid processing every single change when files change rapidly
let mut watcher = DebouncedFileWatcher::new(path, Duration::from_millis(500))?;
```

### 7. Check File Existence Before Operations

```rust
if file_ops.file_exists("output.txt").await {
    file_ops.safe_write_with_backup("output.txt", data).await?;
} else {
    file_ops.write_file("output.txt", data).await?;
}
```

### 8. Set Proper Permissions

```rust
#[cfg(unix)]
let options = WriteOptions {
    mode: Some(0o600), // Read/write for owner only
    ..Default::default()
};

#[cfg(not(unix))]
let options = WriteOptions::default();

file_ops.write_file_with_options("secret.key", key, options).await?;
```

### 9. Use Size Limits When Reading Untrusted Files

```rust
let options = ReadOptions {
    max_size: Some(10 * 1024 * 1024), // 10MB limit
    ..Default::default()
};

file_ops.read_file_with_options(user_provided_path, options).await?;
```

### 10. Clean Up Temporary Files

```rust
// Use RAII with tempfile crate
use tempfile::TempDir;

let temp_dir = TempDir::new()?;
let file_ops = FileOperations::with_base_dir(temp_dir.path());

// Do work...

// Automatic cleanup when temp_dir goes out of scope
```

## Performance Tips

### 1. Batch Operations in Transactions

Instead of:
```rust
for item in items {
    file_ops.write_file(&item.path, &item.data).await?;
}
```

Do:
```rust
let mut tx = FileTransaction::new(".");
for item in items {
    tx.write_file(&item.path, &item.data).await?;
}
tx.commit()?;
```

### 2. Use Appropriate Buffer Sizes

The module automatically pre-allocates buffers based on file size, so reading is efficient.

### 3. Avoid Reading Large Files into Memory

For very large files, consider streaming approaches or memory mapping (future enhancement).

### 4. Use Recursive Listing Wisely

```rust
// Limit depth for large directory trees
let options = ListOptions {
    recursive: true,
    max_depth: Some(3), // Limit depth
    ..Default::default()
};
```

### 5. Debounce File Watchers

```rust
// Use longer debounce for less critical changes
let watcher = DebouncedFileWatcher::new(path, Duration::from_secs(1))?;
```

## Common Patterns

### Configuration File Management

```rust
async fn load_or_create_config(file_ops: &FileOperations) -> AppResult<Config> {
    if file_ops.file_exists("config.toml").await {
        let content = file_ops.read_file_to_string("config.toml").await?;
        Ok(toml::from_str(&content)?)
    } else {
        let default_config = Config::default();
        let content = toml::to_string_pretty(&default_config)?;
        file_ops.write_string("config.toml", &content).await?;
        Ok(default_config)
    }
}
```

### Safe Configuration Updates

```rust
async fn update_config(file_ops: &FileOperations, config: &Config) -> AppResult<()> {
    let content = toml::to_string_pretty(config)?;
    file_ops.safe_write_with_backup("config.toml", content.as_bytes()).await?;
    Ok(())
}
```

### Directory Synchronization

```rust
async fn sync_directories(
    file_ops: &FileOperations,
    source: &Path,
    dest: &Path
) -> AppResult<()> {
    let mut tx = FileTransaction::new(dest);

    let entries = file_ops.list_directory_with_options(
        source,
        ListOptions {
            recursive: true,
            ..Default::default()
        }
    ).await?;

    for entry in entries {
        if entry.is_file {
            let rel_path = entry.path.strip_prefix(source).unwrap();
            let content = file_ops.read_file(&entry.path).await?;
            tx.write_file(rel_path, &content).await?;
        }
    }

    tx.commit()?;
    Ok(())
}
```

### Hot Reload Pattern

```rust
async fn watch_and_reload(path: &Path) -> AppResult<()> {
    let mut watcher = DebouncedFileWatcher::new(
        path,
        Duration::from_millis(500)
    )?;

    while let Some(changed_path) = watcher.next_event().await {
        println!("Reloading: {:?}", changed_path);
        match reload_config(&changed_path).await {
            Ok(_) => println!("Reload successful"),
            Err(e) => eprintln!("Reload failed: {}", e),
        }
    }

    Ok(())
}
```

## Migration from Sync to Async

If you have existing sync code:

```rust
// Old sync code
std::fs::write("file.txt", "content")?;
let content = std::fs::read_to_string("file.txt")?;
```

Convert to:

```rust
// New async code
file_ops.write_string("file.txt", "content").await?;
let content = file_ops.read_file_to_string("file.txt").await?;
```

## Testing with FileOperations

```rust
use tempfile::TempDir;

#[tokio::test]
async fn test_my_feature() {
    let temp_dir = TempDir::new().unwrap();
    let file_ops = FileOperations::with_base_dir(temp_dir.path());

    // Test code here
    file_ops.write_string("test.txt", "test data").await.unwrap();
    let content = file_ops.read_file_to_string("test.txt").await.unwrap();
    assert_eq!("test data", content);

    // Automatic cleanup when temp_dir drops
}
```

---

For more details, see:
- Module source: `crates/core/src/fileops.rs`
- Error types: `crates/core/src/error.rs`
- API documentation: Run `cargo doc --open`
- Full completion report: `PHASE-12-COMPLETION-REPORT.md`
