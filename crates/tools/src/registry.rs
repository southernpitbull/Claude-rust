//! Tool Registry
//!
//! Manages the collection of available tools

use crate::tool::{Tool, ToolCategory};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use thiserror::Error;

/// Tool registry error
#[derive(Debug, Error)]
pub enum ToolRegistryError {
    #[error("Tool '{0}' not found")]
    ToolNotFound(String),

    #[error("Tool '{0}' already registered")]
    ToolAlreadyRegistered(String),

    #[error("Invalid tool name: {0}")]
    InvalidToolName(String),
}

/// Tool registry
pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, Arc<dyn Tool>>>>,
    tools_by_category: Arc<RwLock<HashMap<ToolCategory, Vec<String>>>>,
}

impl ToolRegistry {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            tools_by_category: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a tool
    pub async fn register(&self, tool: Arc<dyn Tool>) -> Result<(), ToolRegistryError> {
        let name = tool.name().to_string();

        // Validate tool name
        if name.is_empty() {
            return Err(ToolRegistryError::InvalidToolName("Tool name cannot be empty".to_string()));
        }

        if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(ToolRegistryError::InvalidToolName(
                format!("Tool name '{}' contains invalid characters", name)
            ));
        }

        let mut tools = self.tools.write().await;

        // Check if already registered
        if tools.contains_key(&name) {
            return Err(ToolRegistryError::ToolAlreadyRegistered(name));
        }

        // Register tool
        let category = tool.category();
        tools.insert(name.clone(), tool);

        // Update category index
        let mut by_category = self.tools_by_category.write().await;
        by_category
            .entry(category)
            .or_insert_with(Vec::new)
            .push(name);

        Ok(())
    }

    /// Unregister a tool
    pub async fn unregister(&self, name: &str) -> Result<(), ToolRegistryError> {
        let mut tools = self.tools.write().await;

        let tool = tools.remove(name)
            .ok_or_else(|| ToolRegistryError::ToolNotFound(name.to_string()))?;

        // Remove from category index
        let category = tool.category();
        let mut by_category = self.tools_by_category.write().await;

        if let Some(tools_in_category) = by_category.get_mut(&category) {
            tools_in_category.retain(|n| n != name);
        }

        Ok(())
    }

    /// Get a tool by name
    pub async fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        let tools = self.tools.read().await;
        tools.get(name).cloned()
    }

    /// List all tool names
    pub async fn list(&self) -> Vec<String> {
        let tools = self.tools.read().await;
        tools.keys().cloned().collect()
    }

    /// List tools by category
    pub async fn list_by_category(&self, category: ToolCategory) -> Vec<String> {
        let by_category = self.tools_by_category.read().await;
        by_category
            .get(&category)
            .cloned()
            .unwrap_or_default()
    }

    /// Get all categories with tools
    pub async fn categories(&self) -> Vec<ToolCategory> {
        let by_category = self.tools_by_category.read().await;
        by_category.keys().copied().collect()
    }

    /// Get total tool count
    pub async fn count(&self) -> usize {
        let tools = self.tools.read().await;
        tools.len()
    }

    /// Check if a tool exists
    pub async fn exists(&self, name: &str) -> bool {
        let tools = self.tools.read().await;
        tools.contains_key(name)
    }

    /// Get all tools
    pub async fn all(&self) -> Vec<Arc<dyn Tool>> {
        let tools = self.tools.read().await;
        tools.values().cloned().collect()
    }

    /// Get registry statistics
    pub async fn stats(&self) -> RegistryStats {
        let tools = self.tools.read().await;
        let by_category = self.tools_by_category.read().await;

        let mut category_counts = HashMap::new();
        for (category, tool_names) in by_category.iter() {
            category_counts.insert(*category, tool_names.len());
        }

        RegistryStats {
            total_tools: tools.len(),
            available_tools: tools.values().filter(|t| t.is_available()).count(),
            category_counts,
        }
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Registry statistics
#[derive(Debug, Clone)]
pub struct RegistryStats {
    pub total_tools: usize,
    pub available_tools: usize,
    pub category_counts: HashMap<ToolCategory, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool::{ToolDefinition, ToolCategory};
    use async_trait::async_trait;
    use std::collections::HashMap;

    struct TestTool {
        definition: ToolDefinition,
    }

    #[async_trait]
    impl Tool for TestTool {
        fn definition(&self) -> &ToolDefinition {
            &self.definition
        }

        async fn execute(&self, _params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
            Ok(serde_json::json!({"status": "ok"}))
        }
    }

    #[tokio::test]
    async fn test_tool_registration() {
        let registry = ToolRegistry::new();

        let tool = Arc::new(TestTool {
            definition: ToolDefinition::new("test-tool", "Test tool", ToolCategory::Custom),
        });

        assert!(registry.register(tool).await.is_ok());
        assert_eq!(registry.count().await, 1);
        assert!(registry.exists("test-tool").await);
    }

    #[tokio::test]
    async fn test_duplicate_registration() {
        let registry = ToolRegistry::new();

        let tool1 = Arc::new(TestTool {
            definition: ToolDefinition::new("test-tool", "Test tool", ToolCategory::Custom),
        });

        let tool2 = Arc::new(TestTool {
            definition: ToolDefinition::new("test-tool", "Test tool 2", ToolCategory::Custom),
        });

        registry.register(tool1).await.unwrap();
        assert!(registry.register(tool2).await.is_err());
    }

    #[tokio::test]
    async fn test_tool_retrieval() {
        let registry = ToolRegistry::new();

        let tool = Arc::new(TestTool {
            definition: ToolDefinition::new("test-tool", "Test tool", ToolCategory::Custom),
        });

        registry.register(tool).await.unwrap();

        let retrieved = registry.get("test-tool").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name(), "test-tool");
    }

    #[tokio::test]
    async fn test_category_filtering() {
        let registry = ToolRegistry::new();

        let tool1 = Arc::new(TestTool {
            definition: ToolDefinition::new("file-tool", "File tool", ToolCategory::FileOperations),
        });

        let tool2 = Arc::new(TestTool {
            definition: ToolDefinition::new("bash-tool", "Bash tool", ToolCategory::Execution),
        });

        registry.register(tool1).await.unwrap();
        registry.register(tool2).await.unwrap();

        let file_tools = registry.list_by_category(ToolCategory::FileOperations).await;
        assert_eq!(file_tools.len(), 1);
        assert_eq!(file_tools[0], "file-tool");

        let exec_tools = registry.list_by_category(ToolCategory::Execution).await;
        assert_eq!(exec_tools.len(), 1);
        assert_eq!(exec_tools[0], "bash-tool");
    }
}
