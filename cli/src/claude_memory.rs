//! CLAUDE.md Memory Files
//!
//! Handles discovery, loading, and integration of CLAUDE.md memory files
//! that provide context and project-specific information to the AI.

use anyhow::Result;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// CLAUDE.md memory file handler
pub struct ClaudeMemory {
    /// Loaded memory files indexed by path
    files: HashMap<PathBuf, ClaudeMdFile>,
    
    /// Combined context from all memory files
    combined_context: String,
}

/// Individual CLAUDE.md file
#[derive(Debug, Clone)]
pub struct ClaudeMdFile {
    /// File path
    pub path: PathBuf,
    
    /// Raw file content
    pub content: String,
    
    /// Parsed sections
    pub sections: HashMap<String, String>,
    
    /// File metadata
    pub metadata: HashMap<String, String>,
    
    /// Priority level (higher numbers = higher priority)
    pub priority: u32,
}

impl ClaudeMemory {
    /// Create a new CLAUDE.md memory handler
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
            combined_context: String::new(),
        }
    }
    
    /// Discover and load CLAUDE.md files from the hierarchy
    pub fn load_from_hierarchy(base_path: &Path) -> Result<Self> {
        let mut memory = Self::new();
        
        // Discover CLAUDE.md files in the hierarchy
        let files = memory.discover_files(base_path)?;
        
        // Load each file
        for file_path in files {
            match memory.load_file(&file_path) {
                Ok(claude_md_file) => {
                    info!("Loaded CLAUDE.md file: {}", file_path.display());
                    memory.files.insert(file_path.clone(), claude_md_file);
                }
                Err(e) => {
                    warn!("Failed to load CLAUDE.md file {}: {}", file_path.display(), e);
                }
            }
        }
        
        // Combine all contexts
        memory.combine_contexts();
        
        Ok(memory)
    }
    
    /// Discover CLAUDE.md files in the hierarchy
    fn discover_files(&self, base_path: &Path) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();
        
        // Check for global CLAUDE.md (~/.claude/CLAUDE.md)
        if let Some(home_dir) = dirs::home_dir() {
            let global_path = home_dir.join(".claude").join("CLAUDE.md");
            if global_path.exists() {
                files.push(global_path);
            }
        }
        
        // Walk up the directory hierarchy looking for CLAUDE.md files
        let mut current_path = base_path.to_path_buf();
        loop {
            let claude_md_path = current_path.join("CLAUDE.md");
            if claude_md_path.exists() {
                files.push(claude_md_path);
            }
            
            // Move to parent directory
            if !current_path.pop() {
                break; // Reached root
            }
            
            // Stop at filesystem root to avoid infinite loop
            if current_path.parent().is_none() {
                break;
            }
        }
        
        // Sort by priority (files closer to base_path have higher priority)
        files.sort_by(|a, b| {
            // Count path components to determine depth
            let a_depth = a.components().count();
            let b_depth = b.components().count();
            b_depth.cmp(&a_depth) // Reverse order (deeper paths first)
        });
        
        debug!("Discovered {} CLAUDE.md files", files.len());
        for (i, file) in files.iter().enumerate() {
            debug!("  {}. {}", i + 1, file.display());
        }
        
        Ok(files)
    }
    
    /// Load a single CLAUDE.md file
    fn load_file(&self, file_path: &Path) -> Result<ClaudeMdFile> {
        let content = fs::read_to_string(file_path)?;
        
        // Parse the file content
        let (metadata, sections) = self.parse_claude_md(&content)?;
        
        // Determine priority based on file location
        let priority = self.calculate_priority(file_path)?;
        
        Ok(ClaudeMdFile {
            path: file_path.to_path_buf(),
            content,
            sections,
            metadata,
            priority,
        })
    }
    
    /// Parse CLAUDE.md content into metadata and sections
    fn parse_claude_md(&self, content: &str) -> Result<(HashMap<String, String>, HashMap<String, String>)> {
        let mut metadata = HashMap::new();
        let mut sections = HashMap::new();
        
        // Check for YAML frontmatter
        let content_without_frontmatter = if content.starts_with("---") {
            let lines: Vec<&str> = content.lines().collect();
            let mut frontmatter_end = 0;
            
            // Find end of frontmatter (second ---)
            for (i, line) in lines.iter().enumerate().skip(1) {
                if line.trim() == "---" {
                    frontmatter_end = i + 1;
                    break;
                } else if let Some(colon_pos) = line.find(':') {
                    let key = line[..colon_pos].trim();
                    let value = line[colon_pos + 1..].trim();
                    metadata.insert(key.to_string(), value.to_string());
                }
            }
            
            // Return content without frontmatter
            lines[frontmatter_end..].join("\n")
        } else {
            content.to_string()
        };
        
        // Parse sections (Markdown headings)
        let mut current_section = "default".to_string();
        let mut current_content = String::new();
        
        for line in content_without_frontmatter.lines() {
            if line.starts_with("#") {
                // Save previous section
                if !current_content.trim().is_empty() {
                    sections.insert(current_section.clone(), current_content.trim().to_string());
                }
                
                // Start new section (remove # and whitespace)
                current_section = line.trim_start_matches('#').trim().to_string();
                current_content = String::new();
            } else {
                current_content.push_str(line);
                current_content.push('\n');
            }
        }
        
        // Save final section
        if !current_content.trim().is_empty() {
            sections.insert(current_section, current_content.trim().to_string());
        }
        
        Ok((metadata, sections))
    }
    
    /// Calculate priority based on file location
    fn calculate_priority(&self, file_path: &Path) -> Result<u32> {
        // Higher priority for files closer to the current directory
        // Global files get lowest priority (100)
        // Project root files get medium priority (500)  
        // Subdirectory files get highest priority (1000+)
        
        if let Some(home_dir) = dirs::home_dir() {
            if file_path.starts_with(home_dir.join(".claude")) {
                return Ok(100); // Global file
            }
        }
        
        // Count path components to determine depth relative to current dir
        let component_count = file_path.components().count();
        let base_component_count = std::env::current_dir()
            .map(|d| d.components().count())
            .unwrap_or(0);
            
        let depth_difference = if component_count > base_component_count {
            component_count - base_component_count
        } else {
            0
        };
        
        // Priority increases with depth (closer to current dir = higher priority)
        Ok(500 + (depth_difference as u32) * 100)
    }
    
    /// Combine contexts from all loaded files
    fn combine_contexts(&mut self) {
        let mut combined = String::new();
        
        // Sort files by priority (highest first)
        let mut files: Vec<(&PathBuf, &ClaudeMdFile)> = self.files.iter().collect();
        files.sort_by(|a, b| b.1.priority.cmp(&a.1.priority));
        
        // Add context header
        combined.push_str("## Project Context Information\n\n");
        combined.push_str("The following information provides context about this project:\n\n");
        
        // Add each file's content with appropriate headers
        for (path, file) in files {
            combined.push_str(&format!("### Context from: {}\n\n", path.display()));
            
            // Add metadata if present
            if !file.metadata.is_empty() {
                combined.push_str("#### Metadata\n\n");
                for (key, value) in &file.metadata {
                    combined.push_str(&format!("- **{}**: {}\n", key, value));
                }
                combined.push('\n');
            }
            
            // Add sections
            if file.sections.is_empty() {
                // No sections, add raw content
                combined.push_str(&file.content);
                combined.push('\n');
            } else {
                // Add sections
                for (section_name, section_content) in &file.sections {
                    if section_name != "default" && !section_name.is_empty() {
                        combined.push_str(&format!("#### {}\n\n", section_name));
                    }
                    combined.push_str(section_content);
                    combined.push('\n');
                }
            }
            
            combined.push_str("\n---\n\n");
        }
        
        self.combined_context = combined;
    }
    
    /// Get combined context for inclusion in AI prompts
    pub fn get_combined_context(&self) -> &str {
        &self.combined_context
    }
    
    /// Get individual file content
    pub fn get_file_content(&self, path: &Path) -> Option<&str> {
        self.files.get(path).map(|f| f.content.as_str())
    }
    
    /// Get specific section from a file
    pub fn get_section(&self, path: &Path, section: &str) -> Option<&str> {
        self.files.get(path)
            .and_then(|f| f.sections.get(section))
            .map(|s| s.as_str())
    }
    
    /// Check if any CLAUDE.md files were loaded
    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }
    
    /// Get number of loaded files
    pub fn len(&self) -> usize {
        self.files.len()
    }
}

