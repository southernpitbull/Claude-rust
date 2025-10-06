//! Codebase Scanner
//! 
//! Scans and indexes codebase files for analysis

use ignore::WalkBuilder;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, info, warn};

/// Result type for codebase operations
pub type CodebaseResult<T> = Result<T, CodebaseError>;

/// Codebase operation errors
#[derive(Debug, thiserror::Error)]
pub enum CodebaseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Walk error: {0}")]
    Walk(String),
    
    #[error("Parse error: {0}")]
    Parse(String),
}

/// Code file information
#[derive(Debug, Clone)]
pub struct CodeFile {
    pub path: PathBuf,
    pub language: String,
    pub size: u64,
    pub content: String,
    pub lines: usize,
}

impl CodeFile {
    /// Create a new code file
    pub fn new(path: PathBuf, language: String, content: String) -> Self {
        let size = content.len() as u64;
        let lines = content.lines().count();
        
        Self {
            path,
            language,
            size,
            content,
            lines,
        }
    }
}

/// Codebase scanner configuration
#[derive(Debug, Clone)]
pub struct ScannerConfig {
    pub include_hidden: bool,
    pub max_file_size: Option<u64>, // in bytes
    pub file_extensions: Option<Vec<String>>,
    pub exclude_patterns: Vec<String>,
    pub max_depth: Option<usize>, // Maximum directory depth
    pub follow_symlinks: bool, // Follow symbolic links
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            include_hidden: false,
            max_file_size: Some(1024 * 1024), // 1MB
            file_extensions: None,
            exclude_patterns: vec![
                "node_modules".to_string(),
                ".git".to_string(),
                "target".to_string(),
                "dist".to_string(),
                "build".to_string(),
            ],
            max_depth: None, // No depth limit by default
            follow_symlinks: false, // Don't follow symlinks by default
        }
    }
}

/// Codebase scanner
pub struct CodebaseScanner {
    config: ScannerConfig,
}

impl CodebaseScanner {
    /// Create a new codebase scanner with default configuration
    pub fn new() -> Self {
        Self {
            config: ScannerConfig::default(),
        }
    }

    /// Create a new codebase scanner with custom configuration
    pub fn with_config(config: ScannerConfig) -> Self {
        Self { config }
    }

