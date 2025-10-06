use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Message role in conversation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    /// System message (instructions, context)
    System,
    /// User message (human input)
    User,
    /// Assistant message (AI response)
    Assistant,
}

impl std::fmt::Display for MessageRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::System => write!(f, "system"),
            Self::User => write!(f, "user"),
            Self::Assistant => write!(f, "assistant"),
        }
    }
}

/// Content type for messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum MessageContent {
    /// Plain text content
    Text {
        text: String,
    },
    /// Image content (base64 encoded or URL)
    Image {
        #[serde(skip_serializing_if = "Option::is_none")]
        source: Option<ImageSource>,
        #[serde(skip_serializing_if = "Option::is_none")]
        url: Option<String>,
    },
    /// File content (for code, documents, etc.)
    File {
        name: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
    },
}

/// Image source (base64 encoded)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageSource {
    #[serde(rename = "type")]
    pub source_type: String, // "base64"
    pub media_type: String,  // "image/png", "image/jpeg", etc.
    pub data: String,        // base64 encoded data
}

impl MessageContent {
    /// Create text content
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    /// Create image content from URL
    pub fn image_url(url: impl Into<String>) -> Self {
        Self::Image {
            source: None,
            url: Some(url.into()),
        }
    }

    /// Create image content from base64 data
    pub fn image_base64(media_type: impl Into<String>, data: impl Into<String>) -> Self {
        Self::Image {
            source: Some(ImageSource {
                source_type: "base64".to_string(),
                media_type: media_type.into(),
                data: data.into(),
            }),
            url: None,
        }
    }

    /// Create image content from file path
    pub fn image_file(path: &PathBuf) -> Result<Self, std::io::Error> {
        let data = std::fs::read(path)?;
        let base64_data = BASE64.encode(&data);

        let media_type = match path.extension().and_then(|s| s.to_str()) {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("gif") => "image/gif",
            Some("webp") => "image/webp",
            _ => "image/png", // default
        };

        Ok(Self::image_base64(media_type, base64_data))
    }

    /// Create file content
    pub fn file(
        name: impl Into<String>,
        content: impl Into<String>,
        mime_type: Option<String>,
    ) -> Self {
        Self::File {
            name: name.into(),
            content: content.into(),
            mime_type,
        }
    }

    /// Get text content if available
    pub fn as_text(&self) -> Option<&str> {
        match self {
            Self::Text { text } => Some(text),
            Self::File { content, .. } => Some(content),
            _ => None,
        }
    }

    /// Check if content is text
    pub fn is_text(&self) -> bool {
        matches!(self, Self::Text { .. })
    }

    /// Check if content is image
    pub fn is_image(&self) -> bool {
        matches!(self, Self::Image { .. })
    }

    /// Check if content is file
    pub fn is_file(&self) -> bool {
        matches!(self, Self::File { .. })
    }
}

/// Message in conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: Vec<MessageContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

impl Message {
    /// Create a new message
    pub fn new(role: MessageRole, content: Vec<MessageContent>) -> Self {
        Self {
            role,
            content,
            name: None,
            timestamp: Some(chrono::Utc::now()),
        }
    }

    /// Create a text message
    pub fn text(role: MessageRole, text: impl Into<String>) -> Self {
        Self::new(role, vec![MessageContent::text(text)])
    }

    /// Create a system message
    pub fn system(text: impl Into<String>) -> Self {
        Self::text(MessageRole::System, text)
    }

    /// Create a user message
    pub fn user(text: impl Into<String>) -> Self {
        Self::text(MessageRole::User, text)
    }

    /// Create an assistant message
    pub fn assistant(text: impl Into<String>) -> Self {
        Self::text(MessageRole::Assistant, text)
    }

    /// Add content to the message
    pub fn with_content(mut self, content: MessageContent) -> Self {
        self.content.push(content);
        self
    }

