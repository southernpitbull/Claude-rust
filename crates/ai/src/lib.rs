pub mod client;
pub mod error;
pub mod model_selector;
pub mod provider;
pub mod providers;
pub mod rate_limiter;
pub mod task_classifier;
pub mod types;

pub use client::{AiClient, ProviderRegistry};
pub use error::{AIError, AIResult};
pub use model_selector::{ModelInfo, ModelSelector, TaskType};
pub use provider::{AiProvider, ProviderConfig, TokenUsage};
pub use providers::{
    ClaudeProvider, GeminiProvider, LmStudioProvider, OpenAiProvider, OllamaProvider, QwenProvider,
};
pub use rate_limiter::{RateLimitConfig, RateLimiter};
pub use task_classifier::{TaskClassification, TaskClassifier};
pub use types::{
    CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage,
};

// Re-export ProviderType from core
pub use claude_rust_core::types::ProviderType;