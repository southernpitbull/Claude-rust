//! CLAUDE.md Memory File Support
//!
//! This module provides support for discovering and loading CLAUDE.md files
//! that provide context and instructions to the AI assistant. Files are
//! loaded from multiple locations in a hierarchical manner:
//!
//! 1. Global: `~/.claude/CLAUDE.md`
//! 2. Project: `./CLAUDE.md`
//! 3. Subdirectory: `./.claude/CLAUDE.md`
//!
//! # Examples
//!
//! ```rust
//! use claude_rust_core::memory::ClaudeMemory;
//!
//! # async fn example() -> anyhow::Result<()> {
//! let mut memory = ClaudeMemory::new();
//! memory.discover_files()?;
//! let context = memory.load_content()?;
//! println!("Context: {}", context);
//! # Ok(())
//! # }
//! ```

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

/// The standard name for Claude memory files
pub const CLAUDE_MD_FILENAME: &str = "CLAUDE.md";

/// Frontmatter metadata that can be included in CLAUDE.md files
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeFrontmatter {
    /// Priority of this memory file (higher = more important)
    #[serde(default)]
    pub priority: u32,

    /// Whether this memory file should be included
    #[serde(default = "default_enabled")]
    pub enabled: bool,

    /// Tags for categorizing memory content
    #[serde(default)]
    pub tags: Vec<String>,

    /// Description of what this memory file contains
    #[serde(default)]
    pub description: Option<String>,
}

fn default_enabled() -> bool {
    true
}

/// Parsed content from a CLAUDE.md file
#[derive(Debug, Clone)]
pub struct ClaudeMemoryFile {
    /// Path to the source file
    pub path: PathBuf,

    /// Frontmatter metadata (if present)
    pub frontmatter: Option<ClaudeFrontmatter>,

    /// The actual content (without frontmatter)
    pub content: String,

    /// File type/location (global, project, or local)
    pub file_type: MemoryFileType,
}

/// Types of memory files based on their location
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum MemoryFileType {
    /// Global file in ~/.claude/CLAUDE.md
    Global,

    /// Project-level file in ./CLAUDE.md
    Project,

    /// Local/subdirectory file in ./.claude/CLAUDE.md
    Local,
}

impl MemoryFileType {
    /// Get the default priority for this file type
    pub fn default_priority(&self) -> u32 {
        match self {
            MemoryFileType::Global => 100,
            MemoryFileType::Project => 200,
            MemoryFileType::Local => 300,
        }
    }

    /// Get a display name for this file type
    pub fn name(&self) -> &'static str {
        match self {
            MemoryFileType::Global => "global",
            MemoryFileType::Project => "project",
            MemoryFileType::Local => "local",
        }
    }
}

/// Main struct for managing CLAUDE.md memory files
#[derive(Debug, Clone, Default)]
pub struct ClaudeMemory {
    /// Global memory file path
    pub global_file: Option<PathBuf>,

    /// Project-level memory file path
    pub project_file: Option<PathBuf>,

    /// Local/subdirectory memory file path
    pub local_file: Option<PathBuf>,

    /// Working directory for relative path resolution
    working_dir: PathBuf,
}

impl ClaudeMemory {
    /// Create a new ClaudeMemory instance
    ///
    /// # Examples
    ///
    /// ```rust
    /// use claude_rust_core::memory::ClaudeMemory;
    ///
    /// let memory = ClaudeMemory::new();
    /// ```
    pub fn new() -> Self {
        let working_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

        Self {
            global_file: None,
            project_file: None,
            local_file: None,
            working_dir,
        }
    }

    /// Create a ClaudeMemory instance with a specific working directory
    ///
    /// # Arguments
    ///
    /// * `working_dir` - The working directory to use for relative path resolution
    pub fn with_working_dir<P: Into<PathBuf>>(working_dir: P) -> Self {
        Self {
            global_file: None,
            project_file: None,
            local_file: None,
            working_dir: working_dir.into(),
        }
    }

    /// Discover all CLAUDE.md files in the standard locations
    ///
    /// This searches for:
    /// - `~/.claude/CLAUDE.md` (global)
    /// - `./CLAUDE.md` (project root)
    /// - `./.claude/CLAUDE.md` (local subdirectory)
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, even if no files are found.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use claude_rust_core::memory::ClaudeMemory;
    ///
    /// # fn example() -> anyhow::Result<()> {
    /// let mut memory = ClaudeMemory::new();
    /// memory.discover_files()?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn discover_files(&mut self) -> Result<()> {
        debug!("Discovering CLAUDE.md files");

        // 1. Global file: ~/.claude/CLAUDE.md
        if let Some(home_dir) = dirs::home_dir() {
            let global_path = home_dir.join(".claude").join(CLAUDE_MD_FILENAME);
            if global_path.exists() && global_path.is_file() {
                info!("Found global CLAUDE.md: {}", global_path.display());
                self.global_file = Some(global_path);
            }
        }

