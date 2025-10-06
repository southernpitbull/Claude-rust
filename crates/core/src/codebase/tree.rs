//! File Tree Module
//!
//! Provides file tree representation and visualization.

use crate::codebase::scanner::{Language, ScanResult};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};

/// A node in the file tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    /// Node name
    pub name: String,
    /// Full path
    pub path: PathBuf,
    /// Whether this is a directory
    pub is_dir: bool,
    /// File size (if file)
    pub size: Option<u64>,
    /// Language (if code file)
    pub language: Option<Language>,
    /// Child nodes (if directory)
    pub children: Vec<FileNode>,
}

impl FileNode {
    /// Create a new file node
    pub fn new(name: String, path: PathBuf, is_dir: bool) -> Self {
        Self {
            name,
            path,
            is_dir,
            size: None,
            language: None,
            children: Vec::new(),
        }
    }

    /// Create a file node
    pub fn file(name: String, path: PathBuf, size: u64, language: Option<Language>) -> Self {
        Self {
            name,
            path,
            is_dir: false,
            size: Some(size),
            language,
            children: Vec::new(),
        }
    }

    /// Create a directory node
    pub fn directory(name: String, path: PathBuf) -> Self {
        Self {
            name,
            path,
            is_dir: true,
            size: None,
            language: None,
            children: Vec::new(),
        }
    }

    /// Add a child node
    pub fn add_child(&mut self, child: FileNode) {
        self.children.push(child);
    }

    /// Sort children alphabetically (directories first)
    pub fn sort_children(&mut self) {
        self.children.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });

        // Recursively sort children
        for child in &mut self.children {
            if child.is_dir {
                child.sort_children();
            }
        }
    }

    /// Get total size of node and all children
    pub fn total_size(&self) -> u64 {
        let mut total = self.size.unwrap_or(0);
        for child in &self.children {
            total += child.total_size();
        }
        total
    }

    /// Count total files in this node and children
    pub fn file_count(&self) -> usize {
        let mut count = if self.is_dir { 0 } else { 1 };
        for child in &self.children {
            count += child.file_count();
        }
        count
    }

    /// Count total directories in this node and children
    pub fn dir_count(&self) -> usize {
        let mut count = if self.is_dir { 1 } else { 0 };
        for child in &self.children {
            count += child.dir_count();
        }
        count
    }

    /// Find a node by path
    pub fn find(&self, path: &Path) -> Option<&FileNode> {
        if self.path == path {
            return Some(self);
        }

        for child in &self.children {
            if let Some(found) = child.find(path) {
                return Some(found);
            }
        }

        None
    }

    /// Find a node by path (mutable)
    pub fn find_mut(&mut self, path: &Path) -> Option<&mut FileNode> {
        if self.path == path {
            return Some(self);
        }

        for child in &mut self.children {
            if let Some(found) = child.find_mut(path) {
                return Some(found);
            }
        }

        None
    }
}

/// Statistics about a file tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeStats {
    /// Total number of files
    pub file_count: usize,
    /// Total number of directories
    pub dir_count: usize,
    /// Total size in bytes
    pub total_size: u64,
    /// File count by language
    pub language_counts: HashMap<Language, usize>,
    /// Size by language
    pub language_sizes: HashMap<Language, u64>,
}

impl TreeStats {
    /// Create empty stats
    pub fn new() -> Self {
        Self {
            file_count: 0,
            dir_count: 0,
            total_size: 0,
            language_counts: HashMap::new(),
            language_sizes: HashMap::new(),
        }
    }

    /// Format size as human-readable string
    pub fn format_size(size: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut size = size as f64;
        let mut unit_idx = 0;

        while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
            size /= 1024.0;
            unit_idx += 1;
        }

        format!("{:.2} {}", size, UNITS[unit_idx])
    }
}

impl Default for TreeStats {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for TreeStats {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "Tree Statistics:")?;
        writeln!(f, "  Files: {}", self.file_count)?;
        writeln!(f, "  Directories: {}", self.dir_count)?;
        writeln!(f, "  Total Size: {}", Self::format_size(self.total_size))?;
        writeln!(f, "\nLanguage Breakdown:")?;

        let mut langs: Vec<_> = self.language_counts.iter().collect();
        langs.sort_by(|a, b| b.1.cmp(a.1));

        for (lang, count) in langs {
            let size = self.language_sizes.get(lang).unwrap_or(&0);
            writeln!(
                f,
                "  {:?}: {} files ({})",
                lang,
                count,
                Self::format_size(*size)
            )?;
        }

        Ok(())
    }
}

/// File tree representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTree {
    /// Root node
    root: FileNode,
}

