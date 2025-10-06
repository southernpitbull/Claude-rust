//! Codebase Indexer Module
//!
//! Provides code indexing and symbol extraction capabilities with fast lookup.

use crate::error::{AppError, AppResult};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, info, warn};

/// Type of symbol
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SymbolKind {
    /// Function definition
    Function,
    /// Struct/Class definition
    Struct,
    /// Enum definition
    Enum,
    /// Trait/Interface definition
    Trait,
    /// Type alias
    Type,
    /// Constant
    Constant,
    /// Module
    Module,
    /// Import/Use statement
    Import,
    /// Macro
    Macro,
    /// Variable
    Variable,
}

/// A symbol in the codebase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    /// Symbol name
    pub name: String,
    /// Symbol kind
    pub kind: SymbolKind,
    /// File path
    pub file: PathBuf,
    /// Line number
    pub line: usize,
    /// Column number (if available)
    pub column: Option<usize>,
    /// Symbol signature or definition
    pub signature: String,
    /// Documentation comment (if available)
    pub documentation: Option<String>,
}

/// An index entry for a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    /// File path
    pub path: PathBuf,
    /// File size
    pub size: u64,
    /// Last modified time (as Unix timestamp)
    pub modified: u64,
    /// Symbols found in this file
    pub symbols: Vec<Symbol>,
    /// Content hash (for change detection)
    pub content_hash: String,
}

/// Codebase index version for compatibility tracking
pub const INDEX_VERSION: u32 = 1;

/// Codebase index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseIndex {
    /// Index format version
    #[serde(default = "default_version")]
    version: u32,

    /// Index entries by file path
    entries: HashMap<PathBuf, IndexEntry>,

    /// Symbol name to locations mapping
    symbol_index: HashMap<String, Vec<Symbol>>,

    /// Timestamp when index was created
    #[serde(default = "chrono::Utc::now")]
    created_at: chrono::DateTime<chrono::Utc>,

    /// Timestamp when index was last updated
    #[serde(default = "chrono::Utc::now")]
    updated_at: chrono::DateTime<chrono::Utc>,
}

fn default_version() -> u32 {
    INDEX_VERSION
}

impl Default for CodebaseIndex {
    fn default() -> Self {
        Self::new()
    }
}

