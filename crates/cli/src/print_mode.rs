//! Print Mode - Single Query Execution
//!
//! Execute a single AI query and print the result, then exit.
//! Supports stdin piping, multiple output formats, and error handling.

use anyhow::{Context, Result};
use claude_code_ai::{AiClient, CompletionRequest, Message, MessageRole};
use claude_code_auth::AuthManager;
use serde_json::json;
use std::collections::HashMap;
use std::io::{self, IsTerminal, Read};
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{debug, error, info};

/// Output format for print mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    /// Plain text output (default)
    Text,
    /// JSON output
    Json,
    /// Markdown output
    Markdown,
    /// Raw output (no formatting)
    Raw,
}

impl OutputFormat {
    /// Parse output format from string
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "json" => Self::Json,
            "markdown" | "md" => Self::Markdown,
            "raw" => Self::Raw,
            _ => Self::Text,
        }
    }
}

/// Print mode configuration
pub struct PrintModeConfig {
    /// Output format
    pub format: OutputFormat,
    /// Quiet mode (errors only)
    pub quiet: bool,
    /// Model to use
    pub model: String,
    /// Raw output (no ANSI colors)
    pub raw: bool,
}

impl Default for PrintModeConfig {
    fn default() -> Self {
        Self {
            format: OutputFormat::Text,
            quiet: false,
            model: "claude-3-5-sonnet-20241022".to_string(),
            raw: false,
        }
    }
}

/// Print mode handler
pub struct PrintMode {
    auth_manager: Arc<AuthManager>,
    ai_client: Arc<AiClient>,
    config: PrintModeConfig,
}

impl PrintMode {
    /// Create a new print mode handler
    pub fn new(
        auth_manager: Arc<AuthManager>,
        ai_client: Arc<AiClient>,
        config: PrintModeConfig,
    ) -> Self {
        Self {
            auth_manager,
            ai_client,
            config,
        }
    }

    /// Execute print mode with the given query
    pub async fn execute(&self, query: Option<String>) -> Result<i32> {
        // Build the complete query (from args and/or stdin)
        let full_query = self.build_query(query).await?;

        if full_query.is_empty() {
            if !self.config.quiet {
                eprintln!("Error: No query provided");
                eprintln!("Usage: claude-code -p \"your question here\"");
                eprintln!("       echo \"your question\" | claude-code -p");
            }
            return Ok(1); // Exit code 1 for user error
        }

        // Check authentication
        if !self.check_auth().await? {
            if !self.config.quiet {
                eprintln!("Error: Not authenticated");
                eprintln!("Run 'claude-code auth login' to authenticate");
            }
            return Ok(2); // Exit code 2 for auth error
        }

        // Execute the query
        match self.execute_query(&full_query).await {
            Ok(response) => {
                // Format and output the response
                self.output_response(&response)?;
                Ok(0) // Exit code 0 for success
            }
            Err(e) => {
                if !self.config.quiet {
                    eprintln!("Error: {}", e);
                }
                error!("Query execution failed: {}", e);
                Ok(3) // Exit code 3 for API error
            }
        }
    }

    /// Build query from args and stdin
    async fn build_query(&self, arg_query: Option<String>) -> Result<String> {
        let stdin = io::stdin();

        // Check if stdin has data (is piped)
        let has_stdin = !stdin.is_terminal();

        debug!("Building query - has_stdin: {}, arg_query: {:?}", has_stdin, arg_query);

        match (has_stdin, arg_query) {
            // Both stdin and arg query - combine them
            (true, Some(query)) => {
                let stdin_content = self.read_stdin().await?;
                Ok(format!("{}\n\n{}", query, stdin_content))
            }
            // Only stdin
            (true, None) => {
                self.read_stdin().await
            }
            // Only arg query
            (false, Some(query)) => {
                Ok(query)
            }
            // Neither - return empty
            (false, None) => {
                Ok(String::new())
            }
        }
    }

    /// Read content from stdin
    async fn read_stdin(&self) -> Result<String> {
        const MAX_INPUT_SIZE: usize = 10 * 1024 * 1024; // 10 MB limit

        let stdin = io::stdin().lock();
        let mut buffer = Vec::new();

        // Read with size limit
        let mut limited_reader = stdin.take(MAX_INPUT_SIZE as u64);
        limited_reader.read_to_end(&mut buffer)
            .context("Failed to read from stdin")?;

        // Check if we hit the limit
        if buffer.len() >= MAX_INPUT_SIZE {
            anyhow::bail!("Input too large (max 10 MB)");
        }

        // Detect if binary content
        if buffer.iter().any(|&b| b == 0) {
            anyhow::bail!("Binary input not supported");
        }

        // Convert to string
        String::from_utf8(buffer)
            .context("Stdin contains invalid UTF-8")
    }