impl Default for ClaudeMemory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_claude_memory_new() {
        let memory = ClaudeMemory::new();
        assert!(memory.is_empty());
        assert_eq!(memory.len(), 0);
        assert_eq!(memory.get_combined_context(), "");
    }
    
    #[test]
    fn test_parse_simple_claude_md() {
        let memory = ClaudeMemory::new();
        let content = "# Project Info\n\nThis is a test project.";
        
        let (metadata, sections) = memory.parse_claude_md(content).unwrap();
        assert!(metadata.is_empty());
        assert_eq!(sections.len(), 1);
        assert_eq!(sections.get("Project Info"), Some(&"This is a test project.".to_string()));
    }
    
    #[test]
    fn test_parse_claude_md_with_frontmatter() {
        let memory = ClaudeMemory::new();
        let content = "---\ntitle: Test Project\nversion: 1.0\n---\n\n# Introduction\n\nWelcome to the project.";
        
        let (metadata, sections) = memory.parse_claude_md(content).unwrap();
        assert_eq!(metadata.get("title"), Some(&"Test Project".to_string()));
        assert_eq!(metadata.get("version"), Some(&"1.0".to_string()));
        assert_eq!(sections.len(), 1);
        assert_eq!(sections.get("Introduction"), Some(&"Welcome to the project.".to_string()));
    }
}