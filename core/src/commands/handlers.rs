//! Command handlers for different command types.
//!
//! This module provides concrete implementations of command handlers
//! for file operations, code analysis, git operations, system commands, and AI commands.

use super::executor::{CommandHandler, ExecutorError};
use super::types::{
    AICommand, CodeAnalysisCommand, Command, CommandContext, CommandResult, FileOperationCommand,
    GitCommand, SystemCommand,
};
use async_trait::async_trait;
use std::path::Path;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Handler for file operation commands
pub struct FileCommandHandler;

impl FileCommandHandler {
    /// Create a new file command handler
    pub fn new() -> Self {
        Self
    }

    /// Read a file
    async fn handle_read(
        &self,
        path: &Path,
        _encoding: &Option<String>,
    ) -> Result<CommandResult, ExecutorError> {
        match fs::read_to_string(path).await {
            Ok(content) => Ok(CommandResult::success(content)),
            Err(e) => Ok(CommandResult::failure(format!(
                "Failed to read file: {}",
                e
            ))),
        }
    }

    /// Write to a file
    async fn handle_write(
        &self,
        path: &Path,
        content: &str,
        create_dirs: bool,
    ) -> Result<CommandResult, ExecutorError> {
        // Create parent directories if needed
        if create_dirs {
            if let Some(parent) = path.parent() {
                if let Err(e) = fs::create_dir_all(parent).await {
                    return Ok(CommandResult::failure(format!(
                        "Failed to create directories: {}",
                        e
                    )));
                }
            }
        }

        match fs::write(path, content).await {
            Ok(_) => Ok(CommandResult::success(format!(
                "Successfully wrote to {}",
                path.display()
            ))),
            Err(e) => Ok(CommandResult::failure(format!(
                "Failed to write file: {}",
                e
            ))),
        }
    }

    /// Edit a file
    async fn handle_edit(
        &self,
        path: &Path,
        search: &str,
        replace: &str,
        all_occurrences: bool,
    ) -> Result<CommandResult, ExecutorError> {
        // Read file content
        let content = match fs::read_to_string(path).await {
            Ok(c) => c,
            Err(e) => {
                return Ok(CommandResult::failure(format!(
                    "Failed to read file: {}",
                    e
                )))
            }
        };

        // Perform replacement
        let new_content = if all_occurrences {
            content.replace(search, replace)
        } else {
            content.replacen(search, replace, 1)
        };

        // Write back
        match fs::write(path, &new_content).await {
            Ok(_) => Ok(CommandResult::success(format!(
                "Successfully edited {}",
                path.display()
            ))),
            Err(e) => Ok(CommandResult::failure(format!(
                "Failed to write file: {}",
                e
            ))),
        }
    }

    /// Delete a file or directory
    async fn handle_delete(
        &self,
        path: &Path,
        recursive: bool,
    ) -> Result<CommandResult, ExecutorError> {
        let metadata = match fs::metadata(path).await {
            Ok(m) => m,
            Err(e) => return Ok(CommandResult::failure(format!("Path not found: {}", e))),
        };

        let result = if metadata.is_dir() {
            if recursive {
                fs::remove_dir_all(path).await
            } else {
                fs::remove_dir(path).await
            }
        } else {
            fs::remove_file(path).await
        };

        match result {
            Ok(_) => Ok(CommandResult::success(format!(
                "Successfully deleted {}",
                path.display()
            ))),
            Err(e) => Ok(CommandResult::failure(format!("Failed to delete: {}", e))),
        }
    }

    /// Copy a file or directory
    async fn handle_copy(
        &self,
        from: &Path,
        to: &Path,
        overwrite: bool,
    ) -> Result<CommandResult, ExecutorError> {
        // Check if destination exists
        if !overwrite && to.exists() {
            return Ok(CommandResult::failure(format!(
                "Destination already exists: {}",
                to.display()
            )));
        }

        let metadata = match fs::metadata(from).await {
            Ok(m) => m,
            Err(e) => return Ok(CommandResult::failure(format!("Source not found: {}", e))),
        };

        let result = if metadata.is_dir() {
            self.copy_dir_recursive(from, to).await
        } else {
            fs::copy(from, to).await.map(|_| ())
        };

        match result {
            Ok(_) => Ok(CommandResult::success(format!(
                "Successfully copied {} to {}",
                from.display(),
                to.display()
            ))),
            Err(e) => Ok(CommandResult::failure(format!("Failed to copy: {}", e))),
        }
    }