    /// Scan a directory for code files
    pub async fn scan<P: AsRef<Path>>(&self, root_path: P) -> CodebaseResult<Vec<CodeFile>> {
        let root_path = root_path.as_ref();
        info!("Scanning codebase: {:?}", root_path);

        let mut walk_builder = WalkBuilder::new(root_path);
        walk_builder
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .hidden(!self.config.include_hidden)
            .follow_links(self.config.follow_symlinks);

        // Set max depth if specified
        if let Some(max_depth) = self.config.max_depth {
            walk_builder.max_depth(Some(max_depth));
        }

        // Add exclude patterns
        let exclude_patterns = self.config.exclude_patterns.clone();
        walk_builder.filter_entry(move |entry| {
            if let Some(file_name) = entry.file_name().to_str() {
                !exclude_patterns.iter().any(|pattern| pattern.contains(file_name))
            } else {
                true
            }
        });

        let mut files = Vec::new();

        for result in walk_builder.build() {
            match result {
                Ok(entry) => {
                    if entry.file_type().map_or(false, |ft| ft.is_file()) {
                        if let Some(file_path) = entry.path().to_str() {
                            debug!("Processing file: {}", file_path);
                        }

                        // Check file extension if specified
                        if let Some(ref extensions) = self.config.file_extensions {
                            let has_valid_extension = entry.path()
                                .extension()
                                .and_then(|ext| ext.to_str())
                                .map(|ext| extensions.contains(&ext.to_lowercase()))
                                .unwrap_or(false);

                            if !has_valid_extension {
                                continue;
                            }
                        }

                        // Check file size
                        if let Some(max_size) = self.config.max_file_size {
                            if let Ok(metadata) = entry.metadata() {
                                if metadata.len() > max_size {
                                    warn!("Skipping large file: {:?}", entry.path());
                                    continue;
                                }
                            }
                        }

                        // Check if binary file
                        if self.is_binary(entry.path()).await {
                            debug!("Skipping binary file: {:?}", entry.path());
                            continue;
                        }

                        // Read file content
                        match self.read_file(entry.path()).await {
                            Ok(content) => {
                                let language = self.detect_language(entry.path());
                                let code_file = CodeFile::new(
                                    entry.path().to_path_buf(),
                                    language,
                                    content,
                                );
                                files.push(code_file);
                            }
                            Err(e) => {
                                warn!("Failed to read file {:?}: {}", entry.path(), e);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("Error walking directory: {}", e);
                }
            }
        }

        info!("Scanned {} files", files.len());
        Ok(files)
    }

    /// Read file content asynchronously
    async fn read_file<P: AsRef<Path>>(&self, path: P) -> CodebaseResult<String> {
        let content = fs::read_to_string(path).await
            .map_err(|e| CodebaseError::Io(e))?;

        Ok(content)
    }

    /// Check if file is binary by reading first few bytes
    async fn is_binary<P: AsRef<Path>>(&self, path: P) -> bool {
        match fs::read(path).await {
            Ok(bytes) => {
                // Check first 8KB for null bytes
                let sample_size = bytes.len().min(8192);
                bytes[..sample_size].contains(&0)
            }
            Err(_) => true, // Treat unreadable files as binary
        }
    }

    /// Detect programming language from file extension
    fn detect_language<P: AsRef<Path>>(&self, path: P) -> String {
        let path = path.as_ref();
        
        match path.extension().and_then(|ext| ext.to_str()) {
            Some("rs") => "rust".to_string(),
            Some("ts") => "typescript".to_string(),
            Some("js") => "javascript".to_string(),
            Some("tsx") => "tsx".to_string(),
            Some("jsx") => "jsx".to_string(),
            Some("py") => "python".to_string(),
            Some("java") => "java".to_string(),
            Some("cpp" | "cxx" | "cc" | "c++") => "cpp".to_string(),
            Some("c") => "c".to_string(),
            Some("h" | "hpp" | "hxx") => "c_header".to_string(),
            Some("go") => "go".to_string(),
            Some("rb") => "ruby".to_string(),
            Some("php") => "php".to_string(),
            Some("swift") => "swift".to_string(),
            Some("kt" | "kts") => "kotlin".to_string(),
            Some("scala" | "sc") => "scala".to_string(),
            Some("md") => "markdown".to_string(),
            Some("json") => "json".to_string(),
            Some("yaml" | "yml") => "yaml".to_string(),
            Some("toml") => "toml".to_string(),
            Some("xml") => "xml".to_string(),
            Some("html" | "htm") => "html".to_string(),
            Some("css") => "css".to_string(),
            Some("sql") => "sql".to_string(),
            _ => "unknown".to_string(),
        }
    }

    /// Get statistics about scanned files
    pub fn get_statistics(&self, files: &[CodeFile]) -> CodebaseStatistics {
        let mut stats = CodebaseStatistics::default();
        
        for file in files {
            stats.total_files += 1;
            stats.total_lines += file.lines;
            stats.total_size += file.size;
            
            *stats.languages.entry(file.language.clone()).or_insert(0) += 1;
            *stats.extensions.entry(
                file.path.extension()
                    .and_then(|ext| ext.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            ).or_insert(0) += 1;
        }
        
        stats
    }
}

impl Default for CodebaseScanner {
    fn default() -> Self {
        Self::new()
    }
}

/// Codebase statistics
#[derive(Debug, Default)]
pub struct CodebaseStatistics {
    pub total_files: usize,
    pub total_lines: usize,
    pub total_size: u64,
    pub languages: std::collections::HashMap<String, usize>,
    pub extensions: std::collections::HashMap<String, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_codebase_scanner_creation() {
        let scanner = CodebaseScanner::new();
        assert_eq!(scanner.config.max_file_size, Some(1024 * 1024));
    }

    #[tokio::test]
    async fn test_codebase_scanner_with_temp_dir() {
        let temp_dir = TempDir::new().unwrap();
        let code_file_path = temp_dir.path().join("test.rs");
        
        tokio::fs::write(&code_file_path, "fn main() { println!(\"Hello\"); }").await.unwrap();

        let scanner = CodebaseScanner::new();
        let files = scanner.scan(temp_dir.path()).await.unwrap();

        assert!(!files.is_empty());
        let file = &files[0];
        assert_eq!(file.language, "rust");
        assert!(file.content.contains("fn main()"));
    }

    #[tokio::test]
    async fn test_language_detection() {
        let scanner = CodebaseScanner::new();
        
        assert_eq!(scanner.detect_language("test.rs"), "rust");
        assert_eq!(scanner.detect_language("test.js"), "javascript");
        assert_eq!(scanner.detect_language("test.py"), "python");
        assert_eq!(scanner.detect_language("test.unknown"), "unknown");
    }

    #[tokio::test]
    async fn test_statistics() {
        let temp_dir = TempDir::new().unwrap();
        
        let file1_path = temp_dir.path().join("test1.rs");
        let file2_path = temp_dir.path().join("test2.js");
        
        tokio::fs::write(&file1_path, "fn main() {}").await.unwrap();
        tokio::fs::write(&file2_path, "function main() {}").await.unwrap();

        let scanner = CodebaseScanner::new();
        let files = scanner.scan(temp_dir.path()).await.unwrap();
        
        let stats = scanner.get_statistics(&files);
        assert_eq!(stats.total_files, 2);
        assert_eq!(stats.languages.get("rust"), Some(&1));
        assert_eq!(stats.languages.get("javascript"), Some(&1));
    }
}