impl FileTree {
    /// Create a new empty file tree
    pub fn new() -> Self {
        Self {
            root: FileNode::directory("root".to_string(), PathBuf::from(".")),
        }
    }

    /// Create a file tree from a scan result
    pub fn from_scan_result(scan_result: &ScanResult) -> AppResult<Self> {
        let root_path = &scan_result.root;
        let root_name = root_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("root")
            .to_string();

        let mut root = FileNode::directory(root_name, root_path.clone());

        // Build tree from scanned files
        for file in &scan_result.files {
            Self::insert_file(&mut root, file, root_path)?;
        }

        // Sort all nodes
        root.sort_children();

        Ok(Self { root })
    }

    /// Insert a file into the tree
    fn insert_file(
        root: &mut FileNode,
        file: &crate::codebase::scanner::ScannedFile,
        root_path: &Path,
    ) -> AppResult<()> {
        // Get relative path components
        let rel_path = file.path.strip_prefix(root_path).map_err(|e| {
            AppError::validation_error(format!(
                "Failed to get relative path for {:?}: {}",
                file.path, e
            ))
        })?;

        let components: Vec<_> = rel_path.components().collect();

        if components.is_empty() {
            return Ok(());
        }

        // Navigate/create directory structure
        let mut current = root;
        for (i, component) in components.iter().enumerate() {
            let component_str = component
                .as_os_str()
                .to_str()
                .ok_or_else(|| AppError::validation_error("Invalid path component"))?
                .to_string();

            let is_last = i == components.len() - 1;

            if is_last {
                // This is the file itself
                let file_node = FileNode::file(
                    component_str,
                    file.path.clone(),
                    file.size,
                    Some(file.language),
                );
                current.add_child(file_node);
            } else {
                // This is a directory in the path
                let dir_path = root_path.join(
                    components[..=i]
                        .iter()
                        .map(|c| c.as_os_str())
                        .collect::<PathBuf>(),
                );

                // Find or create directory node
                let dir_exists = current
                    .children
                    .iter()
                    .position(|c| c.is_dir && c.name == component_str);

                if let Some(idx) = dir_exists {
                    current = &mut current.children[idx];
                } else {
                    let dir_node = FileNode::directory(component_str, dir_path);
                    current.add_child(dir_node);
                    let idx = current.children.len() - 1;
                    current = &mut current.children[idx];
                }
            }
        }

        Ok(())
    }

    /// Get the root node
    pub fn root(&self) -> &FileNode {
        &self.root
    }

    /// Get the root node mutably
    pub fn root_mut(&mut self) -> &mut FileNode {
        &mut self.root
    }

    /// Calculate statistics for the tree
    pub fn stats(&self) -> TreeStats {
        let mut stats = TreeStats::new();
        self.calculate_stats(&self.root, &mut stats);
        stats
    }

    /// Helper to calculate stats recursively
    fn calculate_stats(&self, node: &FileNode, stats: &mut TreeStats) {
        if node.is_dir {
            stats.dir_count += 1;
            for child in &node.children {
                self.calculate_stats(child, stats);
            }
        } else {
            stats.file_count += 1;
            if let Some(size) = node.size {
                stats.total_size += size;
            }
            if let Some(lang) = node.language {
                *stats.language_counts.entry(lang).or_insert(0) += 1;
                if let Some(size) = node.size {
                    *stats.language_sizes.entry(lang).or_insert(0) += size;
                }
            }
        }
    }

    /// Render tree as ASCII art
    pub fn render(&self) -> String {
        let mut output = String::new();
        output.push_str(&format!("{}/\n", self.root.name));
        self.render_node(&self.root, "", true, &mut output);
        output
    }

    /// Helper to render a node recursively
    fn render_node(&self, node: &FileNode, prefix: &str, is_last: bool, output: &mut String) {
        for (i, child) in node.children.iter().enumerate() {
            let is_last_child = i == node.children.len() - 1;
            let connector = if is_last_child { "└── " } else { "├── " };
            let extension = if is_last_child { "    " } else { "│   " };

            let name = if child.is_dir {
                format!("{}/", child.name)
            } else {
                let mut name = child.name.clone();
                if let Some(size) = child.size {
                    name.push_str(&format!(" ({})", TreeStats::format_size(size)));
                }
                name
            };

            output.push_str(&format!("{}{}{}\n", prefix, connector, name));

            if child.is_dir && !child.children.is_empty() {
                let new_prefix = format!("{}{}", prefix, extension);
                self.render_node(child, &new_prefix, is_last_child, output);
            }
        }
    }

    /// Render tree with depth limit
    pub fn render_with_depth(&self, max_depth: usize) -> String {
        let mut output = String::new();
        output.push_str(&format!("{}/\n", self.root.name));
        self.render_node_with_depth(&self.root, "", true, 0, max_depth, &mut output);
        output
    }

