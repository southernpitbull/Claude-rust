//! Model Selector
//! 
//! Logic for selecting the best model for a given task

use crate::ProviderType;
use std::collections::HashMap;

/// Model information
#[derive(Debug, Clone)]
pub struct ModelInfo {
    pub name: String,
    pub provider: ProviderType,
    pub max_tokens: u32,
    pub context_window: u32,
    pub capabilities: Vec<String>, // e.g., "text", "code", "reasoning"
    pub cost_per_million_tokens: f64, // Cost in USD per million tokens
    pub is_free: bool,
}

/// Task classification for model selection
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum TaskType {
    Simple,
    Complex,
    Creative,
    Analytical,
    Coding,
    Research,
    Other,
}

/// Model Selector for choosing the best model for a task
pub struct ModelSelector {
    models: Vec<ModelInfo>,
}

impl ModelSelector {
    /// Create a new model selector with default models
    pub fn new() -> Self {
        let models = Self::get_default_models();
        Self { models }
    }

    /// Get the default models for each provider
    fn get_default_models() -> Vec<ModelInfo> {
        vec![
            // Claude models
            ModelInfo {
                name: "claude-3-5-sonnet-latest".to_string(),
                provider: ProviderType::Claude,
                max_tokens: 4096,
                context_window: 200000,
                capabilities: vec!["text".to_string(), "code".to_string(), "reasoning".to_string()],
                cost_per_million_tokens: 3.0, // $3/million input tokens
                is_free: false,
            },
            ModelInfo {
                name: "claude-3-opus-latest".to_string(),
                provider: ProviderType::Claude,
                max_tokens: 4096,
                context_window: 200000,
                capabilities: vec!["text".to_string(), "code".to_string(), "reasoning".to_string()],
                cost_per_million_tokens: 15.0,
                is_free: false,
            },
            // OpenAI models
            ModelInfo {
                name: "gpt-4-turbo".to_string(),
                provider: ProviderType::OpenAI,
                max_tokens: 4096,
                context_window: 128000,
                capabilities: vec!["text".to_string(), "code".to_string(), "reasoning".to_string()],
                cost_per_million_tokens: 10.0,
                is_free: false,
            },
            ModelInfo {
                name: "gpt-3.5-turbo".to_string(),
                provider: ProviderType::OpenAI,
                max_tokens: 4096,
                context_window: 16385,
                capabilities: vec!["text".to_string(), "code".to_string()],
                cost_per_million_tokens: 0.5,
                is_free: false,
            },
            // Gemini models
            ModelInfo {
                name: "gemini-1.5-pro-latest".to_string(),
                provider: ProviderType::Gemini,
                max_tokens: 8192,
                context_window: 2000000,
                capabilities: vec!["text".to_string(), "code".to_string(), "reasoning".to_string(), "multimodal".to_string()],
                cost_per_million_tokens: 1.5,
                is_free: false,
            },
            ModelInfo {
                name: "gemini-1.5-flash-latest".to_string(),
                provider: ProviderType::Gemini,
                max_tokens: 8192,
                context_window: 1000000,
                capabilities: vec!["text".to_string(), "code".to_string(), "multimodal".to_string()],
                cost_per_million_tokens: 0.15,
                is_free: false,
            },
            // Qwen models
            ModelInfo {
                name: "qwen-max".to_string(),
                provider: ProviderType::Qwen,
                max_tokens: 8192,
                context_window: 32000,
                capabilities: vec!["text".to_string(), "code".to_string()],
                cost_per_million_tokens: 0.5,
                is_free: false,
            },
            ModelInfo {
                name: "qwen-plus".to_string(),
                provider: ProviderType::Qwen,
                max_tokens: 8192,
                context_window: 32000,
                capabilities: vec!["text".to_string(), "code".to_string()],
                cost_per_million_tokens: 0.2,
                is_free: false,
            },
            // Ollama models
            ModelInfo {
                name: "llama2".to_string(),
                provider: ProviderType::Ollama,
                max_tokens: 4096,
                context_window: 4096,
                capabilities: vec!["text".to_string()],
                cost_per_million_tokens: 0.0, // Free since it's local
                is_free: true,
            },
            ModelInfo {
                name: "codellama".to_string(),
                provider: ProviderType::Ollama,
                max_tokens: 4096,
                context_window: 4096,
                capabilities: vec!["text".to_string(), "code".to_string()],
                cost_per_million_tokens: 0.0, // Free since it's local
                is_free: true,
            },
            // LM Studio models (typically local models)
            ModelInfo {
                name: "local-model".to_string(),
                provider: ProviderType::LMStudio,
                max_tokens: 4096,
                context_window: 4096,
                capabilities: vec!["text".to_string()],
                cost_per_million_tokens: 0.0, // Free since it's local
                is_free: true,
            },
        ]
    }

