//! Tool Definition Types
//!
//! Core types for defining tools in the system

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tool parameter type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolParameterType {
    String,
    Number,
    Boolean,
    Object,
    Array,
}

/// Tool parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    pub name: String,
    pub description: String,
    pub param_type: ToolParameterType,
    pub required: bool,
    pub default: Option<serde_json::Value>,
}

impl ToolParameter {
    /// Create a new required parameter
    pub fn required(name: impl Into<String>, description: impl Into<String>, param_type: ToolParameterType) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            param_type,
            required: true,
            default: None,
        }
    }

    /// Create a new optional parameter
    pub fn optional(name: impl Into<String>, description: impl Into<String>, param_type: ToolParameterType) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            param_type,
            required: false,
            default: None,
        }
    }

    /// Set default value
    pub fn with_default(mut self, default: serde_json::Value) -> Self {
        self.default = Some(default);
        self
    }
}

/// Tool category for organization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolCategory {
    FileOperations,
    Execution,
    Web,
    Git,
    Analysis,
    Custom,
}

impl ToolCategory {
    /// Get all categories
    pub fn all() -> Vec<ToolCategory> {
        vec![
            ToolCategory::FileOperations,
            ToolCategory::Execution,
            ToolCategory::Web,
            ToolCategory::Git,
            ToolCategory::Analysis,
            ToolCategory::Custom,
        ]
    }

    /// Get category name
    pub fn name(&self) -> &'static str {
        match self {
            ToolCategory::FileOperations => "File Operations",
            ToolCategory::Execution => "Execution",
            ToolCategory::Web => "Web",
            ToolCategory::Git => "Git",
            ToolCategory::Analysis => "Analysis",
            ToolCategory::Custom => "Custom",
        }
    }
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub category: ToolCategory,
    pub parameters: Vec<ToolParameter>,
    pub requires_permission: bool,
    pub dangerous: bool,
}

impl ToolDefinition {
    /// Create a new tool definition
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        category: ToolCategory,
    ) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            category,
            parameters: Vec::new(),
            requires_permission: false,
            dangerous: false,
        }
    }

    /// Add a parameter
    pub fn parameter(mut self, param: ToolParameter) -> Self {
        self.parameters.push(param);
        self
    }

    /// Mark as requiring permission
    pub fn requires_permission(mut self) -> Self {
        self.requires_permission = true;
        self
    }

    /// Mark as dangerous
    pub fn dangerous(mut self) -> Self {
        self.dangerous = true;
        self
    }

    /// Validate parameters against provided values
    pub fn validate_parameters(&self, params: &HashMap<String, serde_json::Value>) -> Result<(), String> {
        // Check required parameters
        for param in &self.parameters {
            if param.required && !params.contains_key(&param.name) {
                return Err(format!("Required parameter '{}' is missing", param.name));
            }
        }

        // Validate parameter types
        for (name, value) in params {
            if let Some(param_def) = self.parameters.iter().find(|p| p.name == *name) {
                if !self.validate_type(value, &param_def.param_type) {
                    return Err(format!(
                        "Parameter '{}' has incorrect type. Expected {:?}",
                        name, param_def.param_type
                    ));
                }
            } else {
                return Err(format!("Unknown parameter '{}'", name));
            }
        }

        Ok(())
    }

    /// Validate a value against a parameter type
    fn validate_type(&self, value: &serde_json::Value, expected: &ToolParameterType) -> bool {
        match expected {
            ToolParameterType::String => value.is_string(),
            ToolParameterType::Number => value.is_number(),
            ToolParameterType::Boolean => value.is_boolean(),
            ToolParameterType::Object => value.is_object(),
            ToolParameterType::Array => value.is_array(),
        }
    }
}

/// Tool trait - implemented by all tools
#[async_trait]
pub trait Tool: Send + Sync {
    /// Get tool definition
    fn definition(&self) -> &ToolDefinition;

    /// Execute the tool
    async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String>;

    /// Check if tool is available
    fn is_available(&self) -> bool {
        true
    }

    /// Get tool name
    fn name(&self) -> &str {
        &self.definition().name
    }

    /// Get tool category
    fn category(&self) -> ToolCategory {
        self.definition().category
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_parameter_creation() {
        let param = ToolParameter::required("test", "Test parameter", ToolParameterType::String);
        assert_eq!(param.name, "test");
        assert!(param.required);
        assert_eq!(param.param_type, ToolParameterType::String);
    }

    #[test]
    fn test_tool_definition_validation() {
        let def = ToolDefinition::new("test", "Test tool", ToolCategory::Custom)
            .parameter(ToolParameter::required("input", "Input text", ToolParameterType::String))
            .parameter(ToolParameter::optional("count", "Count", ToolParameterType::Number));

        let mut params = HashMap::new();
        params.insert("input".to_string(), serde_json::json!("hello"));

        assert!(def.validate_parameters(&params).is_ok());

        // Missing required parameter
        let empty_params = HashMap::new();
        assert!(def.validate_parameters(&empty_params).is_err());

        // Wrong type
        let mut wrong_params = HashMap::new();
        wrong_params.insert("input".to_string(), serde_json::json!(123));
        assert!(def.validate_parameters(&wrong_params).is_err());
    }
}
