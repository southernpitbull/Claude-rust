//! Codebase Analyzer
//! 
//! Analyzes code structure, dependencies, and metrics

use std::collections::HashMap;
use std::path::PathBuf;
use tree_sitter::{Language, Parser};
use tracing::{debug, info};

use super::scanner::{CodeFile, CodebaseResult};

// Import the language-specific code
extern "C" {
    fn tree_sitter_rust() -> Language;
    fn tree_sitter_javascript() -> Language;
    fn tree_sitter_typescript() -> Language;
    fn tree_sitter_python() -> Language;
}

/// Code analysis result
#[derive(Debug, Clone, Default)]
pub struct AnalysisResult {
    pub symbols: Vec<Symbol>,
    pub functions: Vec<Function>,
    pub classes: Vec<Class>,
    pub dependencies: Vec<Dependency>,
    pub metrics: CodeMetrics,
}

/// Symbol information
#[derive(Debug, Clone)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub line: usize,
    pub column: usize,
}

/// Symbol kind
#[derive(Debug, Clone)]
pub enum SymbolKind {
    Function,
    Variable,
    Class,
    Interface,
    Type,
    Import,
    Export,
    Other,
}

/// Function information
#[derive(Debug, Clone)]
pub struct Function {
    pub name: String,
    pub parameters: Vec<String>,
    pub return_type: Option<String>,
    pub line: usize,
    pub complexity: usize, // Cyclomatic complexity
}

/// Class information
#[derive(Debug, Clone)]
pub struct Class {
    pub name: String,
    pub methods: Vec<Function>,
    pub fields: Vec<Symbol>,
    pub line: usize,
}

/// Dependency information
#[derive(Debug, Clone)]
pub struct Dependency {
    pub from: PathBuf,
    pub to: PathBuf,
    pub kind: DependencyKind,
}

/// Dependency kind
#[derive(Debug, Clone)]
pub enum DependencyKind {
    Import,
    Reference,
    Inheritance,
    Usage,
}

/// Code metrics
#[derive(Debug, Clone, Default)]
pub struct CodeMetrics {
    pub loc: usize,           // Lines of code
    pub sloc: usize,          // Source lines of code (excluding comments)
    pub cloc: usize,          // Comment lines of code
    pub file_count: usize,
    pub function_count: usize,
    pub avg_function_complexity: f64,
    pub max_function_complexity: usize,
}

/// Code analyzer
pub struct CodeAnalyzer;

impl CodeAnalyzer {
    /// Create a new code analyzer
    pub fn new() -> Self {
        Self
    }

    /// Analyze a single code file
    pub fn analyze_file(&self, file: &CodeFile) -> CodebaseResult<AnalysisResult> {
        debug!("Analyzing file: {:?}", file.path);

        // Get the appropriate parser based on language
        let mut parser = self.get_parser_for_language(&file.language)?;

        // Parse the file content
        let tree = parser.parse(&file.content, None)
            .ok_or_else(|| super::scanner::CodebaseError::Parse("Failed to parse file".to_string()))?;
        
        let mut result = AnalysisResult::default();
        
        // Extract various elements based on language
        match file.language.as_str() {
            "rust" => {
                result = self.analyze_rust_file(&tree.root_node(), &file.content)?;
            }
            "javascript" | "typescript" => {
                result = self.analyze_javascript_file(&tree.root_node(), &file.content)?;
            }
            "python" => {
                result = self.analyze_python_file(&tree.root_node(), &file.content)?;
            }
            _ => {
                // For unsupported languages, just calculate basic metrics
                result.metrics = self.calculate_basic_metrics(&file.content);
            }
        }
        
        // Calculate metrics
        result.metrics = self.calculate_comprehensive_metrics(&file.content, &result);
        
        info!("Analysis complete for: {:?}", file.path);
        Ok(result)
    }

    /// Analyze a collection of files
    pub fn analyze_files(&self, files: &[CodeFile]) -> CodebaseResult<HashMap<PathBuf, AnalysisResult>> {
        let mut results = HashMap::new();
        
        for file in files {
            match self.analyze_file(file) {
                Ok(result) => {
                    results.insert(file.path.clone(), result);
                }
                Err(e) => {
                    eprintln!("Failed to analyze file {:?}: {}", file.path, e);
                }
            }
        }
        
        Ok(results)
    }

