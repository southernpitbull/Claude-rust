use crate::message::{Message, MessageRole};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// AI request configuration
#[derive(Debug, Clone, Serialize)]
pub struct AIRequest {
    /// Model to use
    pub model: String,

    /// Messages in the conversation
    pub messages: Vec<Message>,

    /// System prompt (optional, alternative to system message)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,

    /// Temperature for sampling (0.0 to 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    /// Maximum tokens to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,

    /// Top-p sampling
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    /// Top-k sampling
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,

    /// Stop sequences
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,

    /// Whether to stream the response
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,

    /// Presence penalty (-2.0 to 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,

    /// Frequency penalty (-2.0 to 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,

    /// Additional provider-specific parameters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<HashMap<String, serde_json::Value>>,
}

impl AIRequest {
    /// Create a new request with model and messages
    pub fn new(model: impl Into<String>, messages: Vec<Message>) -> Self {
        Self {
            model: model.into(),
            messages,
            system: None,
            temperature: None,
            max_tokens: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
            stream: None,
            presence_penalty: None,
            frequency_penalty: None,
            extra: None,
        }
    }

    /// Create a simple text request
    pub fn simple(model: impl Into<String>, prompt: impl Into<String>) -> Self {
        Self::new(model, vec![Message::user(prompt)])
    }

    /// Set system prompt
    pub fn with_system(mut self, system: impl Into<String>) -> Self {
        self.system = Some(system.into());
        self
    }

    /// Set temperature
    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature.clamp(0.0, 2.0));
        self
    }

    /// Set max tokens
    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    /// Set top-p
    pub fn with_top_p(mut self, top_p: f32) -> Self {
        self.top_p = Some(top_p.clamp(0.0, 1.0));
        self
    }

    /// Set top-k
    pub fn with_top_k(mut self, top_k: u32) -> Self {
        self.top_k = Some(top_k);
        self
    }

    /// Set stop sequences
    pub fn with_stop_sequences(mut self, sequences: Vec<String>) -> Self {
        self.stop_sequences = Some(sequences);
        self
    }

    /// Enable streaming
    pub fn with_stream(mut self, stream: bool) -> Self {
        self.stream = Some(stream);
        self
    }

    /// Set presence penalty
    pub fn with_presence_penalty(mut self, penalty: f32) -> Self {
        self.presence_penalty = Some(penalty.clamp(-2.0, 2.0));
        self
    }

    /// Set frequency penalty
    pub fn with_frequency_penalty(mut self, penalty: f32) -> Self {
        self.frequency_penalty = Some(penalty.clamp(-2.0, 2.0));
        self
    }

    /// Add extra parameter
    pub fn with_extra(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.extra
            .get_or_insert_with(HashMap::new)
            .insert(key.into(), value);
        self
    }

    /// Check if request has images
    pub fn has_images(&self) -> bool {
        self.messages.iter().any(|m| m.has_images())
    }

    /// Estimate total tokens in request
    pub fn estimate_tokens(&self) -> usize {
        let mut total = self.messages.iter().map(|m| m.estimate_tokens()).sum();
        if let Some(system) = &self.system {
            total += system.len() / 4; // Rough estimate
        }
        total
    }
}

/// Token usage statistics
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct UsageStats {
    /// Input tokens (prompt)
    pub input_tokens: u32,

    /// Output tokens (completion)
    pub output_tokens: u32,

    /// Total tokens
    pub total_tokens: u32,

    /// Cache creation tokens (Claude-specific)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_creation_tokens: Option<u32>,

    /// Cache read tokens (Claude-specific)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u32>,
}

impl UsageStats {
    /// Create usage stats
    pub fn new(input_tokens: u32, output_tokens: u32) -> Self {
        Self {
            input_tokens,
            output_tokens,
            total_tokens: input_tokens + output_tokens,
            cache_creation_tokens: None,
            cache_read_tokens: None,
        }
    }

    /// Add cache stats
    pub fn with_cache(mut self, creation: u32, read: u32) -> Self {
        self.cache_creation_tokens = Some(creation);
        self.cache_read_tokens = Some(read);
        self
    }

    /// Calculate total cost (rough estimate in USD)
    pub fn estimate_cost(&self, input_cost_per_1m: f64, output_cost_per_1m: f64) -> f64 {
        let input_cost = (self.input_tokens as f64 / 1_000_000.0) * input_cost_per_1m;
        let output_cost = (self.output_tokens as f64 / 1_000_000.0) * output_cost_per_1m;
        input_cost + output_cost
    }
}

/// Stop reason for completion
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    /// Natural end of completion
    EndTurn,
    /// Hit max tokens limit
    MaxTokens,
    /// Hit stop sequence
    StopSequence,
    /// Content filtered
    ContentFilter,
    /// Function/tool call
    ToolUse,
    /// Other/unknown reason
    Other,
}

impl std::fmt::Display for StopReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EndTurn => write!(f, "end_turn"),
            Self::MaxTokens => write!(f, "max_tokens"),
            Self::StopSequence => write!(f, "stop_sequence"),
            Self::ContentFilter => write!(f, "content_filter"),
            Self::ToolUse => write!(f, "tool_use"),
            Self::Other => write!(f, "other"),
        }
    }
}