    /// Recursively copy a directory
    fn copy_dir_recursive<'a>(
        &'a self,
        from: &'a Path,
        to: &'a Path,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), std::io::Error>> + Send + 'a>> {
        Box::pin(async move {
            fs::create_dir_all(to).await?;

            let mut entries = fs::read_dir(from).await?;
            while let Some(entry) = entries.next_entry().await? {
                let file_type = entry.file_type().await?;
                let from_path = entry.path();
                let to_path = to.join(entry.file_name());

                if file_type.is_dir() {
                    self.copy_dir_recursive(&from_path, &to_path).await?;
                } else {
                    fs::copy(&from_path, &to_path).await?;
                }
            }

            Ok(())
        })
    }

    /// Move/rename a file or directory
    async fn handle_move(
        &self,
        from: &Path,
        to: &Path,
        overwrite: bool,
    ) -> Result<CommandResult, ExecutorError> {
        // Check if destination exists
        if !overwrite && to.exists() {
            return Ok(CommandResult::failure(format!(
                "Destination already exists: {}",
                to.display()
            )));
        }

        match fs::rename(from, to).await {
            Ok(_) => Ok(CommandResult::success(format!(
                "Successfully moved {} to {}",
                from.display(),
                to.display()
            ))),
            Err(e) => Ok(CommandResult::failure(format!("Failed to move: {}", e))),
        }
    }

    /// List directory contents
    async fn handle_list(
        &self,
        path: &Path,
        recursive: bool,
        show_hidden: bool,
    ) -> Result<CommandResult, ExecutorError> {
        let mut output = String::new();

        if recursive {
            self.list_recursive(path, &mut output, 0, show_hidden)
                .await?;
        } else {
            self.list_dir(path, &mut output, show_hidden).await?;
        }

        Ok(CommandResult::success(output))
    }

    /// List a single directory
    async fn list_dir(
        &self,
        path: &Path,
        output: &mut String,
        show_hidden: bool,
    ) -> Result<(), ExecutorError> {
        let mut entries = fs::read_dir(path)
            .await
            .map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))?;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))?
        {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();

            // Skip hidden files if not requested
            if !show_hidden && name_str.starts_with('.') {
                continue;
            }

            let file_type = entry
                .file_type()
                .await
                .map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))?;

            let prefix = if file_type.is_dir() { "[DIR] " } else { "" };
            output.push_str(&format!("{}{}\n", prefix, name_str));
        }

        Ok(())
    }

    /// List directory recursively
    fn list_recursive<'a>(
        &'a self,
        path: &'a Path,
        output: &'a mut String,
        depth: usize,
        show_hidden: bool,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), ExecutorError>> + Send + 'a>> {
        Box::pin(async move {
            let indent = "  ".repeat(depth);

            let mut entries = fs::read_dir(path)
                .await
                .map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))?;

            while let Some(entry) = entries
                .next_entry()
                .await
                .map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))?
            {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();

                // Skip hidden files if not requested
                if !show_hidden && name_str.starts_with('.') {
                    continue;
                }

                let file_type = entry
                    .file_type()
                    .await
                    .map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))?;

                if file_type.is_dir() {
                    output.push_str(&format!("{}[DIR] {}\n", indent, name_str));
                    self.list_recursive(&entry.path(), output, depth + 1, show_hidden)
                        .await?;
                } else {
                    output.push_str(&format!("{}{}\n", indent, name_str));
                }
            }

            Ok(())
        })
    }
}

impl Default for FileCommandHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CommandHandler for FileCommandHandler {
    async fn execute(
        &self,
        command: &Command,
        _context: &CommandContext,
    ) -> Result<CommandResult, ExecutorError> {
        match command {
            Command::FileOperation(FileOperationCommand::Read { path, encoding }) => {
                self.handle_read(path, encoding).await
            }
            Command::FileOperation(FileOperationCommand::Write {
                path,
                content,
                create_dirs,
            }) => self.handle_write(path, content, *create_dirs).await,
            Command::FileOperation(FileOperationCommand::Edit {
                path,
                search,
                replace,
                all_occurrences,
            }) => {
                self.handle_edit(path, search, replace, *all_occurrences)
                    .await
            }
            Command::FileOperation(FileOperationCommand::Delete { path, recursive }) => {
                self.handle_delete(path, *recursive).await
            }
            Command::FileOperation(FileOperationCommand::Copy { from, to, overwrite }) => {
                self.handle_copy(from, to, *overwrite).await
            }
            Command::FileOperation(FileOperationCommand::Move { from, to, overwrite }) => {
                self.handle_move(from, to, *overwrite).await
            }
            Command::FileOperation(FileOperationCommand::List {
                path,
                recursive,
                show_hidden,
            }) => self.handle_list(path, *recursive, *show_hidden).await,
            _ => Err(ExecutorError::HandlerError(
                "Not a file operation".to_string(),
            )),
        }
    }