    /// Get appropriate parser for language
    fn get_parser_for_language(&self, language: &str) -> CodebaseResult<Parser> {
        let mut parser = Parser::new();
        
        let language: Language = match language {
            "rust" => unsafe { tree_sitter_rust() },
            "javascript" => unsafe { tree_sitter_javascript() },
            "typescript" => unsafe { tree_sitter_typescript() },
            "python" => unsafe { tree_sitter_python() },
            _ => return Err(super::scanner::CodebaseError::Parse(
                format!("Unsupported language: {}", language)
            )),
        };
        
        parser.set_language(language)
            .map_err(|e| super::scanner::CodebaseError::Parse(e.to_string()))?;
        
        Ok(parser)
    }

    /// Analyze a Rust file
    fn analyze_rust_file(&self, node: &tree_sitter::Node, content: &str) -> CodebaseResult<AnalysisResult> {
        let mut result = AnalysisResult::default();
        
        // Walk through the AST to find functions, structs, etc.
        self.walk_rust_tree(node, content, &mut result)?;
        
        Ok(result)
    }

    /// Walk through a Rust AST
    fn walk_rust_tree(&self, node: &tree_sitter::Node, content: &str, result: &mut AnalysisResult) -> CodebaseResult<()> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            match child.kind() {
                "function_item" => {
                    if let Some(func) = self.extract_rust_function(&child, content) {
                        result.functions.push(func);
                    }
                }
                "struct_item" => {
                    if let Some(class) = self.extract_rust_struct(&child, content) {
                        result.classes.push(class);
                    }
                }
                "use_declaration" => {
                    // Extract imports/dependencies
                }
                _ => {
                    // Continue walking for other nodes
                    self.walk_rust_tree(&child, content, result)?;
                }
            }
        }
        
        Ok(())
    }

    /// Extract function information from a Rust function node
    fn extract_rust_function(&self, node: &tree_sitter::Node, content: &str) -> Option<Function> {
        let mut name = String::new();
        let mut parameters = Vec::new();
        let source = content.as_bytes();

        // Find the function name (identifier)
        for child in node.children(&mut node.walk()) {
            if child.kind() == "identifier" && name.is_empty() {
                if let Ok(text) = child.utf8_text(source) {
                    name = text.to_string();
                }
            } else if child.kind() == "parameters" {
                // Extract parameters
                for param_child in child.children(&mut child.walk()) {
                    if param_child.kind() == "parameter" {
                        if let Ok(param_text) = param_child.utf8_text(source) {
                            parameters.push(param_text.to_string());
                        }
                    }
                }
            }
        }

        if name.is_empty() {
            return None;
        }

        Some(Function {
            name,
            parameters,
            return_type: None, // Could extract from the return type annotation
            line: node.start_position().row + 1,
            complexity: self.estimate_complexity(node, content), // Simple complexity estimation
        })
    }

    /// Extract function information from a Python function node
    fn extract_python_function(&self, node: &tree_sitter::Node, content: &str) -> Option<Function> {
        let mut name = String::new();
        let mut parameters = Vec::new();
        let source = content.as_bytes();

        // Find the function name (identifier)
        for child in node.children(&mut node.walk()) {
            if child.kind() == "identifier" && name.is_empty() {
                if let Ok(text) = child.utf8_text(source) {
                    name = text.to_string();
                }
            } else if child.kind() == "parameters" {
                // Extract parameters
                for param_child in child.children(&mut child.walk()) {
                    if param_child.kind() == "identifier" {
                        if let Ok(param_text) = param_child.utf8_text(source) {
                            parameters.push(param_text.to_string());
                        }
                    }
                }
            }
        }

        if name.is_empty() {
            return None;
        }

        Some(Function {
            name,
            parameters,
            return_type: None,
            line: node.start_position().row + 1,
            complexity: self.estimate_complexity(node, content),
        })
    }

    /// Extract class information from a Python class node
    fn extract_python_class(&self, node: &tree_sitter::Node, content: &str) -> Option<Class> {
        let mut name = String::new();
        let mut methods = Vec::new();
        let source = content.as_bytes();

        // Find the class name
        for child in node.children(&mut node.walk()) {
            if child.kind() == "identifier" && name.is_empty() {
                if let Ok(text) = child.utf8_text(source) {
                    name = text.to_string();
                }
            } else if child.kind() == "block" {
                // Extract methods from the class body
                for method_child in child.children(&mut child.walk()) {
                    if method_child.kind() == "function_definition" {
                        if let Some(func) = self.extract_python_function(&method_child, content) {
                            methods.push(func);
                        }
                    }
                }
            }
        }

        if name.is_empty() {
            return None;
        }

        Some(Class {
            name,
            methods,
            fields: Vec::new(),
            line: node.start_position().row + 1,
        })
    }

    /// Extract struct information from a Rust struct node
    fn extract_rust_struct(&self, node: &tree_sitter::Node, content: &str) -> Option<Class> {
        let mut name = String::new();
        let mut fields = Vec::new();
        let source = content.as_bytes();
        
        // Find the struct name (identifier)
        for child in node.children(&mut node.walk()) {
            if child.kind() == "type_identifier" && name.is_empty() {
                if let Ok(text) = child.utf8_text(source) {
                    name = text.to_string();
                }
            } else if child.kind() == "field_declaration_list" {
                // Extract fields
                for field_child in child.children(&mut child.walk()) {
                    if field_child.kind() == "field_declaration" {
                        for field_subchild in field_child.children(&mut field_child.walk()) {
                            if field_subchild.kind() == "field_identifier" {
                                if let Ok(field_name) = field_subchild.utf8_text(source) {
                                    fields.push(Symbol {
                                        name: field_name.to_string(),
                                        kind: SymbolKind::Variable,
                                        line: field_subchild.start_position().row + 1,
                                        column: field_subchild.start_position().column + 1,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        Some(Class {
            name,
            methods: Vec::new(), // Rust doesn't have methods in struct definitions
            fields,
            line: node.start_position().row + 1,
        })
    }

    /// Analyze a JavaScript/TypeScript file
    fn analyze_javascript_file(&self, node: &tree_sitter::Node, content: &str) -> CodebaseResult<AnalysisResult> {
        let mut result = AnalysisResult::default();
        
        // Walk through the AST to find functions, classes, etc.
        self.walk_javascript_tree(node, content, &mut result)?;
        
        Ok(result)
    }

    /// Walk through a JavaScript AST
    fn walk_javascript_tree(&self, node: &tree_sitter::Node, content: &str, result: &mut AnalysisResult) -> CodebaseResult<()> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            match child.kind() {
                "function_declaration" | "function" | "method_definition" => {
                    if let Some(func) = self.extract_javascript_function(&child, content) {
                        result.functions.push(func);
                    }
                }
                "class_declaration" | "class" => {
                    if let Some(class) = self.extract_javascript_class(&child, content) {
                        result.classes.push(class);
                    }
                }
                "import_statement" | "import_declaration" => {
                    // Extract imports/dependencies
                }
                _ => {
                    // Continue walking for other nodes
                    self.walk_javascript_tree(&child, content, result)?;
                }
            }
        }
        
        Ok(())
    }

    /// Extract function information from a JavaScript function node
    fn extract_javascript_function(&self, node: &tree_sitter::Node, content: &str) -> Option<Function> {
        let mut name = String::new();
        let mut parameters = Vec::new();
        let source = content.as_bytes();
        
        // Find the function name (identifier)
        for child in node.children(&mut node.walk()) {
            if child.kind() == "identifier" && name.is_empty() {
                if let Ok(text) = child.utf8_text(source) {
                    name = text.to_string();
                }
            } else if child.kind() == "formal_parameters" {
                // Extract parameters
                for param_child in child.children(&mut child.walk()) {
                    if param_child.kind() == "identifier" {
                        if let Ok(param_text) = param_child.utf8_text(source) {
                            parameters.push(param_text.to_string());
                        }
                    }
                }
            }
        }
        
        if name.is_empty() {
            // Might be an anonymous function or arrow function
            // Try to find a different approach
            for child in node.children(&mut node.walk()) {
                if child.kind() == "arrow_function" {
                    name = "anonymous_arrow".to_string();
                    break;
                }
            }
            if name.is_empty() {
                return None;
            }
        }
        
        Some(Function {
            name,
            parameters,
            return_type: None, // JavaScript is dynamically typed
            line: node.start_position().row + 1,
            complexity: self.estimate_complexity(node, content),
        })
    }

    /// Extract class information from a JavaScript class node
    fn extract_javascript_class(&self, node: &tree_sitter::Node, content: &str) -> Option<Class> {
        let mut name = String::new();
        let mut methods = Vec::new();
        let source = content.as_bytes();
        
        // Find the class name (identifier)
        for child in node.children(&mut node.walk()) {
            if child.kind() == "identifier" && name.is_empty() {
                if let Ok(text) = child.utf8_text(source) {
                    name = text.to_string();
                }
            } else if child.kind() == "class_body" {
                // Extract methods
                for method_child in child.children(&mut child.walk()) {
                    if method_child.kind() == "method_definition" {
                        if let Some(method) = self.extract_javascript_function(&method_child, content) {
                            methods.push(method);
                        }
                    }
                }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        Some(Class {
            name,
            methods,
            fields: Vec::new(), // Extracting fields from JavaScript is complex
            line: node.start_position().row + 1,
        })
    }

    /// Analyze a Python file
    fn analyze_python_file(&self, node: &tree_sitter::Node, content: &str) -> CodebaseResult<AnalysisResult> {
        let mut result = AnalysisResult::default();
        
        // Walk through the AST to find functions, classes, etc.
        self.walk_python_tree(node, content, &mut result)?;
        
        Ok(result)
    }

    /// Walk through a Python AST
    fn walk_python_tree(&self, node: &tree_sitter::Node, content: &str, result: &mut AnalysisResult) -> CodebaseResult<()> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            match child.kind() {
                "function_definition" => {
                    if let Some(func) = self.extract_python_function(&child, content) {
                        result.functions.push(func);
                    }
                }
                "class_definition" => {
                    if let Some(class) = self.extract_python_class(&child, content) {
                        result.classes.push(class);
                    }
                }
                _ => {
                    // Continue walking for other nodes
                    self.walk_python_tree(&child, content, result)?;
                }
            }
        }
        
        Ok(())
    }

    /// Calculate comprehensive metrics
    fn calculate_comprehensive_metrics(&self, content: &str, result: &AnalysisResult) -> CodeMetrics {
        let basic_metrics = self.calculate_basic_metrics(content);
        
        // Calculate function complexity metrics
        let mut total_complexity = 0;
        let mut max_complexity = 0;
        
        for func in &result.functions {
            total_complexity += func.complexity;
            if func.complexity > max_complexity {
                max_complexity = func.complexity;
            }
        }
        
        let avg_complexity = if result.functions.is_empty() {
            0.0
        } else {
            total_complexity as f64 / result.functions.len() as f64
        };
        
        CodeMetrics {
            loc: basic_metrics.loc,
            sloc: basic_metrics.sloc,
            cloc: basic_metrics.cloc,
            file_count: basic_metrics.file_count,
            function_count: result.functions.len(),
            avg_function_complexity: avg_complexity,
            max_function_complexity: max_complexity,
        }
    }

    /// Calculate basic code metrics (lines of code, etc.)
    fn calculate_basic_metrics(&self, content: &str) -> CodeMetrics {
        let lines: Vec<&str> = content.lines().collect();
        let loc = lines.len();
        
        // Simple calculation - in a real implementation, this would be more sophisticated
        let sloc = lines.iter()
            .filter(|line| !line.trim().is_empty() && !line.trim().starts_with("//") && !line.trim().starts_with("#"))
            .count();
        
        let cloc = lines.iter()
            .filter(|line| line.trim().starts_with("//") || line.trim().starts_with("#") || 
                     (line.trim().starts_with("/*") && line.trim().ends_with("*/"))) // Simple comment detection
            .count();
        
        CodeMetrics {
            loc,
            sloc,
            cloc,
            file_count: 1,
            function_count: 0, // Will be calculated separately
            avg_function_complexity: 0.0,
            max_function_complexity: 0,
        }
    }

    /// Estimate the complexity of a function based on the AST nodes
    fn estimate_complexity(&self, node: &tree_sitter::Node, content: &str) -> usize {
        let mut complexity = 1; // Base complexity
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            match child.kind() {
                "if_statement" | "else_clause" | "for_statement" | 
                "while_statement" | "do_statement" | "switch_statement" | 
                "catch_clause" | "conditional_expression" => {
                    complexity += 1;
                }
                _ => {
                    // Recursively check complexity of child nodes
                    complexity += self.estimate_complexity(&child, content);
                }
            }
        }
        
        complexity
    }
}

impl Default for CodeAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_code_analyzer_creation() {
        let analyzer = CodeAnalyzer::new();
        // This just tests the creation doesn't panic
        drop(analyzer);
    }

    #[test]
    fn test_symbol_kind_enum() {
        let func_kind = SymbolKind::Function;
        let var_kind = SymbolKind::Variable;
        match func_kind {
            SymbolKind::Function => assert!(true),
            _ => panic!("Unexpected symbol kind"),
        }
        match var_kind {
            SymbolKind::Variable => assert!(true),
            _ => panic!("Unexpected symbol kind"),
        }
    }

    #[test]
    fn test_code_metrics_default() {
        let metrics = CodeMetrics::default();
        assert_eq!(metrics.loc, 0);
        assert_eq!(metrics.sloc, 0);
        assert_eq!(metrics.cloc, 0);
    }
}