        // 2. Project file: ./CLAUDE.md
        let project_path = self.working_dir.join(CLAUDE_MD_FILENAME);
        if project_path.exists() && project_path.is_file() {
            info!("Found project CLAUDE.md: {}", project_path.display());
            self.project_file = Some(project_path);
        }

        // 3. Local file: ./.claude/CLAUDE.md
        let local_path = self.working_dir.join(".claude").join(CLAUDE_MD_FILENAME);
        if local_path.exists() && local_path.is_file() {
            info!("Found local CLAUDE.md: {}", local_path.display());
            self.local_file = Some(local_path);
        }

        let found_count = self.file_count();
        debug!("Discovered {} CLAUDE.md file(s)", found_count);

        Ok(())
    }

    /// Get the count of discovered files
    pub fn file_count(&self) -> usize {
        let mut count = 0;
        if self.global_file.is_some() {
            count += 1;
        }
        if self.project_file.is_some() {
            count += 1;
        }
        if self.local_file.is_some() {
            count += 1;
        }
        count
    }

    /// Parse a CLAUDE.md file and extract frontmatter + content
    ///
    /// Frontmatter is YAML enclosed in `---` delimiters at the start of the file.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the CLAUDE.md file
    /// * `file_type` - Type of the file (global, project, or local)
    fn parse_file(&self, path: &Path, file_type: MemoryFileType) -> Result<ClaudeMemoryFile> {
        let raw_content = fs::read_to_string(path)
            .with_context(|| format!("Failed to read CLAUDE.md file: {}", path.display()))?;

        // Check for frontmatter (YAML between --- delimiters)
        let (frontmatter, content) = if raw_content.starts_with("---\n") || raw_content.starts_with("---\r\n") {
            // Find the closing delimiter
            let lines: Vec<&str> = raw_content.lines().collect();
            if let Some(end_idx) = lines.iter().skip(1).position(|line| line.trim() == "---") {
                let frontmatter_lines = &lines[1..=end_idx];
                let content_lines = &lines[end_idx + 1..];

                let frontmatter_yaml = frontmatter_lines.join("\n");
                let content = content_lines.join("\n").trim().to_string();

                // Parse YAML frontmatter
                match serde_yaml::from_str::<ClaudeFrontmatter>(&frontmatter_yaml) {
                    Ok(fm) => (Some(fm), content),
                    Err(e) => {
                        warn!("Failed to parse frontmatter in {}: {}", path.display(), e);
                        (None, raw_content.clone())
                    }
                }
            } else {
                // No closing delimiter found
                (None, raw_content)
            }
        } else {
            // No frontmatter
            (None, raw_content)
        };

        Ok(ClaudeMemoryFile {
            path: path.to_path_buf(),
            frontmatter,
            content: content.trim().to_string(),
            file_type,
        })
    }

    /// Load all discovered memory files
    ///
    /// # Returns
    ///
    /// Returns a vector of parsed memory files, sorted by priority (global < project < local)
    pub fn load_files(&self) -> Result<Vec<ClaudeMemoryFile>> {
        let mut files = Vec::new();

        // Load global file
        if let Some(path) = &self.global_file {
            match self.parse_file(path, MemoryFileType::Global) {
                Ok(file) => {
                    if file.frontmatter.as_ref().map(|fm| fm.enabled).unwrap_or(true) {
                        files.push(file);
                    }
                }
                Err(e) => {
                    warn!("Failed to parse global CLAUDE.md: {}", e);
                }
            }
        }

        // Load project file
        if let Some(path) = &self.project_file {
            match self.parse_file(path, MemoryFileType::Project) {
                Ok(file) => {
                    if file.frontmatter.as_ref().map(|fm| fm.enabled).unwrap_or(true) {
                        files.push(file);
                    }
                }
                Err(e) => {
                    warn!("Failed to parse project CLAUDE.md: {}", e);
                }
            }
        }

        // Load local file
        if let Some(path) = &self.local_file {
            match self.parse_file(path, MemoryFileType::Local) {
                Ok(file) => {
                    if file.frontmatter.as_ref().map(|fm| fm.enabled).unwrap_or(true) {
                        files.push(file);
                    }
                }
                Err(e) => {
                    warn!("Failed to parse local CLAUDE.md: {}", e);
                }
            }
        }

        // Sort by priority (file type priority, then frontmatter priority)
        files.sort_by_key(|f| {
            let base_priority = f.file_type.default_priority();
            let fm_priority = f.frontmatter.as_ref().map(|fm| fm.priority).unwrap_or(0);
            base_priority + fm_priority
        });

        Ok(files)
    }

    /// Load and merge all CLAUDE.md content into a single string
    ///
    /// Files are concatenated in order of priority (global → project → local),
    /// separated by blank lines and section headers.
    ///
    /// # Returns
    ///
    /// Returns the merged content string, or an empty string if no files found.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use claude_rust_core::memory::ClaudeMemory;
    ///
    /// # fn example() -> anyhow::Result<()> {
    /// let mut memory = ClaudeMemory::new();
    /// memory.discover_files()?;
    /// let content = memory.load_content()?;
    /// println!("Merged content length: {}", content.len());
    /// # Ok(())
    /// # }
    /// ```
    pub fn load_content(&self) -> Result<String> {
        let files = self.load_files()?;

        if files.is_empty() {
            debug!("No CLAUDE.md files to load");
            return Ok(String::new());
        }

        let mut merged_content = String::new();

        for (idx, file) in files.iter().enumerate() {
            if idx > 0 {
                merged_content.push_str("\n\n");
            }

            // Add section header
            merged_content.push_str(&format!(
                "# claudeMd\nCodebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.\n\nContents of {} (user's private {} instructions for all projects):\n\n",
                file.path.display(),
                file.file_type.name()
            ));

            // Add content
            merged_content.push_str(&file.content);
        }

        Ok(merged_content)
    }

    /// Get formatted context string suitable for system messages
    ///
    /// This wraps the merged content in a system reminder block.
    ///
    /// # Returns
    ///
    /// Returns formatted context string, or an empty string if no files found.
    pub fn get_context(&self) -> Result<String> {
        let content = self.load_content()?;

        if content.is_empty() {
            return Ok(String::new());
        }

        let context = format!(
            "<system-reminder>\nAs you answer the user's questions, you can use the following context:\n{}\n\n      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n</system-reminder>",
            content
        );

        Ok(context)
    }

    /// Get a list of all discovered file paths
    pub fn get_file_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        if let Some(path) = &self.global_file {
            paths.push(path.clone());
        }
        if let Some(path) = &self.project_file {
            paths.push(path.clone());
        }
        if let Some(path) = &self.local_file {
            paths.push(path.clone());
        }

        paths
    }

    /// Check if any memory files were discovered
    pub fn has_files(&self) -> bool {
        self.global_file.is_some() || self.project_file.is_some() || self.local_file.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_new_memory() {
        let memory = ClaudeMemory::new();
        assert_eq!(memory.file_count(), 0);
    }

    #[test]
    fn test_discover_files() {
        let temp_dir = TempDir::new().unwrap();
        let temp_path = temp_dir.path();

        // Create test files
        fs::write(temp_path.join("CLAUDE.md"), "# Project instructions").unwrap();

        let claude_dir = temp_path.join(".claude");
        fs::create_dir(&claude_dir).unwrap();
        fs::write(claude_dir.join("CLAUDE.md"), "# Local instructions").unwrap();

        let mut memory = ClaudeMemory::with_working_dir(temp_path);
        memory.discover_files().unwrap();

        assert_eq!(memory.file_count(), 2);
        assert!(memory.project_file.is_some());
        assert!(memory.local_file.is_some());
    }

    #[test]
    fn test_parse_file_with_frontmatter() {
        let temp_dir = TempDir::new().unwrap();
        let temp_path = temp_dir.path();
        let file_path = temp_path.join("test.md");

        let content = r#"---
priority: 10
enabled: true
tags: ["testing", "example"]
description: "Test file"
---

# Test Content

This is test content."#;

        fs::write(&file_path, content).unwrap();

        let memory = ClaudeMemory::new();
        let parsed = memory.parse_file(&file_path, MemoryFileType::Project).unwrap();

        assert!(parsed.frontmatter.is_some());
        let fm = parsed.frontmatter.unwrap();
        assert_eq!(fm.priority, 10);
        assert!(fm.enabled);
        assert_eq!(fm.tags, vec!["testing", "example"]);
        assert!(parsed.content.contains("# Test Content"));
        assert!(!parsed.content.contains("---"));
    }

    #[test]
    fn test_load_content() {
        let temp_dir = TempDir::new().unwrap();
        let temp_path = temp_dir.path();

        fs::write(temp_path.join("CLAUDE.md"), "Project content").unwrap();

        let mut memory = ClaudeMemory::with_working_dir(temp_path);
        memory.discover_files().unwrap();

        let content = memory.load_content().unwrap();
        assert!(content.contains("Project content"));
    }

    #[test]
    fn test_memory_file_type_priority() {
        assert!(MemoryFileType::Local.default_priority() > MemoryFileType::Project.default_priority());
        assert!(MemoryFileType::Project.default_priority() > MemoryFileType::Global.default_priority());
    }
}