    fn can_handle(&self, command: &Command) -> bool {
        matches!(command, Command::FileOperation(_))
    }

    fn name(&self) -> &str {
        "FileCommandHandler"
    }
}

/// Handler for code analysis commands
pub struct CodeAnalysisHandler;

impl CodeAnalysisHandler {
    /// Create a new code analysis handler
    pub fn new() -> Self {
        Self
    }
}

impl Default for CodeAnalysisHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CommandHandler for CodeAnalysisHandler {
    async fn execute(
        &self,
        command: &Command,
        _context: &CommandContext,
    ) -> Result<CommandResult, ExecutorError> {
        match command {
            Command::CodeAnalysis(CodeAnalysisCommand::Analyze { path, .. }) => {
                Ok(CommandResult::success(format!(
                    "Code analysis for {} (not yet fully implemented)",
                    path.display()
                )))
            }
            Command::CodeAnalysis(CodeAnalysisCommand::Search { pattern, .. }) => {
                Ok(CommandResult::success(format!(
                    "Searching for '{}' (not yet fully implemented)",
                    pattern
                )))
            }
            Command::CodeAnalysis(CodeAnalysisCommand::Index { path, .. }) => {
                Ok(CommandResult::success(format!(
                    "Indexing {} (not yet fully implemented)",
                    path.display()
                )))
            }
            Command::CodeAnalysis(CodeAnalysisCommand::FindSymbol { symbol, .. }) => {
                Ok(CommandResult::success(format!(
                    "Finding symbol '{}' (not yet fully implemented)",
                    symbol
                )))
            }
            Command::CodeAnalysis(CodeAnalysisCommand::Metrics { path }) => {
                Ok(CommandResult::success(format!(
                    "Getting metrics for {} (not yet fully implemented)",
                    path.display()
                )))
            }
            _ => Err(ExecutorError::HandlerError(
                "Not a code analysis command".to_string(),
            )),
        }
    }

    fn can_handle(&self, command: &Command) -> bool {
        matches!(command, Command::CodeAnalysis(_))
    }

    fn name(&self) -> &str {
        "CodeAnalysisHandler"
    }
}

/// Handler for git commands
pub struct GitCommandHandler;

impl GitCommandHandler {
    /// Create a new git command handler
    pub fn new() -> Self {
        Self
    }
}

impl Default for GitCommandHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CommandHandler for GitCommandHandler {
    async fn execute(
        &self,
        command: &Command,
        _context: &CommandContext,
    ) -> Result<CommandResult, ExecutorError> {
        match command {
            Command::Git(GitCommand::Status { .. }) => Ok(CommandResult::success(
                "Git status (not yet fully implemented)".to_string(),
            )),
            Command::Git(GitCommand::Commit { message, .. }) => Ok(CommandResult::success(
                format!("Git commit '{}' (not yet fully implemented)", message),
            )),
            Command::Git(GitCommand::Push { .. }) => Ok(CommandResult::success(
                "Git push (not yet fully implemented)".to_string(),
            )),
            Command::Git(GitCommand::Pull { .. }) => Ok(CommandResult::success(
                "Git pull (not yet fully implemented)".to_string(),
            )),
            Command::Git(GitCommand::Branch { name, .. }) => Ok(CommandResult::success(
                format!("Git branch '{}' (not yet fully implemented)", name),
            )),
            Command::Git(GitCommand::Diff { .. }) => Ok(CommandResult::success(
                "Git diff (not yet fully implemented)".to_string(),
            )),
            Command::Git(GitCommand::Add { paths }) => Ok(CommandResult::success(format!(
                "Git add {} files (not yet fully implemented)",
                paths.len()
            ))),
            _ => Err(ExecutorError::HandlerError(
                "Not a git command".to_string(),
            )),
        }
    }