    /// Check if user is authenticated
    async fn check_auth(&self) -> Result<bool> {
        // Check common providers
        let providers = ["claude", "openai", "gemini", "qwen"];

        for provider in providers {
            if self.auth_manager.has_credentials(provider).await {
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Execute the query against the AI
    async fn execute_query(&self, query: &str) -> Result<String> {
        use crate::claude_memory::ClaudeMemory;
        use std::env;
        
        info!("Executing query with model: {}", self.config.model);

        // Discover and load CLAUDE.md files for context
        let current_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let claude_memory = ClaudeMemory::load_from_hierarchy(&current_dir)
            .unwrap_or_else(|_| ClaudeMemory::new());
        
        // Build message history with system message
        let mut messages = Vec::new();

        // Add system message with CLAUDE.md context if available
        let mut system_message_content = "You are a helpful AI assistant. Provide clear, concise, and accurate responses.".to_string();
        
        if !claude_memory.is_empty() {
            system_message_content.push_str("\n\n# Project Context Information\n\n");
            system_message_content.push_str(claude_memory.get_combined_context());
        }
        
        messages.push(Message {
            role: MessageRole::System,
            content: system_message_content,
            name: None,
            extra: HashMap::new(),
        });

        // Add user query
        messages.push(Message {
            role: MessageRole::User,
            content: query.to_string(),
            name: None,
            extra: HashMap::new(),
        });

        // Create AI request
        let request = CompletionRequest::new(messages, self.config.model.clone());

        // Execute with retry logic
        let max_retries = 3;
        let mut last_error = None;

        for attempt in 1..=max_retries {
            match self.ai_client.complete_with_default(&request).await {
                Ok(response) => {
                    debug!("Query successful on attempt {}", attempt);
                    return Ok(response.message.content);
                }
                Err(e) => {
                    error!("Query failed on attempt {}: {}", attempt, e);
                    last_error = Some(e);

                    if attempt < max_retries {
                        // Exponential backoff
                        let wait_time = std::time::Duration::from_millis(
                            1000 * 2_u64.pow(attempt - 1)
                        );
                        tokio::time::sleep(wait_time).await;
                    }
                }
            }
        }

        Err(last_error.unwrap().into())
    }

    /// Output the response in the configured format
    fn output_response(&self, response: &str) -> Result<()> {
        let is_tty = io::stdout().is_terminal();
        let use_colors = is_tty && !self.config.raw;

        match self.config.format {
            OutputFormat::Text => {
                self.output_text(response, use_colors)?;
            }
            OutputFormat::Json => {
                self.output_json(response)?;
            }
            OutputFormat::Markdown => {
                self.output_markdown(response)?;
            }
            OutputFormat::Raw => {
                println!("{}", response);
            }
        }

        Ok(())
    }

    /// Output as formatted text
    fn output_text(&self, response: &str, use_colors: bool) -> Result<()> {
        if use_colors {
            println!("\x1b[36m{}\x1b[0m", response);
        } else {
            println!("{}", response);
        }
        Ok(())
    }

    /// Output as JSON
    fn output_json(&self, response: &str) -> Result<()> {
        let output = json!({
            "response": response,
            "model": self.config.model,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        println!("{}", serde_json::to_string_pretty(&output)?);
        Ok(())
    }

    /// Output as Markdown
    fn output_markdown(&self, response: &str) -> Result<()> {
        println!("# AI Response\n");
        println!("{}\n", response);
        println!("---");
        println!("*Model: {}*", self.config.model);
        println!("*Timestamp: {}*", chrono::Utc::now().to_rfc3339());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_output_format_parsing() {
        assert_eq!(OutputFormat::from_str("json"), OutputFormat::Json);
        assert_eq!(OutputFormat::from_str("JSON"), OutputFormat::Json);
        assert_eq!(OutputFormat::from_str("markdown"), OutputFormat::Markdown);
        assert_eq!(OutputFormat::from_str("md"), OutputFormat::Markdown);
        assert_eq!(OutputFormat::from_str("raw"), OutputFormat::Raw);
        assert_eq!(OutputFormat::from_str("text"), OutputFormat::Text);
        assert_eq!(OutputFormat::from_str("anything"), OutputFormat::Text);
    }
}