impl CodebaseIndex {
    /// Create a new empty index
    pub fn new() -> Self {
        let now = chrono::Utc::now();
        Self {
            version: INDEX_VERSION,
            entries: HashMap::new(),
            symbol_index: HashMap::new(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Get the index version
    pub fn version(&self) -> u32 {
        self.version
    }

    /// Check if index version is compatible
    pub fn is_compatible(&self) -> bool {
        self.version == INDEX_VERSION
    }

    /// Get creation timestamp
    pub fn created_at(&self) -> chrono::DateTime<chrono::Utc> {
        self.created_at
    }

    /// Get last update timestamp
    pub fn updated_at(&self) -> chrono::DateTime<chrono::Utc> {
        self.updated_at
    }

    /// Mark index as updated
    fn mark_updated(&mut self) {
        self.updated_at = chrono::Utc::now();
    }

    /// Index a file
    pub async fn index_file<P: AsRef<Path>>(&mut self, path: P) -> AppResult<()> {
        let path = path.as_ref();
        debug!("Indexing file: {:?}", path);

        if !path.exists() {
            return Err(AppError::file_not_found(path));
        }

        // Read file content
        let content = fs::read_to_string(path).await.map_err(|e| {
            AppError::io_error(format!("Failed to read file {:?}: {}", path, e))
        })?;

        // Get file metadata
        let metadata = fs::metadata(path).await.map_err(|e| {
            AppError::io_error(format!("Failed to get metadata for {:?}: {}", path, e))
        })?;

        let size = metadata.len();
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Calculate content hash
        let content_hash = Self::hash_content(&content);

        // Check if file has changed
        if let Some(existing) = self.entries.get(path) {
            if existing.content_hash == content_hash {
                debug!("File {:?} unchanged, skipping reindex", path);
                return Ok(());
            }
        }

        // Extract symbols
        let symbols = Self::extract_symbols(path, &content)?;

        // Create index entry
        let entry = IndexEntry {
            path: path.to_path_buf(),
            size,
            modified,
            symbols: symbols.clone(),
            content_hash,
        };

        // Update main index
        if let Some(old_entry) = self.entries.insert(path.to_path_buf(), entry) {
            // Remove old symbols from symbol index
            for symbol in &old_entry.symbols {
                if let Some(locations) = self.symbol_index.get_mut(&symbol.name) {
                    locations.retain(|s| s.file != path);
                }
            }
        }

        // Add new symbols to symbol index
        for symbol in symbols {
            self.symbol_index
                .entry(symbol.name.clone())
                .or_insert_with(Vec::new)
                .push(symbol);
        }

        self.mark_updated();
        info!("Successfully indexed file: {:?}", path);
        Ok(())
    }

    /// Index multiple files
    pub async fn index_files<P: AsRef<Path>>(&mut self, paths: &[P]) -> AppResult<()> {
        for path in paths {
            if let Err(e) = self.index_file(path).await {
                warn!("Failed to index file {:?}: {}", path.as_ref(), e);
            }
        }
        Ok(())
    }

    /// Find symbols by name
    pub fn find_symbol(&self, name: &str) -> Option<&Vec<Symbol>> {
        self.symbol_index.get(name)
    }

    /// Find symbols by name pattern
    pub fn find_symbols_pattern(&self, pattern: &str) -> AppResult<Vec<&Symbol>> {
        self.find_symbols_pattern_with_options(pattern, true, false)
    }

    /// Find symbols by name pattern with search options
    pub fn find_symbols_pattern_with_options(
        &self,
        pattern: &str,
        case_sensitive: bool,
        whole_word: bool,
    ) -> AppResult<Vec<&Symbol>> {
        // Build regex pattern with options
        let mut regex_pattern = if whole_word {
            format!(r"\b{}\b", regex::escape(pattern))
        } else {
            pattern.to_string()
        };

        // Add case-insensitive flag if needed
        if !case_sensitive {
            regex_pattern = format!("(?i){}", regex_pattern);
        }

        let regex = Regex::new(&regex_pattern)
            .map_err(|e| AppError::validation_error(format!("Invalid regex pattern: {}", e)))?;

        let mut results = Vec::new();
        for (name, symbols) in &self.symbol_index {
            if regex.is_match(name) {
                results.extend(symbols.iter());
            }
        }

        Ok(results)
    }

    /// Find symbols with case-sensitive search
    pub fn find_symbols_case_sensitive(&self, pattern: &str) -> AppResult<Vec<&Symbol>> {
        self.find_symbols_pattern_with_options(pattern, true, false)
    }

    /// Find symbols with case-insensitive search
    pub fn find_symbols_case_insensitive(&self, pattern: &str) -> AppResult<Vec<&Symbol>> {
        self.find_symbols_pattern_with_options(pattern, false, false)
    }

    /// Find symbols matching whole word only
    pub fn find_symbols_whole_word(&self, pattern: &str) -> AppResult<Vec<&Symbol>> {
        self.find_symbols_pattern_with_options(pattern, true, true)
    }

    /// Find symbols by kind
    pub fn find_symbols_by_kind(&self, kind: SymbolKind) -> Vec<&Symbol> {
        self.symbol_index
            .values()
            .flat_map(|symbols| symbols.iter())
            .filter(|s| s.kind == kind)
            .collect()
    }

    /// Get index entry for a file
    pub fn get_entry<P: AsRef<Path>>(&self, path: P) -> Option<&IndexEntry> {
        self.entries.get(path.as_ref())
    }

    /// Get all indexed files
    pub fn files(&self) -> Vec<&PathBuf> {
        self.entries.keys().collect()
    }

    /// Get total number of symbols
    pub fn symbol_count(&self) -> usize {
        self.symbol_index.values().map(|v| v.len()).sum()
    }

    /// Get total number of indexed files
    pub fn file_count(&self) -> usize {
        self.entries.len()
    }

    /// Clear the index
    pub fn clear(&mut self) {
        self.entries.clear();
        self.symbol_index.clear();
        self.mark_updated();
    }

    /// Validate index integrity
    pub fn validate_integrity(&self) -> AppResult<()> {
        // Check version compatibility
        if !self.is_compatible() {
            return Err(AppError::validation_error(format!(
                "Incompatible index version: {} (expected {})",
                self.version, INDEX_VERSION
            )));
        }

        // Validate that all symbols in symbol_index reference existing entries
        for (name, symbols) in &self.symbol_index {
            for symbol in symbols {
                if !self.entries.contains_key(&symbol.file) {
                    return Err(AppError::validation_error(format!(
                        "Symbol '{}' references non-existent file: {:?}",
                        name, symbol.file
                    )));
                }

                // Verify symbol exists in the file's entry
                if let Some(entry) = self.entries.get(&symbol.file) {
                    if !entry.symbols.iter().any(|s| s.name == *name) {
                        return Err(AppError::validation_error(format!(
                            "Symbol '{}' not found in file entry for: {:?}",
                            name, symbol.file
                        )));
                    }
                }
            }
        }

        // Validate that all entry symbols are in symbol_index
        for (path, entry) in &self.entries {
            for symbol in &entry.symbols {
                if let Some(indexed_symbols) = self.symbol_index.get(&symbol.name) {
                    if !indexed_symbols.iter().any(|s| s.file == *path) {
                        return Err(AppError::validation_error(format!(
                            "Entry symbol '{}' from {:?} not in symbol index",
                            symbol.name, path
                        )));
                    }
                } else {
                    return Err(AppError::validation_error(format!(
                        "Entry symbol '{}' from {:?} missing from symbol index",
                        symbol.name, path
                    )));
                }
            }
        }

        Ok(())
    }

    /// Remove entries for files that no longer exist
    pub async fn cleanup_stale_entries(&mut self) -> AppResult<usize> {
        let mut removed_count = 0;
        let mut paths_to_remove = Vec::new();

        // Find files that no longer exist
        for path in self.entries.keys() {
            if !path.exists() {
                paths_to_remove.push(path.clone());
            }
        }

        // Remove stale entries
        for path in &paths_to_remove {
            if let Some(entry) = self.entries.remove(path) {
                // Remove symbols from symbol index
                for symbol in &entry.symbols {
                    if let Some(locations) = self.symbol_index.get_mut(&symbol.name) {
                        locations.retain(|s| &s.file != path);
                        // Remove empty symbol entries
                        if locations.is_empty() {
                            self.symbol_index.remove(&symbol.name);
                        }
                    }
                }
                removed_count += 1;
            }
        }

        if removed_count > 0 {
            self.mark_updated();
            info!("Cleaned up {} stale index entries", removed_count);
        }

        Ok(removed_count)
    }

    /// Rebuild the symbol index from entries
    pub fn rebuild_symbol_index(&mut self) {
        self.symbol_index.clear();

        for entry in self.entries.values() {
            for symbol in &entry.symbols {
                self.symbol_index
                    .entry(symbol.name.clone())
                    .or_insert_with(Vec::new)
                    .push(symbol.clone());
            }
        }

        self.mark_updated();
        info!("Rebuilt symbol index with {} symbols", self.symbol_count());
    }

    /// Serialize index to JSON
    pub fn to_json(&self) -> AppResult<String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| AppError::parse_error(format!("Failed to serialize index: {}", e)))
    }

    /// Deserialize index from JSON
    pub fn from_json(json: &str) -> AppResult<Self> {
        serde_json::from_str(json)
            .map_err(|e| AppError::parse_error(format!("Failed to deserialize index: {}", e)))
    }

    /// Save index to file
    pub async fn save<P: AsRef<Path>>(&self, path: P) -> AppResult<()> {
        let json = self.to_json()?;
        fs::write(path.as_ref(), json).await.map_err(|e| {
            AppError::io_error(format!("Failed to write index to file: {}", e))
        })?;
        Ok(())
    }

    /// Save index to file with compression
    pub async fn save_compressed<P: AsRef<Path>>(&self, path: P) -> AppResult<()> {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;

        let json = self.to_json()?;
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(json.as_bytes()).map_err(|e| {
            AppError::io_error(format!("Failed to compress index: {}", e))
        })?;
        let compressed = encoder.finish().map_err(|e| {
            AppError::io_error(format!("Failed to finish compression: {}", e))
        })?;

        fs::write(path.as_ref(), compressed).await.map_err(|e| {
            AppError::io_error(format!("Failed to write compressed index to file: {}", e))
        })?;

        Ok(())
    }

    /// Load index from file
    pub async fn load<P: AsRef<Path>>(path: P) -> AppResult<Self> {
        let json = fs::read_to_string(path.as_ref()).await.map_err(|e| {
            AppError::io_error(format!("Failed to read index from file: {}", e))
        })?;
        Self::from_json(&json)
    }

    /// Load index from compressed file
    pub async fn load_compressed<P: AsRef<Path>>(path: P) -> AppResult<Self> {
        use flate2::read::GzDecoder;
        use std::io::Read;

        let compressed = fs::read(path.as_ref()).await.map_err(|e| {
            AppError::io_error(format!("Failed to read compressed index from file: {}", e))
        })?;

        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut json = String::new();
        decoder.read_to_string(&mut json).map_err(|e| {
            AppError::io_error(format!("Failed to decompress index: {}", e))
        })?;

        Self::from_json(&json)
    }

    /// Hash file content using SHA256
    fn hash_content(content: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Extract symbols from file content using regex patterns
    fn extract_symbols(path: &Path, content: &str) -> AppResult<Vec<Symbol>> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match extension {
            "rs" => Self::extract_rust_symbols(path, content),
            "js" | "jsx" | "mjs" | "cjs" => Self::extract_javascript_symbols(path, content),
            "ts" | "tsx" | "mts" | "cts" => Self::extract_typescript_symbols(path, content),
            "py" => Self::extract_python_symbols(path, content),
            _ => Ok(Vec::new()), // Unsupported language
        }
    }

    /// Extract Rust symbols
    fn extract_rust_symbols(path: &Path, content: &str) -> AppResult<Vec<Symbol>> {
        let mut symbols = Vec::new();

        // Function definitions
        let fn_regex = Regex::new(r"(?m)^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = fn_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Function,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Struct definitions
        let struct_regex = Regex::new(r"(?m)^(?:pub\s+)?struct\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = struct_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Struct,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Enum definitions
        let enum_regex = Regex::new(r"(?m)^(?:pub\s+)?enum\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = enum_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Enum,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Trait definitions
        let trait_regex = Regex::new(r"(?m)^(?:pub\s+)?trait\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = trait_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Trait,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Type aliases
        let type_regex = Regex::new(r"(?m)^(?:pub\s+)?type\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = type_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Type,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Constants
        let const_regex = Regex::new(r"(?m)^(?:pub\s+)?const\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = const_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Constant,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Modules
        let mod_regex = Regex::new(r"(?m)^(?:pub\s+)?mod\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = mod_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Module,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Use statements
        let use_regex = Regex::new(r"(?m)^use\s+([\w:]+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = use_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Import,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        Ok(symbols)
    }

    /// Extract JavaScript symbols (basic implementation)
    fn extract_javascript_symbols(path: &Path, content: &str) -> AppResult<Vec<Symbol>> {
        let mut symbols = Vec::new();

        // Function declarations
        let fn_regex = Regex::new(r"(?m)^(?:export\s+)?(?:async\s+)?function\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = fn_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Function,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Class declarations
        let class_regex = Regex::new(r"(?m)^(?:export\s+)?class\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = class_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Struct,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        Ok(symbols)
    }

    /// Extract TypeScript symbols (basic implementation)
    fn extract_typescript_symbols(path: &Path, content: &str) -> AppResult<Vec<Symbol>> {
        let mut symbols = Self::extract_javascript_symbols(path, content)?;

        // Interface declarations
        let interface_regex = Regex::new(r"(?m)^(?:export\s+)?interface\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = interface_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Trait,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Type aliases
        let type_regex = Regex::new(r"(?m)^(?:export\s+)?type\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = type_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Type,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        Ok(symbols)
    }

    /// Extract Python symbols (basic implementation)
    fn extract_python_symbols(path: &Path, content: &str) -> AppResult<Vec<Symbol>> {
        let mut symbols = Vec::new();

        // Function definitions
        let fn_regex = Regex::new(r"(?m)^(?:async\s+)?def\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = fn_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Function,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        // Class definitions
        let class_regex = Regex::new(r"(?m)^class\s+(\w+)").unwrap();
        for (line_num, line) in content.lines().enumerate() {
            if let Some(caps) = class_regex.captures(line) {
                if let Some(name) = caps.get(1) {
                    symbols.push(Symbol {
                        name: name.as_str().to_string(),
                        kind: SymbolKind::Struct,
                        file: path.to_path_buf(),
                        line: line_num + 1,
                        column: Some(name.start()),
                        signature: line.trim().to_string(),
                        documentation: None,
                    });
                }
            }
        }

        Ok(symbols)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn setup_test_file(content: &str, extension: &str) -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join(format!("test.{}", extension));
        fs::write(&file_path, content).await.unwrap();
        (temp_dir, file_path)
    }

    #[tokio::test]
    async fn test_index_rust_file() {
        let content = r#"
pub fn hello_world() {
    println!("Hello, world!");
}

pub struct TestStruct {
    field: i32,
}

pub enum TestEnum {
    Variant1,
    Variant2,
}
"#;

        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;
        let mut index = CodebaseIndex::new();

        index.index_file(&file_path).await.unwrap();

        assert_eq!(index.file_count(), 1);
        assert!(index.symbol_count() >= 3);

        // Check for function
        let hello_symbols = index.find_symbol("hello_world");
        assert!(hello_symbols.is_some());

        // Check for struct
        let struct_symbols = index.find_symbol("TestStruct");
        assert!(struct_symbols.is_some());

        // Check for enum
        let enum_symbols = index.find_symbol("TestEnum");
        assert!(enum_symbols.is_some());
    }

    #[tokio::test]
    async fn test_find_symbols_by_kind() {
        let content = r#"
pub fn func1() {}
pub fn func2() {}
pub struct Struct1 {}
"#;

        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;
        let mut index = CodebaseIndex::new();

        index.index_file(&file_path).await.unwrap();

        let functions = index.find_symbols_by_kind(SymbolKind::Function);
        assert_eq!(functions.len(), 2);

        let structs = index.find_symbols_by_kind(SymbolKind::Struct);
        assert_eq!(structs.len(), 1);
    }

    #[tokio::test]
    async fn test_index_serialization() {
        let content = "pub fn test() {}";
        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;

        let mut index = CodebaseIndex::new();
        index.index_file(&file_path).await.unwrap();

        // Serialize to JSON
        let json = index.to_json().unwrap();
        assert!(!json.is_empty());

        // Deserialize from JSON
        let deserialized = CodebaseIndex::from_json(&json).unwrap();
        assert_eq!(deserialized.file_count(), index.file_count());
        assert_eq!(deserialized.symbol_count(), index.symbol_count());
    }

    #[tokio::test]
    async fn test_content_hash() {
        let content1 = "pub fn test() {}";
        let content2 = "pub fn test() {}";
        let content3 = "pub fn different() {}";

        let hash1 = CodebaseIndex::hash_content(content1);
        let hash2 = CodebaseIndex::hash_content(content2);
        let hash3 = CodebaseIndex::hash_content(content3);

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }

    #[tokio::test]
    async fn test_case_sensitive_search() {
        let content = r#"
pub fn TestFunc() {}
pub fn testfunc() {}
pub fn TESTFUNC() {}
"#;

        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;
        let mut index = CodebaseIndex::new();
        index.index_file(&file_path).await.unwrap();

        // Case-sensitive search should find exact match only
        let results = index.find_symbols_case_sensitive("TestFunc").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "TestFunc");

        // Case-insensitive search should find all variations
        let results = index.find_symbols_case_insensitive("testfunc").unwrap();
        assert_eq!(results.len(), 3);
    }

    #[tokio::test]
    async fn test_whole_word_search() {
        let content = r#"
pub fn test() {}
pub fn testing() {}
pub fn test_func() {}
pub fn my_test_func() {}
"#;

        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;
        let mut index = CodebaseIndex::new();
        index.index_file(&file_path).await.unwrap();

        // Whole word search should only match exact word boundaries
        let results = index.find_symbols_whole_word("test").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "test");

        // Pattern search without whole word should match partial
        let results = index.find_symbols_pattern("test").unwrap();
        assert!(results.len() >= 1);
    }

    #[tokio::test]
    async fn test_combined_search_options() {
        let content = r#"
pub fn Test() {}
pub fn test() {}
pub fn Testing() {}
"#;

        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;
        let mut index = CodebaseIndex::new();
        index.index_file(&file_path).await.unwrap();

        // Case-insensitive + whole word
        let results = index
            .find_symbols_pattern_with_options("test", false, true)
            .unwrap();
        assert_eq!(results.len(), 2); // Test and test, but not Testing
    }

    #[tokio::test]
    async fn test_index_versioning() {
        let content = "pub fn test() {}";
        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;

        let mut index = CodebaseIndex::new();
        assert_eq!(index.version(), INDEX_VERSION);
        assert!(index.is_compatible());

        index.index_file(&file_path).await.unwrap();

        // Timestamps should be set
        assert!(index.created_at() <= chrono::Utc::now());
        assert!(index.updated_at() <= chrono::Utc::now());
        assert!(index.created_at() <= index.updated_at());
    }

    #[tokio::test]
    async fn test_integrity_validation() {
        let content = "pub fn test() {}";
        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;

        let mut index = CodebaseIndex::new();
        index.index_file(&file_path).await.unwrap();

        // Should be valid
        assert!(index.validate_integrity().is_ok());

        // Manually corrupt by removing entry but keeping symbol
        index.entries.clear();

        // Should now be invalid
        assert!(index.validate_integrity().is_err());
    }

    #[tokio::test]
    async fn test_cleanup_stale_entries() {
        let temp_dir = TempDir::new().unwrap();
        let file1 = temp_dir.path().join("file1.rs");
        let file2 = temp_dir.path().join("file2.rs");

        fs::write(&file1, "pub fn func1() {}").await.unwrap();
        fs::write(&file2, "pub fn func2() {}").await.unwrap();

        let mut index = CodebaseIndex::new();
        index.index_file(&file1).await.unwrap();
        index.index_file(&file2).await.unwrap();

        assert_eq!(index.file_count(), 2);

        // Remove one file
        fs::remove_file(&file1).await.unwrap();

        // Cleanup should remove 1 entry
        let removed = index.cleanup_stale_entries().await.unwrap();
        assert_eq!(removed, 1);
        assert_eq!(index.file_count(), 1);

        // Validate integrity after cleanup
        assert!(index.validate_integrity().is_ok());
    }

    #[tokio::test]
    async fn test_rebuild_symbol_index() {
        let content = r#"
pub fn func1() {}
pub fn func2() {}
"#;

        let (_temp_dir, file_path) = setup_test_file(content, "rs").await;
        let mut index = CodebaseIndex::new();
        index.index_file(&file_path).await.unwrap();

        let original_count = index.symbol_count();
        assert!(original_count >= 2);

        // Corrupt symbol index
        index.symbol_index.clear();
        assert_eq!(index.symbol_count(), 0);

        // Rebuild
        index.rebuild_symbol_index();
        assert_eq!(index.symbol_count(), original_count);

        // Should be valid again
        assert!(index.validate_integrity().is_ok());
    }
}