    /// Get all models for a provider
    pub fn get_models_for_provider(&self, provider: ProviderType) -> Vec<ModelInfo> {
        self.models
            .iter()
            .filter(|model| model.provider == provider)
            .cloned()
            .collect()
    }

    /// Get a specific model by name
    pub fn get_model_by_name(&self, name: &str) -> Option<ModelInfo> {
        self.models.iter().find(|model| model.name == name).cloned()
    }

    /// Select the best model for a given task type and constraints
    pub fn select_best_model(
        &self,
        task_type: TaskType,
        provider_preference: Option<ProviderType>,
        context_length_requirement: Option<u32>,
        max_cost_per_million: Option<f64>,
    ) -> Option<ModelInfo> {
        let mut candidates: Vec<ModelInfo> = self.models.clone();

        // Filter by provider preference if specified
        if let Some(provider) = provider_preference {
            candidates.retain(|model| model.provider == provider);
        }

        // Filter by context length requirement if specified
        if let Some(min_context) = context_length_requirement {
            candidates.retain(|model| model.context_window >= min_context);
        }

        // Filter by max cost if specified
        if let Some(max_cost) = max_cost_per_million {
            candidates.retain(|model| model.cost_per_million_tokens <= max_cost);
        }

        // Additional filtering based on task type
        candidates = match task_type {
            TaskType::Coding => candidates
                .into_iter()
                .filter(|model| model.capabilities.contains(&"code".to_string()))
                .collect(),
            TaskType::Creative => candidates
                .into_iter()
                .filter(|model| model.capabilities.contains(&"creative".to_string()) 
                          || model.capabilities.contains(&"text".to_string()))
                .collect(),
            TaskType::Analytical => candidates
                .into_iter()
                .filter(|model| model.capabilities.contains(&"reasoning".to_string()))
                .collect(),
            TaskType::Complex => candidates
                .into_iter()
                .filter(|model| {
                    model.capabilities.contains(&"reasoning".to_string())
                        || model.context_window >= 100000
                })
                .collect(),
            _ => candidates, // For simple tasks, keep all candidates
        };

        // Select the best candidate based on our criteria
        if candidates.is_empty() {
            return None;
        }

        // Prioritize by: free models first, then lower cost, then context window
        candidates.sort_by(|a, b| {
            // Prioritize free models
            match (a.is_free, b.is_free) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => {
                    // Then by cost
                    a.cost_per_million_tokens
                        .partial_cmp(&b.cost_per_million_tokens)
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then_with(|| {
                            // Then by context window (higher is better)
                            b.context_window.cmp(&a.context_window)
                        })
                }
            }
        });

        candidates.first().cloned()
    }

    /// Get all available models
    pub fn get_all_models(&self) -> Vec<ModelInfo> {
        self.models.clone()
    }

    /// Add a custom model
    pub fn add_custom_model(&mut self, model: ModelInfo) {
        self.models.push(model);
    }
}

impl Default for ModelSelector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_selector_creation() {
        let selector = ModelSelector::new();
        let models = selector.get_all_models();
        
        assert!(!models.is_empty());
        assert!(models.iter().any(|m| m.name.contains("claude")));
        assert!(models.iter().any(|m| m.name.contains("gpt")));
        assert!(models.iter().any(|m| m.name.contains("gemini")));
    }

    #[test]
    fn test_get_models_for_provider() {
        let selector = ModelSelector::new();
        let claude_models = selector.get_models_for_provider(ProviderType::Claude);
        
        assert!(!claude_models.is_empty());
        for model in claude_models {
            assert_eq!(model.provider, ProviderType::Claude);
        }
    }

    #[test]
    fn test_select_best_model() {
        let selector = ModelSelector::new();
        
        // Test selecting a model for coding task
        let model = selector.select_best_model(
            TaskType::Coding,
            None,
            None,
            None,
        );
        
        assert!(model.is_some());
        if let Some(m) = model {
            assert!(m.capabilities.contains(&"code".to_string()));
        }
    }

    #[test]
    fn test_select_best_model_with_provider_constraint() {
        let selector = ModelSelector::new();
        
        // Test selecting a model with provider constraint
        let model = selector.select_best_model(
            TaskType::Simple,
            Some(ProviderType::OpenAI),
            None,
            None,
        );
        
        assert!(model.is_some());
        if let Some(m) = model {
            assert_eq!(m.provider, ProviderType::OpenAI);
        }
    }
}