    /// Set message name
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Get all text content concatenated
    pub fn get_text(&self) -> String {
        self.content
            .iter()
            .filter_map(|c| c.as_text())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Check if message has images
    pub fn has_images(&self) -> bool {
        self.content.iter().any(|c| c.is_image())
    }

    /// Count tokens (rough estimate)
    pub fn estimate_tokens(&self) -> usize {
        // Rough estimate: 1 token ~= 4 characters
        self.get_text().len() / 4
    }
}

/// Conversation manager for message history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub messages: Vec<Message>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

impl Conversation {
    /// Create a new conversation
    pub fn new() -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            messages: Vec::new(),
            created_at: now,
            updated_at: now,
            metadata: None,
        }
    }

    /// Create a conversation with system message
    pub fn with_system(system_message: impl Into<String>) -> Self {
        let mut conv = Self::new();
        conv.add_message(Message::system(system_message));
        conv
    }

    /// Add a message to the conversation
    pub fn add_message(&mut self, message: Message) {
        self.messages.push(message);
        self.updated_at = chrono::Utc::now();
    }

    /// Add a user message
    pub fn add_user(&mut self, text: impl Into<String>) {
        self.add_message(Message::user(text));
    }

    /// Add an assistant message
    pub fn add_assistant(&mut self, text: impl Into<String>) {
        self.add_message(Message::assistant(text));
    }

    /// Get the last message
    pub fn last_message(&self) -> Option<&Message> {
        self.messages.last()
    }

    /// Get the last user message
    pub fn last_user_message(&self) -> Option<&Message> {
        self.messages
            .iter()
            .rev()
            .find(|m| m.role == MessageRole::User)
    }

    /// Get the last assistant message
    pub fn last_assistant_message(&self) -> Option<&Message> {
        self.messages
            .iter()
            .rev()
            .find(|m| m.role == MessageRole::Assistant)
    }

    /// Count total messages
    pub fn len(&self) -> usize {
        self.messages.len()
    }

    /// Check if conversation is empty
    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }

    /// Estimate total tokens in conversation
    pub fn estimate_tokens(&self) -> usize {
        self.messages.iter().map(|m| m.estimate_tokens()).sum()
    }

    /// Truncate conversation to fit within token limit
    pub fn truncate_to_tokens(&mut self, max_tokens: usize) {
        let mut total_tokens = 0;
        let mut keep_count = 0;

        // Keep system messages and count backwards
        let system_messages: Vec<_> = self
            .messages
            .iter()
            .filter(|m| m.role == MessageRole::System)
            .cloned()
            .collect();

        for msg in system_messages.iter() {
            total_tokens += msg.estimate_tokens();
        }

        // Count from the end
        for msg in self.messages.iter().rev() {
            if msg.role == MessageRole::System {
                continue;
            }
            let tokens = msg.estimate_tokens();
            if total_tokens + tokens > max_tokens {
                break;
            }
            total_tokens += tokens;
            keep_count += 1;
        }

        // Keep system messages + recent messages
        let start_idx = self.messages.len().saturating_sub(keep_count);
        let mut new_messages = system_messages;
        new_messages.extend(
            self.messages
                .iter()
                .skip(start_idx)
                .filter(|m| m.role != MessageRole::System)
                .cloned(),
        );

        self.messages = new_messages;
    }

    /// Clear all messages
    pub fn clear(&mut self) {
        self.messages.clear();
        self.updated_at = chrono::Utc::now();
    }
}

impl Default for Conversation {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let msg = Message::user("Hello");
        assert_eq!(msg.role, MessageRole::User);
        assert_eq!(msg.get_text(), "Hello");

        let msg = Message::system("You are helpful");
        assert_eq!(msg.role, MessageRole::System);

        let msg = Message::assistant("How can I help?");
        assert_eq!(msg.role, MessageRole::Assistant);
    }

    #[test]
    fn test_message_content() {
        let content = MessageContent::text("Hello");
        assert!(content.is_text());
        assert!(!content.is_image());
        assert_eq!(content.as_text(), Some("Hello"));

        let content = MessageContent::image_url("http://example.com/image.png");
        assert!(content.is_image());
        assert!(!content.is_text());
    }

    #[test]
    fn test_message_with_multiple_content() {
        let msg = Message::new(
            MessageRole::User,
            vec![
                MessageContent::text("Look at this:"),
                MessageContent::image_url("http://example.com/image.png"),
            ],
        );

        assert_eq!(msg.content.len(), 2);
        assert!(msg.has_images());
        assert_eq!(msg.get_text(), "Look at this:");
    }

    #[test]
    fn test_conversation() {
        let mut conv = Conversation::new();
        assert!(conv.is_empty());

        conv.add_user("Hello");
        assert_eq!(conv.len(), 1);

        conv.add_assistant("Hi there!");
        assert_eq!(conv.len(), 2);

        assert_eq!(
            conv.last_user_message().unwrap().get_text(),
            "Hello"
        );
        assert_eq!(
            conv.last_assistant_message().unwrap().get_text(),
            "Hi there!"
        );
    }

    #[test]
    fn test_conversation_with_system() {
        let conv = Conversation::with_system("You are helpful");
        assert_eq!(conv.len(), 1);
        assert_eq!(conv.messages[0].role, MessageRole::System);
    }

    #[test]
    fn test_token_estimation() {
        let msg = Message::user("Hello world");
        // "Hello world" = 11 chars / 4 = 2 tokens
        assert!(msg.estimate_tokens() >= 2);

        let mut conv = Conversation::new();
        conv.add_user("Hello");
        conv.add_assistant("Hi");
        assert!(conv.estimate_tokens() > 0);
    }

    #[test]
    fn test_truncate_to_tokens() {
        let mut conv = Conversation::with_system("System prompt");
        conv.add_user("Message 1");
        conv.add_assistant("Response 1");
        conv.add_user("Message 2");
        conv.add_assistant("Response 2");

        let original_len = conv.len();
        conv.truncate_to_tokens(20); // Very small limit

        // Should keep system message and some recent messages
        assert!(conv.len() < original_len);
        assert!(conv
            .messages
            .iter()
            .any(|m| m.role == MessageRole::System));
    }
}