    /// Helper to render a node with depth limit
    fn render_node_with_depth(
        &self,
        node: &FileNode,
        prefix: &str,
        is_last: bool,
        depth: usize,
        max_depth: usize,
        output: &mut String,
    ) {
        if depth >= max_depth {
            return;
        }

        for (i, child) in node.children.iter().enumerate() {
            let is_last_child = i == node.children.len() - 1;
            let connector = if is_last_child { "└── " } else { "├── " };
            let extension = if is_last_child { "    " } else { "│   " };

            let name = if child.is_dir {
                format!("{}/", child.name)
            } else {
                let mut name = child.name.clone();
                if let Some(size) = child.size {
                    name.push_str(&format!(" ({})", TreeStats::format_size(size)));
                }
                name
            };

            output.push_str(&format!("{}{}{}\n", prefix, connector, name));

            if child.is_dir && !child.children.is_empty() {
                let new_prefix = format!("{}{}", prefix, extension);
                self.render_node_with_depth(
                    child,
                    &new_prefix,
                    is_last_child,
                    depth + 1,
                    max_depth,
                    output,
                );
            }
        }
    }

    /// Find a node by path
    pub fn find(&self, path: &Path) -> Option<&FileNode> {
        self.root.find(path)
    }

    /// Find a node by path (mutable)
    pub fn find_mut(&mut self, path: &Path) -> Option<&mut FileNode> {
        self.root.find_mut(path)
    }
}

impl Default for FileTree {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for FileTree {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.render())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codebase::scanner::{CodebaseScanner, ScanOptions};
    use tempfile::TempDir;
    use tokio::fs;

    async fn setup_test_tree() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let root = temp_dir.path();

        // Create test file structure
        fs::write(root.join("file1.txt"), b"test1").await.unwrap();
        fs::write(root.join("file2.rs"), b"fn main() {}").await.unwrap();

        fs::create_dir(root.join("dir1")).await.unwrap();
        fs::write(root.join("dir1").join("file3.txt"), b"test3")
            .await
            .unwrap();

        fs::create_dir(root.join("dir1").join("subdir"))
            .await
            .unwrap();
        fs::write(
            root.join("dir1").join("subdir").join("file4.rs"),
            b"mod test;",
        )
        .await
        .unwrap();

        temp_dir
    }

    #[tokio::test]
    async fn test_tree_from_scan_result() {
        let temp_dir = setup_test_tree().await;
        let scanner = CodebaseScanner::with_options(ScanOptions::new().include_hidden(true));
        let scan_result = scanner.scan(temp_dir.path()).await.unwrap();

        let tree = FileTree::from_scan_result(&scan_result).unwrap();

        assert!(tree.root().is_dir);
        assert!(!tree.root().children.is_empty());
    }

    #[tokio::test]
    async fn test_tree_stats() {
        let temp_dir = setup_test_tree().await;
        let scanner = CodebaseScanner::with_options(ScanOptions::new().include_hidden(true));
        let scan_result = scanner.scan(temp_dir.path()).await.unwrap();

        let tree = FileTree::from_scan_result(&scan_result).unwrap();
        let stats = tree.stats();

        assert!(stats.file_count > 0);
        assert!(stats.dir_count > 0);
        assert!(stats.total_size > 0);
    }

    #[tokio::test]
    async fn test_tree_render() {
        let temp_dir = setup_test_tree().await;
        let scanner = CodebaseScanner::with_options(ScanOptions::new().include_hidden(true));
        let scan_result = scanner.scan(temp_dir.path()).await.unwrap();

        let tree = FileTree::from_scan_result(&scan_result).unwrap();
        let rendered = tree.render();

        assert!(!rendered.is_empty());
        assert!(rendered.contains("├──") || rendered.contains("└──"));
    }

    #[test]
    fn test_format_size() {
        assert_eq!(TreeStats::format_size(100), "100.00 B");
        assert_eq!(TreeStats::format_size(1024), "1.00 KB");
        assert_eq!(TreeStats::format_size(1024 * 1024), "1.00 MB");
        assert_eq!(TreeStats::format_size(1024 * 1024 * 1024), "1.00 GB");
    }

    #[tokio::test]
    async fn test_find_node() {
        let temp_dir = setup_test_tree().await;
        let scanner = CodebaseScanner::with_options(ScanOptions::new().include_hidden(true));
        let scan_result = scanner.scan(temp_dir.path()).await.unwrap();

        let tree = FileTree::from_scan_result(&scan_result).unwrap();

        // Try to find a file that exists
        let file_path = temp_dir.path().join("file1.txt");
        let found = tree.find(&file_path);
        assert!(found.is_some());
    }
}