    fn can_handle(&self, command: &Command) -> bool {
        matches!(command, Command::Git(_))
    }

    fn name(&self) -> &str {
        "GitCommandHandler"
    }
}

/// Handler for system/shell commands
pub struct SystemCommandHandler;

impl SystemCommandHandler {
    /// Create a new system command handler
    pub fn new() -> Self {
        Self
    }
}

impl Default for SystemCommandHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CommandHandler for SystemCommandHandler {
    async fn execute(
        &self,
        command: &Command,
        _context: &CommandContext,
    ) -> Result<CommandResult, ExecutorError> {
        match command {
            Command::System(SystemCommand { command, .. }) => Ok(CommandResult::success(
                format!(
                    "System command '{}' (use ShellExecutor for full implementation)",
                    command
                ),
            )),
            _ => Err(ExecutorError::HandlerError(
                "Not a system command".to_string(),
            )),
        }
    }

    fn can_handle(&self, command: &Command) -> bool {
        matches!(command, Command::System(_))
    }

    fn name(&self) -> &str {
        "SystemCommandHandler"
    }
}

/// Handler for AI commands
pub struct AICommandHandler;

impl AICommandHandler {
    /// Create a new AI command handler
    pub fn new() -> Self {
        Self
    }
}

impl Default for AICommandHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CommandHandler for AICommandHandler {
    async fn execute(
        &self,
        command: &Command,
        _context: &CommandContext,
    ) -> Result<CommandResult, ExecutorError> {
        match command {
            Command::AI(AICommand::Query { question, .. }) => Ok(CommandResult::success(
                format!("AI query '{}' (not yet fully implemented)", question),
            )),
            Command::AI(AICommand::Explain { .. }) => Ok(CommandResult::success(
                "AI explain (not yet fully implemented)".to_string(),
            )),
            Command::AI(AICommand::Generate { description, .. }) => Ok(CommandResult::success(
                format!(
                    "AI generate '{}' (not yet fully implemented)",
                    description
                ),
            )),
            Command::AI(AICommand::Review { .. }) => Ok(CommandResult::success(
                "AI review (not yet fully implemented)".to_string(),
            )),
            Command::AI(AICommand::Refactor { .. }) => Ok(CommandResult::success(
                "AI refactor (not yet fully implemented)".to_string(),
            )),
            _ => Err(ExecutorError::HandlerError(
                "Not an AI command".to_string(),
            )),
        }
    }

    fn can_handle(&self, command: &Command) -> bool {
        matches!(command, Command::AI(_))
    }

    fn name(&self) -> &str {
        "AICommandHandler"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_file_handler_read_write() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        let handler = FileCommandHandler::new();
        let context = CommandContext::new(PathBuf::from("/tmp"));

        // Write
        let write_cmd = Command::FileOperation(FileOperationCommand::Write {
            path: file_path.clone(),
            content: "Hello, World!".to_string(),
            create_dirs: true,
        });

        let result = handler.execute(&write_cmd, &context).await.unwrap();
        assert!(result.is_success());

        // Read
        let read_cmd = Command::FileOperation(FileOperationCommand::Read {
            path: file_path,
            encoding: None,
        });

        let result = handler.execute(&read_cmd, &context).await.unwrap();
        assert!(result.is_success());
        assert_eq!(result.output().unwrap(), "Hello, World!");
    }

    #[tokio::test]
    async fn test_file_handler_can_handle() {
        let handler = FileCommandHandler::new();

        let file_cmd = Command::FileOperation(FileOperationCommand::Read {
            path: PathBuf::from("test.txt"),
            encoding: None,
        });

        let system_cmd = Command::System(SystemCommand {
            command: "test".to_string(),
            args: vec![],
            working_dir: None,
            env: Default::default(),
            timeout: None,
        });

        assert!(handler.can_handle(&file_cmd));
        assert!(!handler.can_handle(&system_cmd));
    }

    #[tokio::test]
    async fn test_handler_names() {
        assert_eq!(FileCommandHandler::new().name(), "FileCommandHandler");
        assert_eq!(CodeAnalysisHandler::new().name(), "CodeAnalysisHandler");
        assert_eq!(GitCommandHandler::new().name(), "GitCommandHandler");
        assert_eq!(SystemCommandHandler::new().name(), "SystemCommandHandler");
        assert_eq!(AICommandHandler::new().name(), "AICommandHandler");
    }
}