/// AI response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    /// Response ID
    pub id: String,

    /// Model used
    pub model: String,

    /// Response content
    pub content: String,

    /// Message role (usually assistant)
    pub role: MessageRole,

    /// Stop reason
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<StopReason>,

    /// Token usage
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<UsageStats>,

    /// Response timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl AIResponse {
    /// Create a new response
    pub fn new(id: impl Into<String>, model: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            model: model.into(),
            content: content.into(),
            role: MessageRole::Assistant,
            stop_reason: None,
            usage: None,
            created_at: chrono::Utc::now(),
            metadata: None,
        }
    }

    /// Set stop reason
    pub fn with_stop_reason(mut self, reason: StopReason) -> Self {
        self.stop_reason = Some(reason);
        self
    }

    /// Set usage stats
    pub fn with_usage(mut self, usage: UsageStats) -> Self {
        self.usage = Some(usage);
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.metadata
            .get_or_insert_with(HashMap::new)
            .insert(key.into(), value);
        self
    }

    /// Convert to message
    pub fn to_message(&self) -> Message {
        Message::assistant(&self.content)
    }
}

/// Stream chunk for streaming responses
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamChunk {
    /// Content delta (incremental text)
    ContentDelta {
        delta: String,
        index: usize,
    },
    /// Message start
    MessageStart {
        id: String,
        model: String,
        role: MessageRole,
    },
    /// Message complete
    MessageComplete {
        id: String,
        stop_reason: Option<StopReason>,
        usage: Option<UsageStats>,
    },
    /// Error during streaming
    Error {
        message: String,
    },
    /// Ping/keepalive
    Ping,
}

impl StreamChunk {
    /// Create content delta chunk
    pub fn content_delta(delta: impl Into<String>, index: usize) -> Self {
        Self::ContentDelta {
            delta: delta.into(),
            index,
        }
    }

    /// Create message start chunk
    pub fn message_start(id: impl Into<String>, model: impl Into<String>, role: MessageRole) -> Self {
        Self::MessageStart {
            id: id.into(),
            model: model.into(),
            role,
        }
    }

    /// Create message complete chunk
    pub fn message_complete(
        id: impl Into<String>,
        stop_reason: Option<StopReason>,
        usage: Option<UsageStats>,
    ) -> Self {
        Self::MessageComplete {
            id: id.into(),
            stop_reason,
            usage,
        }
    }

    /// Create error chunk
    pub fn error(message: impl Into<String>) -> Self {
        Self::Error {
            message: message.into(),
        }
    }

    /// Create ping chunk
    pub fn ping() -> Self {
        Self::Ping
    }

    /// Check if chunk is content
    pub fn is_content(&self) -> bool {
        matches!(self, Self::ContentDelta { .. })
    }

    /// Get content delta if available
    pub fn get_delta(&self) -> Option<&str> {
        match self {
            Self::ContentDelta { delta, .. } => Some(delta),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_builder() {
        let req = AIRequest::simple("claude-3-5-sonnet-20241022", "Hello")
            .with_temperature(0.7)
            .with_max_tokens(1000)
            .with_stream(true);

        assert_eq!(req.model, "claude-3-5-sonnet-20241022");
        assert_eq!(req.temperature, Some(0.7));
        assert_eq!(req.max_tokens, Some(1000));
        assert_eq!(req.stream, Some(true));
    }

    #[test]
    fn test_temperature_clamping() {
        let req = AIRequest::simple("model", "test").with_temperature(5.0);
        assert_eq!(req.temperature, Some(2.0)); // Clamped to max

        let req = AIRequest::simple("model", "test").with_temperature(-1.0);
        assert_eq!(req.temperature, Some(0.0)); // Clamped to min
    }

    #[test]
    fn test_usage_stats() {
        let stats = UsageStats::new(100, 50);
        assert_eq!(stats.input_tokens, 100);
        assert_eq!(stats.output_tokens, 50);
        assert_eq!(stats.total_tokens, 150);

        let cost = stats.estimate_cost(3.0, 15.0); // $3/$15 per 1M tokens
        assert!(cost > 0.0);
    }

    #[test]
    fn test_response_creation() {
        let resp = AIResponse::new("resp-123", "claude-3", "Hello!")
            .with_stop_reason(StopReason::EndTurn)
            .with_usage(UsageStats::new(10, 5));

        assert_eq!(resp.id, "resp-123");
        assert_eq!(resp.content, "Hello!");
        assert_eq!(resp.stop_reason, Some(StopReason::EndTurn));
        assert!(resp.usage.is_some());
    }

    #[test]
    fn test_stream_chunk() {
        let chunk = StreamChunk::content_delta("Hello", 0);
        assert!(chunk.is_content());
        assert_eq!(chunk.get_delta(), Some("Hello"));

        let chunk = StreamChunk::ping();
        assert!(!chunk.is_content());
        assert_eq!(chunk.get_delta(), None);
    }

    #[test]
    fn test_stop_reason_display() {
        assert_eq!(StopReason::EndTurn.to_string(), "end_turn");
        assert_eq!(StopReason::MaxTokens.to_string(), "max_tokens");
    }
}
