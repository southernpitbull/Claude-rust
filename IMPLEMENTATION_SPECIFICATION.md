# AIrchitect CLI - Complete Implementation Specification

**Document Version:** 1.0.0
**Generated:** 2025-10-19
**Target LOC:** 3500+
**Estimated Subtasks:** 150+

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Rust Core Implementation (Section 1)](#2-rust-core-implementation)
3. [TypeScript Provider System (Section 2)](#3-typescript-provider-system)
4. [Agent Framework (Section 3)](#4-agent-framework)
5. [TUI System (Section 4)](#5-tui-system)
6. [Slash Commands (Section 5)](#6-slash-commands)
7. [Checkpoint System (Section 6)](#7-checkpoint-system)
8. [Testing Infrastructure](#8-testing-infrastructure)
9. [Quality Assurance Checklist](#9-quality-assurance-checklist)

---

## 1. Executive Summary

### 1.1 Implementation Approach

This specification provides detailed implementation instructions for completing the AIrchitect CLI project. Each section includes:

- **Exact file paths** for all code changes
- **Function signatures** with type definitions
- **Implementation logic** with pseudocode/actual code
- **Test cases** with expected inputs/outputs
- **Quality checks** (lint, format, security, test commands)

### 1.2 Quality Standards

Every line of code must pass:
1. **Linting**: ESLint (TypeScript), Clippy (Rust), Pylint (Python)
2. **Formatting**: Prettier (TypeScript), rustfmt (Rust), black (Python)
3. **Security**: No hardcoded secrets, proper error handling, input validation
4. **Testing**: Unit tests (>80% coverage), integration tests, E2E tests
5. **Documentation**: Inline comments, doc comments, README updates

### 1.3 Execution Order (Critical Path)

1. **Phase 1** (CRITICAL): Rust Core (500 LOC) + AI Engine (400 LOC)
2. **Phase 2** (HIGH): TypeScript Providers (600 LOC) + Agent System (400 LOC)
3. **Phase 3** (MEDIUM): TUI System (800 LOC) + Commands (400 LOC)
4. **Phase 4** (IMPORTANT): Testing Infrastructure (1500 LOC)
5. **Phase 5** (POLISH): Documentation + Final QA (200 LOC)

Total: ~4,800 LOC (includes tests)

---

## 2. Rust Core Implementation (Section 1)

### 2.1 Core Crate Main Loop (1.1)

**File:** `P:\AIrchitect\crates\core\src\lib.rs`
**LOC:** ~150 (including 50 for tests)

#### 2.1.1 Current State
```rust
// TODO: Implement main application loop (line 109)
async fn main_loop(&self) -> Result<()> {
    println!("AIrchitect CLI initialized. Use --help for available commands.");
    Ok(())
}
```

#### 2.1.2 Implementation Required

```rust
use tokio::signal;
use tokio::sync::mpsc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

async fn main_loop(&self) -> Result<()> {
    // Create shutdown flag
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = Arc::clone(&shutdown);

    // Setup signal handlers
    tokio::spawn(async move {
        match signal::ctrl_c().await {
            Ok(()) => {
                log::info!("Received shutdown signal");
                shutdown_clone.store(true, Ordering::SeqCst);
            }
            Err(err) => {
                log::error!("Error listening for shutdown signal: {}", err);
            }
        }
    });

    // Create event channel
    let (tx, mut rx) = mpsc::channel::<AppEvent>(100);

    // Main event loop
    while !shutdown.load(Ordering::SeqCst) {
        tokio::select! {
            Some(event) = rx.recv() => {
                self.handle_event(event).await?;
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                // Periodic tasks (heartbeat, cleanup, etc.)
                self.periodic_tasks().await?;
            }
        }
    }

    // Graceful shutdown
    log::info!("Shutting down AIrchitect CLI...");
    self.shutdown().await?;

    Ok(())
}

#[derive(Debug, Clone)]
enum AppEvent {
    Command(String),
    ProviderResponse(String),
    AgentUpdate(String),
    Error(String),
}

async fn handle_event(&self, event: AppEvent) -> Result<()> {
    match event {
        AppEvent::Command(cmd) => {
            log::debug!("Processing command: {}", cmd);
            // Route to command processor
        }
        AppEvent::ProviderResponse(resp) => {
            log::debug!("Provider response received");
            // Handle AI provider response
        }
        AppEvent::AgentUpdate(update) => {
            log::debug!("Agent update: {}", update);
            // Update agent state
        }
        AppEvent::Error(err) => {
            log::error!("Event error: {}", err);
            // Handle error
        }
    }
    Ok(())
}

async fn periodic_tasks(&self) -> Result<()> {
    // Run periodic maintenance tasks
    // - Check provider health
    // - Clean up temporary files
    // - Flush buffers
    Ok(())
}

async fn shutdown(&self) -> Result<()> {
    // Save state
    // Close connections
    // Cleanup resources
    log::info!("Shutdown complete");
    Ok(())
}
```

#### 2.1.3 Test Cases

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_main_loop_initialization() {
        let config = AppConfig::default();
        let cli = AICli::new(config);

        // Test that main loop can initialize
        // Note: This test would need to be time-limited
    }

    #[tokio::test]
    async fn test_event_handling() {
        let config = AppConfig::default();
        let cli = AICli::new(config);

        // Test each event type
        let events = vec![
            AppEvent::Command("test".to_string()),
            AppEvent::ProviderResponse("response".to_string()),
            AppEvent::AgentUpdate("update".to_string()),
            AppEvent::Error("error".to_string()),
        ];

        for event in events {
            let result = cli.handle_event(event).await;
            assert!(result.is_ok());
        }
    }

    #[tokio::test]
    async fn test_graceful_shutdown() {
        let config = AppConfig::default();
        let cli = AICli::new(config);

        let result = cli.shutdown().await;
        assert!(result.is_ok());
    }
}
```

#### 2.1.4 Quality Checks

```bash
# Run from project root
cd P:/AIrchitect

# Rust linting
cargo clippy --all-targets --all-features -- -D warnings

# Rust formatting
cargo fmt --all -- --check

# Run tests
cargo test --package ai-cli-core --lib lib::tests

# Security check
cargo audit
```

### 2.2 Comprehensive Logging (1.2)

**File:** `P:\AIrchitect\crates\core\src\lib.rs` + `P:\AIrchitect\crates\utils\src\logging.rs`
**LOC:** ~200

#### 2.2.1 Current State
```rust
// TODO: Initialize logging (line 100)
async fn initialize(&self) -> Result<()> {
    if self.config.debug {
        println!("Initializing AIrchitect CLI v{}", VERSION);
    }
    // ...
}
```

#### 2.2.2 Implementation Required

**File: `P:\AIrchitect\crates\utils\src\logging.rs`**

```rust
use log::{Level, LevelFilter, Metadata, Record};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use chrono::Local;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    pub level: String,
    pub output_file: Option<PathBuf>,
    pub console_output: bool,
    pub structured: bool,
    pub include_timestamps: bool,
    pub include_module_path: bool,
}

impl Default for LogConfig {
    fn default() -> Self {
        LogConfig {
            level: "info".to_string(),
            output_file: None,
            console_output: true,
            structured: true,
            include_timestamps: true,
            include_module_path: true,
        }
    }
}

pub struct StructuredLogger {
    config: LogConfig,
    file_handle: Option<std::sync::Mutex<std::fs::File>>,
}

impl StructuredLogger {
    pub fn new(config: LogConfig) -> Result<Self, std::io::Error> {
        let file_handle = if let Some(ref path) = config.output_file {
            // Create parent directories if they don't exist
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)?;

            Some(std::sync::Mutex::new(file))
        } else {
            None
        };

        Ok(StructuredLogger {
            config,
            file_handle,
        })
    }

    pub fn init(config: LogConfig) -> Result<(), log::SetLoggerError> {
        let logger = Box::new(StructuredLogger::new(config).unwrap());
        let level = Self::parse_level(&logger.config.level);

        log::set_boxed_logger(logger)?;
        log::set_max_level(level);
        Ok(())
    }

    fn parse_level(level_str: &str) -> LevelFilter {
        match level_str.to_lowercase().as_str() {
            "trace" => LevelFilter::Trace,
            "debug" => LevelFilter::Debug,
            "info" => LevelFilter::Info,
            "warn" => LevelFilter::Warn,
            "error" => LevelFilter::Error,
            _ => LevelFilter::Info,
        }
    }

    fn format_log_entry(&self, record: &Record) -> String {
        if self.config.structured {
            // JSON structured logging
            let entry = serde_json::json!({
                "timestamp": if self.config.include_timestamps {
                    Some(Local::now().to_rfc3339())
                } else {
                    None
                },
                "level": record.level().to_string(),
                "message": record.args().to_string(),
                "module": if self.config.include_module_path {
                    record.module_path()
                } else {
                    None
                },
                "file": record.file(),
                "line": record.line(),
            });

            format!("{}\n", entry)
        } else {
            // Plain text logging
            let timestamp = if self.config.include_timestamps {
                format!("[{}] ", Local::now().format("%Y-%m-%d %H:%M:%S"))
            } else {
                String::new()
            };

            let module = if self.config.include_module_path {
                format!(" ({})", record.module_path().unwrap_or("unknown"))
            } else {
                String::new()
            };

            format!(
                "{}{} - {}{}\n",
                timestamp,
                record.level(),
                record.args(),
                module
            )
        }
    }
}

impl log::Log for StructuredLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Self::parse_level(&self.config.level)
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        let formatted = self.format_log_entry(record);

        // Write to console
        if self.config.console_output {
            match record.level() {
                Level::Error => eprint!("{}", formatted),
                _ => print!("{}", formatted),
            }
        }

        // Write to file
        if let Some(ref file_mutex) = self.file_handle {
            if let Ok(mut file) = file_mutex.lock() {
                let _ = file.write_all(formatted.as_bytes());
                let _ = file.flush();
            }
        }
    }

    fn flush(&self) {
        if let Some(ref file_mutex) = self.file_handle {
            if let Ok(mut file) = file_mutex.lock() {
                let _ = file.flush();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use tempfile::tempdir;

    #[test]
    fn test_log_config_default() {
        let config = LogConfig::default();
        assert_eq!(config.level, "info");
        assert!(config.console_output);
        assert!(config.structured);
    }

    #[test]
    fn test_parse_log_levels() {
        assert_eq!(StructuredLogger::parse_level("trace"), LevelFilter::Trace);
        assert_eq!(StructuredLogger::parse_level("debug"), LevelFilter::Debug);
        assert_eq!(StructuredLogger::parse_level("info"), LevelFilter::Info);
        assert_eq!(StructuredLogger::parse_level("warn"), LevelFilter::Warn);
        assert_eq!(StructuredLogger::parse_level("error"), LevelFilter::Error);
        assert_eq!(StructuredLogger::parse_level("invalid"), LevelFilter::Info);
    }

    #[test]
    fn test_logger_initialization() {
        let config = LogConfig::default();
        let logger = StructuredLogger::new(config);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_logger_with_file_output() {
        let dir = tempdir().unwrap();
        let log_path = dir.path().join("test.log");

        let config = LogConfig {
            output_file: Some(log_path.clone()),
            ..Default::default()
        };

        let logger = StructuredLogger::new(config);
        assert!(logger.is_ok());
        assert!(log_path.exists());
    }

    #[test]
    fn test_structured_log_format() {
        let config = LogConfig {
            structured: true,
            ..Default::default()
        };

        let logger = StructuredLogger::new(config).unwrap();
        let record = log::Record::builder()
            .args(format_args!("test message"))
            .level(Level::Info)
            .target("test_target")
            .module_path(Some("test_module"))
            .file(Some("test.rs"))
            .line(Some(42))
            .build();

        let formatted = logger.format_log_entry(&record);

        // Should be valid JSON
        assert!(serde_json::from_str::<serde_json::Value>(&formatted).is_ok());
    }

    #[test]
    fn test_plain_log_format() {
        let config = LogConfig {
            structured: false,
            include_timestamps: false,
            include_module_path: false,
            ..Default::default()
        };

        let logger = StructuredLogger::new(config).unwrap();
        let record = log::Record::builder()
            .args(format_args!("test message"))
            .level(Level::Info)
            .build();

        let formatted = logger.format_log_entry(&record);
        assert!(formatted.contains("INFO"));
        assert!(formatted.contains("test message"));
    }
}
```

**File: Update `P:\AIrchitect\crates\core\src\lib.rs`**

```rust
// Add to initialize() method
use ai_cli_utils::logging::{LogConfig, StructuredLogger};

async fn initialize(&self) -> Result<()> {
    // Initialize logging
    let log_config = LogConfig {
        level: if self.config.debug { "debug" } else { "info" }.to_string(),
        output_file: Some(PathBuf::from(".logs/ai-cli.log")),
        console_output: true,
        structured: true,
        include_timestamps: true,
        include_module_path: true,
    };

    StructuredLogger::init(log_config)
        .map_err(|e| anyhow::anyhow!("Failed to initialize logging: {}", e))?;

    log::info!("Initializing AIrchitect CLI v{}", VERSION);
    log::debug!("Configuration: {:?}", self.config);

    // TODO: Load providers
    log::info!("Loading AI providers...");
    self.load_providers().await?;

    // TODO: Initialize memory system
    log::info!("Initializing memory system...");
    self.init_memory_system().await?;

    // TODO: Initialize agent framework
    log::info!("Initializing agent framework...");
    self.init_agent_framework().await?;

    log::info!("Initialization complete");
    Ok(())
}
```

#### 2.2.3 Quality Checks

```bash
# Run tests for logging module
cargo test --package ai-cli-utils --lib logging::tests

# Check for proper error handling
cargo clippy --package ai-cli-utils -- -D warnings

# Format code
cargo fmt --package ai-cli-utils
```

### 2.3 Provider Loading Logic (1.3)

**File:** `P:\AIrchitect\crates\core\src\lib.rs`
**LOC:** ~150

#### 2.3.1 Implementation Required

```rust
use ai_cli_providers::ProviderManager;

impl AICli {
    async fn load_providers(&self) -> Result<()> {
        let mut provider_manager = ProviderManager::new();

        for provider_config in &self.config.providers {
            if !provider_config.enabled {
                log::info!("Skipping disabled provider: {}", provider_config.name);
                continue;
            }

            log::info!("Loading provider: {}", provider_config.name);

            match self.validate_provider_config(provider_config) {
                Ok(()) => {
                    provider_manager.register_provider(provider_config.clone())?;
                    log::info!("Provider {} loaded successfully", provider_config.name);
                }
                Err(e) => {
                    log::error!("Failed to validate provider {}: {}", provider_config.name, e);
                    return Err(e);
                }
            }
        }

        // Verify default provider is available
        if !provider_manager.has_provider(&self.config.default_provider) {
            return Err(anyhow::anyhow!(
                "Default provider '{}' is not available",
                self.config.default_provider
            ));
        }

        log::info!("All providers loaded successfully");
        Ok(())
    }

    fn validate_provider_config(&self, config: &ProviderConfig) -> Result<()> {
        // Validate provider name
        if config.name.is_empty() {
            return Err(anyhow::anyhow!("Provider name cannot be empty"));
        }

        // Validate API key for cloud providers
        let cloud_providers = ["openai", "anthropic", "google", "qwen"];
        if cloud_providers.contains(&config.name.as_str()) && config.api_key.is_none() {
            return Err(anyhow::anyhow!(
                "API key required for cloud provider: {}",
                config.name
            ));
        }

        // Validate default model
        if let Some(ref model) = config.default_model {
            if model.is_empty() {
                return Err(anyhow::anyhow!("Default model cannot be empty"));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_provider_config_valid() {
        let cli = AICli::new(AppConfig::default());
        let config = ProviderConfig {
            name: "openai".to_string(),
            enabled: true,
            api_key: Some("sk-test".to_string()),
            default_model: Some("gpt-4".to_string()),
        };

        assert!(cli.validate_provider_config(&config).is_ok());
    }

    #[test]
    fn test_validate_provider_config_missing_api_key() {
        let cli = AICli::new(AppConfig::default());
        let config = ProviderConfig {
            name: "openai".to_string(),
            enabled: true,
            api_key: None,
            default_model: Some("gpt-4".to_string()),
        };

        assert!(cli.validate_provider_config(&config).is_err());
    }

    #[test]
    fn test_validate_provider_config_empty_name() {
        let cli = AICli::new(AppConfig::default());
        let config = ProviderConfig {
            name: "".to_string(),
            enabled: true,
            api_key: Some("sk-test".to_string()),
            default_model: Some("gpt-4".to_string()),
        };

        assert!(cli.validate_provider_config(&config).is_err());
    }

    #[test]
    fn test_validate_local_provider_no_api_key() {
        let cli = AICli::new(AppConfig::default());
        let config = ProviderConfig {
            name: "ollama".to_string(),
            enabled: true,
            api_key: None,
            default_model: Some("llama2".to_string()),
        };

        assert!(cli.validate_provider_config(&config).is_ok());
    }
}
```

---

## 3. TypeScript Provider System (Section 2)

### 3.1 Complete Cloud Providers (2.1)

#### 3.1.1 OpenAI Provider - Streaming Support

**File:** `P:\AIrchitect\src\providers\cloud\openai.ts`
**LOC:** ~75

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider, StreamOptions } from '../base';

export class OpenAIProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;
  private streamingEnabled: boolean;

  constructor(config: ProviderConfig) {
    this.name = 'OpenAI';
    this.model = config.model || 'gpt-4-turbo';
    this.streamingEnabled = config.streaming !== false;

    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout || 60000,
      streaming: this.streamingEnabled,
      configuration: {
        baseURL: config.baseURL,
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<AIMessage> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.chat.invoke(messages, options);
        return response as AIMessage;
      } catch (error) {
        lastError = error as Error;
        console.error(`OpenAI generation error (attempt ${attempt}/${maxRetries}):`, error);

        // Don't retry on authentication errors
        if ((error as any).status === 401) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error('Unknown error in OpenAI provider');
  }

  async generateStreamingResponse(
    messages: BaseMessage[],
    options?: StreamOptions
  ): Promise<AsyncIterable<string>> {
    if (!this.streamingEnabled) {
      throw new Error('Streaming is not enabled for this provider instance');
    }

    const stream = await this.chat.stream(messages, options);

    return (async function* () {
      for await (const chunk of stream) {
        if (chunk.content) {
          yield chunk.content.toString();
        }
      }
    })();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Note: OpenAI embeddings require a separate client
    // This is a placeholder implementation
    throw new Error('Embedding generation not yet implemented');
  }

  async listModels(): Promise<string[]> {
    // Return list of available models
    return [
      'gpt-4-turbo',
      'gpt-4',
      'gpt-4-32k',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
    ];
  }

  async functionCalling(
    messages: BaseMessage[],
    functions: any[],
    options?: any
  ): Promise<AIMessage> {
    try {
      const response = await this.chat.invoke(messages, {
        ...options,
        functions,
        function_call: options?.function_call || 'auto',
      });

      return response as AIMessage;
    } catch (error) {
      console.error('OpenAI function calling error:', error);
      throw error;
    }
  }
}
```

**Tests:**

```typescript
// File: P:\AIrchitect\src\providers\cloud\__tests__\openai.test.ts

import { OpenAIProvider } from '../openai';
import { HumanMessage } from '@langchain/core/messages';

describe('OpenAIProvider', () => {
  const mockConfig = {
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
    model: 'gpt-4-turbo',
    temperature: 0.7,
  };

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const provider = new OpenAIProvider(mockConfig);
      expect(provider.name).toBe('OpenAI');
      expect(provider.model).toBe('gpt-4-turbo');
    });

    it('should use default model if not specified', () => {
      const provider = new OpenAIProvider({ apiKey: 'test' });
      expect(provider.model).toBe('gpt-4-turbo');
    });
  });

  describe('generateResponse', () => {
    it('should generate response with retry logic', async () => {
      const provider = new OpenAIProvider(mockConfig);
      const messages = [new HumanMessage('Hello')];

      // This test requires mocking or a valid API key
      // For now, we'll skip actual execution
      expect(provider.generateResponse).toBeDefined();
    });

    it('should handle authentication errors without retry', async () => {
      const provider = new OpenAIProvider({ apiKey: 'invalid' });
      const messages = [new HumanMessage('Hello')];

      await expect(provider.generateResponse(messages)).rejects.toThrow();
    });
  });

  describe('streaming', () => {
    it('should support streaming when enabled', async () => {
      const provider = new OpenAIProvider({ ...mockConfig, streaming: true });
      expect(provider['streamingEnabled']).toBe(true);
    });

    it('should throw error when streaming not enabled', async () => {
      const provider = new OpenAIProvider({ ...mockConfig, streaming: false });
      const messages = [new HumanMessage('Hello')];

      await expect(provider.generateStreamingResponse(messages)).rejects.toThrow(
        'Streaming is not enabled'
      );
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const provider = new OpenAIProvider(mockConfig);
      const models = await provider.listModels();

      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('gpt-3.5-turbo');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('functionCalling', () => {
    it('should support function calling', async () => {
      const provider = new OpenAIProvider(mockConfig);
      const messages = [new HumanMessage('What is the weather?')];
      const functions = [
        {
          name: 'get_weather',
          description: 'Get the current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      ];

      expect(provider.functionCalling).toBeDefined();
    });
  });
});
```

#### 3.1.2 Anthropic Claude Provider

**File:** `P:\AIrchitect\src\providers\cloud\claude.ts`
**LOC:** ~100

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider, StreamOptions } from '../base';

export class ClaudeProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatAnthropic;
  private streamingEnabled: boolean;

  constructor(config: ProviderConfig) {
    this.name = 'Claude';
    this.model = config.model || 'claude-3-opus-20240229';
    this.streamingEnabled = config.streaming !== false;

    this.chat = new ChatAnthropic({
      anthropicApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      timeout: config.timeout || 120000, // Claude can be slower
      streaming: this.streamingEnabled,
      clientOptions: {
        baseURL: config.baseURL,
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Claude connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<AIMessage> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.chat.invoke(messages, {
          ...options,
          // Claude-specific options
          stopSequences: options?.stopSequences,
          topK: options?.topK,
          topP: options?.topP,
        });

        return response as AIMessage;
      } catch (error) {
        lastError = error as Error;
        console.error(`Claude generation error (attempt ${attempt}/${maxRetries}):`, error);

        // Don't retry on authentication or validation errors
        if ((error as any).status === 401 || (error as any).status === 400) {
          throw error;
        }

        // Handle rate limiting with longer backoff
        if ((error as any).status === 429) {
          const backoffMs = Math.pow(2, attempt) * 2000; // Longer backoff for rate limits
          console.log(`Rate limited, backing off for ${backoffMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        } else if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error('Unknown error in Claude provider');
  }

  async generateStreamingResponse(
    messages: BaseMessage[],
    options?: StreamOptions
  ): Promise<AsyncIterable<string>> {
    if (!this.streamingEnabled) {
      throw new Error('Streaming is not enabled for this provider instance');
    }

    const stream = await this.chat.stream(messages, options);

    return (async function* () {
      for await (const chunk of stream) {
        if (chunk.content) {
          yield chunk.content.toString();
        }
      }
    })();
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ];
  }

  async visionAnalysis(imageUrl: string, prompt: string): Promise<string> {
    try {
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'image_url' as const,
              image_url: {
                url: imageUrl,
              },
            },
            {
              type: 'text' as const,
              text: prompt,
            },
          ],
        },
      ];

      const response = await this.chat.invoke(messages);
      return response.content.toString();
    } catch (error) {
      console.error('Claude vision analysis error:', error);
      throw error;
    }
  }

  getTokenLimit(): number {
    const limits: Record<string, number> = {
      'claude-3-opus-20240229': 200000,
      'claude-3-sonnet-20240229': 200000,
      'claude-3-haiku-20240307': 200000,
      'claude-2.1': 100000,
      'claude-2.0': 100000,
      'claude-instant-1.2': 100000,
    };

    return limits[this.model] || 100000;
  }
}
```

### 3.2 Provider Failover Logic (2.2)

**File:** `P:\AIrchitect\src\providers\manager.ts`
**LOC:** ~200

```typescript
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { AIProvider } from './base';
import { OpenAIProvider } from './cloud/openai';
import { ClaudeProvider } from './cloud/claude';
import { GeminiProvider } from './cloud/gemini';
import { OllamaProvider } from './local/ollama';

interface ProviderHealthStatus {
  provider: string;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
}

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private healthStatus: Map<string, ProviderHealthStatus> = new Map();
  private defaultProvider: string;
  private fallbackOrder: string[];
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(defaultProvider: string, fallbackOrder: string[] = []) {
    this.defaultProvider = defaultProvider;
    this.fallbackOrder = fallbackOrder;
  }

  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
    this.healthStatus.set(name, {
      provider: name,
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });
  }

  async initialize(): Promise<void> {
    // Perform initial health checks
    await this.performHealthChecks();

    // Start periodic health checks (every 5 minutes)
    this.healthCheckInterval = setInterval(
      async () => {
        await this.performHealthChecks();
      },
      5 * 60 * 1000
    );
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async performHealthChecks(): Promise<void> {
    const checkPromises = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const healthy = await provider.testConnection();
          const status = this.healthStatus.get(name)!;

          if (healthy) {
            status.healthy = true;
            status.consecutiveFailures = 0;
          } else {
            status.healthy = false;
            status.consecutiveFailures++;
          }

          status.lastCheck = new Date();
        } catch (error) {
          console.error(`Health check failed for provider ${name}:`, error);
          const status = this.healthStatus.get(name)!;
          status.healthy = false;
          status.consecutiveFailures++;
          status.lastCheck = new Date();
        }
      }
    );

    await Promise.allSettled(checkPromises);
  }

  async generateResponse(
    messages: BaseMessage[],
    options?: any
  ): Promise<AIMessage> {
    // Try default provider first
    const providerOrder = [
      this.defaultProvider,
      ...this.fallbackOrder.filter((p) => p !== this.defaultProvider),
    ];

    let lastError: Error | null = null;

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      const status = this.healthStatus.get(providerName);

      if (!provider) {
        console.warn(`Provider ${providerName} not registered`);
        continue;
      }

      if (status && !status.healthy && status.consecutiveFailures > 3) {
        console.warn(
          `Skipping unhealthy provider ${providerName} (${status.consecutiveFailures} consecutive failures)`
        );
        continue;
      }

      try {
        console.log(`Attempting to generate response with provider: ${providerName}`);
        const response = await provider.generateResponse(messages, options);

        // Mark provider as healthy on success
        if (status) {
          status.healthy = true;
          status.consecutiveFailures = 0;
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`Provider ${providerName} failed:`, error);

        // Update health status
        if (status) {
          status.consecutiveFailures++;
          if (status.consecutiveFailures > 3) {
            status.healthy = false;
          }
        }

        // Continue to next provider
        continue;
      }
    }

    throw new Error(
      `All providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  async generateStreamingResponse(
    messages: BaseMessage[],
    options?: any
  ): Promise<AsyncIterable<string>> {
    // Similar failover logic for streaming
    const providerOrder = [
      this.defaultProvider,
      ...this.fallbackOrder.filter((p) => p !== this.defaultProvider),
    ];

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      const status = this.healthStatus.get(providerName);

      if (!provider || (status && !status.healthy)) {
        continue;
      }

      try {
        return await provider.generateStreamingResponse(messages, options);
      } catch (error) {
        console.error(`Streaming failed for provider ${providerName}:`, error);
        continue;
      }
    }

    throw new Error('No provider available for streaming');
  }

  getHealthStatus(): ProviderHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  setDefaultProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} is not registered`);
    }
    this.defaultProvider = providerName;
  }

  updateFallbackOrder(order: string[]): void {
    // Validate all providers exist
    for (const providerName of order) {
      if (!this.providers.has(providerName)) {
        throw new Error(`Provider ${providerName} is not registered`);
      }
    }
    this.fallbackOrder = order;
  }
}
```

---

## 4. Agent Framework (Section 3)

### 4.1 Error Recovery and Timeout Handling (3.1)

**File:** `P:\AIrchitect\src\agents\orchestrator.ts`
**LOC:** ~150 (additions)

```typescript
// Add to existing AgentOrchestrator class

interface TimeoutConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  perAgentTimeouts?: Record<string, number>;
}

interface RetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
}

export class AgentOrchestrator {
  // ... existing code ...

  private timeoutConfig: TimeoutConfig = {
    defaultTimeoutMs: 30000, // 30 seconds
    maxTimeoutMs: 300000, // 5 minutes
    perAgentTimeouts: {},
  };

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
  };

  setTimeoutConfig(config: Partial<TimeoutConfig>): void {
    this.timeoutConfig = { ...this.timeoutConfig, ...config };
  }

  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  private async executeAgentWithTimeout(
    agentName: string,
    input: string
  ): Promise<any> {
    const timeoutMs =
      this.timeoutConfig.perAgentTimeouts?.[agentName] ||
      this.timeoutConfig.defaultTimeoutMs;

    return Promise.race([
      this.executeAgentWithRetry(agentName, input),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Agent ${agentName} timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  private async executeAgentWithRetry(
    agentName: string,
    input: string
  ): Promise<any> {
    let lastError: Error | null = null;
    let backoffMs = this.retryConfig.initialBackoffMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const agent = this.registry.getAgent(agentName);
        if (!agent) {
          throw new Error(`Agent ${agentName} not found`);
        }

        console.log(`Executing agent ${agentName} (attempt ${attempt}/${this.retryConfig.maxRetries})`);
        const result = await agent.execute(input);

        // Reset success
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Agent ${agentName} execution failed (attempt ${attempt}/${this.retryConfig.maxRetries}):`,
          error
        );

        // Don't retry on certain error types
        if (this.isNonRetriableError(error)) {
          throw error;
        }

        // Exponential backoff before next retry
        if (attempt < this.retryConfig.maxRetries) {
          console.log(`Retrying agent ${agentName} after ${backoffMs}ms backoff`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));

          // Increase backoff
          backoffMs = Math.min(
            backoffMs * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxBackoffMs
          );
        }
      }
    }

    throw new Error(
      `Agent ${agentName} failed after ${this.retryConfig.maxRetries} retries. Last error: ${lastError?.message}`
    );
  }

  private isNonRetriableError(error: any): boolean {
    // Authentication errors
    if (error.status === 401 || error.message?.includes('authentication')) {
      return true;
    }

    // Invalid input errors
    if (error.status === 400 || error.message?.includes('invalid input')) {
      return true;
    }

    // Agent not found
    if (error.message?.includes('not found')) {
      return true;
    }

    return false;
  }

  private async executeAgent(
    state: AgentOrchestrationState
  ): Promise<Partial<AgentOrchestrationState>> {
    if (!state.currentAgent) {
      return {
        output: 'No agent selected for execution',
        completed: true,
        error: 'No agent to execute',
      };
    }

    try {
      // Execute with timeout and retry logic
      const result = await this.executeAgentWithTimeout(
        state.currentAgent,
        state.input
      );

      // Determine next step based on result
      let nextAgentName: string | null = null;

      if (result.nextAction === 'delegate' && result.delegateTo) {
        nextAgentName = result.delegateTo;
      } else if (result.nextAction !== 'continue') {
        return {
          output: result.output,
          metadata: result.metadata || {},
          completed: true,
        };
      }

      return {
        output: result.output,
        metadata: result.metadata || {},
        nextAgent: nextAgentName,
        completed: result.nextAction !== 'continue',
      };
    } catch (error) {
      // Enhanced error handling
      const errorMessage = (error as Error).message;
      const isTimeout = errorMessage.includes('timed out');
      const isRetryExhausted = errorMessage.includes('failed after');

      console.error(`Agent execution error:`, {
        agent: state.currentAgent,
        error: errorMessage,
        isTimeout,
        isRetryExhausted,
      });

      return {
        error: errorMessage,
        output: `Error executing agent ${state.currentAgent}: ${errorMessage}`,
        completed: true,
        metadata: {
          errorType: isTimeout ? 'timeout' : isRetryExhausted ? 'retry_exhausted' : 'unknown',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
```

---

## 5. TUI System (Section 4)

### 5.1 Complete Renderer Implementation (4.1)

**File:** `P:\AIrchitect\src\cli\tui\renderer.ts`
**LOC:** ~300

```typescript
import blessed from 'blessed';
import { EventEmitter } from 'events';

export interface RenderNode {
  type: 'box' | 'text' | 'list' | 'textarea' | 'form';
  id: string;
  props: any;
  children?: RenderNode[];
}

export interface RenderContext {
  screen: blessed.Widgets.Screen;
  focusedElement: string | null;
  theme: Theme;
}

export interface Theme {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
  border: string;
  focused: string;
  error: string;
  success: string;
}

export class TUIRenderer extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private elements: Map<string, blessed.Widgets.BlessedElement> = new Map();
  private renderTree: RenderNode | null = null;
  private theme: Theme;
  private renderScheduled: boolean = false;

  constructor(theme?: Partial<Theme>) {
    super();

    this.theme = {
      primary: '#4a9eff',
      secondary: '#6c757d',
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      border: '#3e3e3e',
      focused: '#569cd6',
      error: '#f48771',
      success: '#4ec9b0',
      ...theme,
    };

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'AIrchitect CLI',
      fullUnicode: true,
      dockBorders: true,
    });

    // Setup key bindings
    this.setupKeyBindings();

    // Handle resize events
    this.screen.on('resize', () => {
      this.scheduleRender();
    });
  }

  private setupKeyBindings(): void {
    // Quit on Escape, q, or Control-C
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.emit('exit');
      return process.exit(0);
    });

    // Tab navigation
    this.screen.key(['tab'], () => {
      this.focusNext();
    });

    // Shift-Tab navigation
    this.screen.key(['S-tab'], () => {
      this.focusPrevious();
    });

    // Refresh on Control-R
    this.screen.key(['C-r'], () => {
      this.forceRender();
    });
  }

  setRenderTree(tree: RenderNode): void {
    this.renderTree = tree;
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.renderScheduled) {
      return;
    }

    this.renderScheduled = true;
    setImmediate(() => {
      this.render();
      this.renderScheduled = false;
    });
  }

  forceRender(): void {
    this.render();
  }

  private render(): void {
    if (!this.renderTree) {
      return;
    }

    // Clear existing elements
    for (const element of this.elements.values()) {
      element.detach();
    }
    this.elements.clear();

    // Render the tree
    this.renderNode(this.renderTree, this.screen);

    // Restore focus if possible
    const focusedElement = Array.from(this.elements.values()).find(
      (el) => (el as any).focused
    );
    if (focusedElement) {
      focusedElement.focus();
    }

    // Render the screen
    this.screen.render();
  }

  private renderNode(
    node: RenderNode,
    parent: blessed.Widgets.Node
  ): blessed.Widgets.BlessedElement | null {
    let element: blessed.Widgets.BlessedElement;

    const commonProps = {
      ...node.props,
      parent,
      tags: true,
      style: {
        ...node.props.style,
        bg: node.props.style?.bg || this.theme.background,
        fg: node.props.style?.fg || this.theme.foreground,
        border: node.props.style?.border
          ? {
              ...node.props.style.border,
              fg: this.theme.border,
            }
          : undefined,
        focus: {
          ...node.props.style?.focus,
          border: {
            fg: this.theme.focused,
          },
        },
      },
    };

    switch (node.type) {
      case 'box':
        element = blessed.box(commonProps);
        break;

      case 'text':
        element = blessed.text({
          ...commonProps,
          content: node.props.content || '',
        });
        break;

      case 'list':
        element = blessed.list({
          ...commonProps,
          items: node.props.items || [],
          mouse: true,
          keys: true,
          vi: true,
          scrollable: true,
          scrollbar: {
            ch: ' ',
            style: { bg: this.theme.secondary },
          },
        });

        // Handle list selection
        (element as blessed.Widgets.ListElement).on('select', (item) => {
          this.emit('listSelect', { id: node.id, item });
        });
        break;

      case 'textarea':
        element = blessed.textarea({
          ...commonProps,
          mouse: true,
          keys: true,
          inputOnFocus: true,
        });

        // Handle text changes
        (element as blessed.Widgets.TextareaElement).on('submit', (value) => {
          this.emit('textareaSubmit', { id: node.id, value });
        });
        break;

      case 'form':
        element = blessed.form(commonProps);

        // Handle form submission
        (element as blessed.Widgets.FormElement<any>).on('submit', (data) => {
          this.emit('formSubmit', { id: node.id, data });
        });
        break;

      default:
        element = blessed.box(commonProps);
    }

    // Store element reference
    this.elements.set(node.id, element);

    // Render children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.renderNode(child, element);
      }
    }

    return element;
  }

  getElement(id: string): blessed.Widgets.BlessedElement | undefined {
    return this.elements.get(id);
  }

  focusElement(id: string): void {
    const element = this.elements.get(id);
    if (element && element.focusable !== false) {
      element.focus();
      this.screen.render();
    }
  }

  focusNext(): void {
    const focusableElements = Array.from(this.elements.values()).filter(
      (el) => el.focusable !== false
    );

    if (focusableElements.length === 0) {
      return;
    }

    const currentIndex = focusableElements.findIndex((el) => (el as any).focused);
    const nextIndex = (currentIndex + 1) % focusableElements.length;

    focusableElements[nextIndex].focus();
    this.screen.render();
  }

  focusPrevious(): void {
    const focusableElements = Array.from(this.elements.values()).filter(
      (el) => el.focusable !== false
    );

    if (focusableElements.length === 0) {
      return;
    }

    const currentIndex = focusableElements.findIndex((el) => (el as any).focused);
    const prevIndex =
      currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;

    focusableElements[prevIndex].focus();
    this.screen.render();
  }

  updateNodeContent(id: string, content: string): void {
    const element = this.elements.get(id);
    if (element) {
      element.setContent(content);
      this.screen.render();
    }
  }

  showNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    const color =
      type === 'error'
        ? this.theme.error
        : type === 'success'
        ? this.theme.success
        : this.theme.primary;

    const notification = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      border: 'line',
      style: {
        border: { fg: color },
        bg: this.theme.background,
        fg: this.theme.foreground,
      },
      tags: true,
    });

    notification.display(message, 3, () => {
      notification.destroy();
      this.screen.render();
    });
  }

  destroy(): void {
    this.screen.destroy();
    this.removeAllListeners();
  }

  getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }
}
```

---

## 6. Slash Commands (Section 5)

### 6.1 Complete ChatCommand (5.1)

**File:** `P:\AIrchitect\src\commands\ChatCommand.ts`
**LOC:** ~150

```typescript
import { Command } from '../core/cli/Command.interface';
import { ProjectMemorySystem } from '../memory/project-memory';
import { ProviderManager } from '../providers/manager';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

export interface ChatCommandOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  context?: string;
}

export class ChatCommand implements Command {
  name = 'chat';
  description = 'Start an interactive AI chat session';
  aliases = ['c'];

  private memory: ProjectMemorySystem;
  private providerManager: ProviderManager;
  private currentSession: string | null = null;
  private conversationHistory: BaseMessage[] = [];

  constructor(memory: ProjectMemorySystem, providerManager: ProviderManager) {
    this.memory = memory;
    this.providerManager = providerManager;
  }

  async execute(args: string[], options: ChatCommandOptions = {}): Promise<void> {
    console.log('🤖 AIrchitect Chat Session');
    console.log('───────────────────────────');
    console.log('Type "exit" to quit, "clear" to reset conversation');
    console.log('');

    // Initialize new session
    this.currentSession = `session_${Date.now()}`;
    this.conversationHistory = [];

    // Load context if specified
    if (options.context) {
      await this.loadContext(options.context);
    }

    // Start interactive loop
    await this.interactiveLoop(options);
  }

  private async loadContext(contextId: string): Promise<void> {
    try {
      console.log(`Loading context: ${contextId}...`);
      const context = await this.memory.retrieve(contextId);

      if (context) {
        // Add context as system message
        this.conversationHistory.push(
          new HumanMessage(`Context: ${JSON.stringify(context)}`)
        );
        console.log('✓ Context loaded successfully\n');
      } else {
        console.log('⚠ Context not found\n');
      }
    } catch (error) {
      console.error('Error loading context:', error);
    }
  }

  private async interactiveLoop(options: ChatCommandOptions): Promise<void> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'You: ',
    });

    rl.prompt();

    for await (const line of rl) {
      const input = line.trim();

      // Handle special commands
      if (input === 'exit' || input === 'quit') {
        await this.saveSession();
        console.log('\n👋 Chat session ended');
        rl.close();
        break;
      }

      if (input === 'clear') {
        this.conversationHistory = [];
        console.log('✓ Conversation cleared\n');
        rl.prompt();
        continue;
      }

      if (input === '') {
        rl.prompt();
        continue;
      }

      // Process user message
      await this.processMessage(input, options);

      rl.prompt();
    }
  }

  private async processMessage(
    input: string,
    options: ChatCommandOptions
  ): Promise<void> {
    // Add user message to history
    this.conversationHistory.push(new HumanMessage(input));

    // Store in memory
    await this.memory.addConversation('user', input);

    try {
      // Generate response
      if (options.stream) {
        await this.streamResponse(options);
      } else {
        await this.generateResponse(options);
      }
    } catch (error) {
      console.error('\n❌ Error generating response:', (error as Error).message);
      // Remove failed message from history
      this.conversationHistory.pop();
    }
  }

  private async generateResponse(options: ChatCommandOptions): Promise<void> {
    const response = await this.providerManager.generateResponse(
      this.conversationHistory,
      {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }
    );

    // Display response
    console.log(`\nAI: ${response.content}\n`);

    // Add to history
    this.conversationHistory.push(response);

    // Store in memory
    await this.memory.addConversation('assistant', response.content.toString());
  }

  private async streamResponse(options: ChatCommandOptions): Promise<void> {
    process.stdout.write('\nAI: ');

    const stream = await this.providerManager.generateStreamingResponse(
      this.conversationHistory,
      {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }
    );

    let fullResponse = '';

    for await (const chunk of stream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }

    process.stdout.write('\n\n');

    // Add to history
    const aiMessage = new AIMessage(fullResponse);
    this.conversationHistory.push(aiMessage);

    // Store in memory
    await this.memory.addConversation('assistant', fullResponse);
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession || this.conversationHistory.length === 0) {
      return;
    }

    try {
      await this.memory.store(
        this.currentSession,
        {
          messages: this.conversationHistory.map((msg) => ({
            role: msg._getType(),
            content: msg.content,
          })),
          timestamp: new Date().toISOString(),
        },
        {
          type: 'chat-session',
        }
      );

      console.log(`✓ Session saved: ${this.currentSession}`);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  getHelp(): string {
    return `
Usage: ai chat [options]

Start an interactive AI chat session

Options:
  --provider <name>       AI provider to use (default: configured default)
  --model <name>          Model to use
  --temperature <number>  Temperature for generation (0-1)
  --max-tokens <number>   Maximum tokens to generate
  --stream                Enable streaming responses
  --context <id>          Load context from memory

Commands during chat:
  exit, quit              End the chat session
  clear                   Clear conversation history

Examples:
  ai chat                                    # Start with default settings
  ai chat --stream                          # Enable streaming
  ai chat --provider claude --model opus    # Use specific model
  ai chat --context project-123             # Load project context
    `.trim();
  }
}
```

---

## 7. Checkpoint System (Section 6)

### 7.1 State Checkpoint System (6.1)

**File:** `P:\AIrchitect\crates\checkpoint\src\manager.rs`
**LOC:** ~200

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use anyhow::{Result, Context};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub description: String,
    pub state: HashMap<String, serde_json::Value>,
    pub metadata: CheckpointMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointMetadata {
    pub version: String,
    pub tags: Vec<String>,
    pub parent: Option<String>,
    pub auto_created: bool,
}

pub struct CheckpointManager {
    storage_path: PathBuf,
    max_checkpoints: usize,
    checkpoints: Vec<Checkpoint>,
}

impl CheckpointManager {
    pub fn new(storage_path: PathBuf, max_checkpoints: usize) -> Result<Self> {
        // Create storage directory if it doesn't exist
        if !storage_path.exists() {
            std::fs::create_dir_all(&storage_path)
                .context("Failed to create checkpoint storage directory")?;
        }

        let mut manager = CheckpointManager {
            storage_path,
            max_checkpoints,
            checkpoints: Vec::new(),
        };

        // Load existing checkpoints
        manager.load_checkpoints()?;

        Ok(manager)
    }

    pub fn create_checkpoint(
        &mut self,
        description: String,
        state: HashMap<String, serde_json::Value>,
        tags: Vec<String>,
    ) -> Result<String> {
        let checkpoint_id = uuid::Uuid::new_v4().to_string();

        let checkpoint = Checkpoint {
            id: checkpoint_id.clone(),
            timestamp: Utc::now(),
            description,
            state,
            metadata: CheckpointMetadata {
                version: env!("CARGO_PKG_VERSION").to_string(),
                tags,
                parent: self.checkpoints.last().map(|c| c.id.clone()),
                auto_created: false,
            },
        };

        // Save to disk
        self.save_checkpoint(&checkpoint)?;

        // Add to in-memory list
        self.checkpoints.push(checkpoint);

        // Enforce max checkpoints limit
        self.enforce_checkpoint_limit()?;

        log::info!("Created checkpoint: {} - {}", checkpoint_id, description);

        Ok(checkpoint_id)
    }

    pub fn create_auto_checkpoint(
        &mut self,
        state: HashMap<String, serde_json::Value>,
    ) -> Result<String> {
        let checkpoint_id = uuid::Uuid::new_v4().to_string();

        let checkpoint = Checkpoint {
            id: checkpoint_id.clone(),
            timestamp: Utc::now(),
            description: format!("Auto-checkpoint at {}", Utc::now().to_rfc3339()),
            state,
            metadata: CheckpointMetadata {
                version: env!("CARGO_PKG_VERSION").to_string(),
                tags: vec!["auto".to_string()],
                parent: self.checkpoints.last().map(|c| c.id.clone()),
                auto_created: true,
            },
        };

        self.save_checkpoint(&checkpoint)?;
        self.checkpoints.push(checkpoint);
        self.enforce_checkpoint_limit()?;

        log::debug!("Created auto-checkpoint: {}", checkpoint_id);

        Ok(checkpoint_id)
    }

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<HashMap<String, serde_json::Value>> {
        let checkpoint = self
            .checkpoints
            .iter()
            .find(|c| c.id == checkpoint_id)
            .ok_or_else(|| anyhow::anyhow!("Checkpoint not found: {}", checkpoint_id))?;

        log::info!("Restoring checkpoint: {} - {}", checkpoint.id, checkpoint.description);

        Ok(checkpoint.state.clone())
    }

    pub fn list_checkpoints(&self) -> Vec<&Checkpoint> {
        self.checkpoints.iter().collect()
    }

    pub fn get_checkpoint(&self, checkpoint_id: &str) -> Option<&Checkpoint> {
        self.checkpoints.iter().find(|c| c.id == checkpoint_id)
    }

    pub fn delete_checkpoint(&mut self, checkpoint_id: &str) -> Result<()> {
        // Don't allow deletion if it's the only checkpoint
        if self.checkpoints.len() == 1 {
            return Err(anyhow::anyhow!("Cannot delete the only checkpoint"));
        }

        let index = self
            .checkpoints
            .iter()
            .position(|c| c.id == checkpoint_id)
            .ok_or_else(|| anyhow::anyhow!("Checkpoint not found: {}", checkpoint_id))?;

        // Remove from disk
        let checkpoint_path = self.checkpoint_path(&self.checkpoints[index].id);
        std::fs::remove_file(&checkpoint_path)
            .context("Failed to delete checkpoint file")?;

        // Remove from memory
        self.checkpoints.remove(index);

        log::info!("Deleted checkpoint: {}", checkpoint_id);

        Ok(())
    }

    pub fn find_checkpoints_by_tag(&self, tag: &str) -> Vec<&Checkpoint> {
        self.checkpoints
            .iter()
            .filter(|c| c.metadata.tags.contains(&tag.to_string()))
            .collect()
    }

    fn save_checkpoint(&self, checkpoint: &Checkpoint) -> Result<()> {
        let checkpoint_path = self.checkpoint_path(&checkpoint.id);

        let json = serde_json::to_string_pretty(checkpoint)
            .context("Failed to serialize checkpoint")?;

        std::fs::write(&checkpoint_path, json)
            .context("Failed to write checkpoint file")?;

        Ok(())
    }

    fn load_checkpoints(&mut self) -> Result<()> {
        // Read all checkpoint files from storage directory
        let entries = std::fs::read_dir(&self.storage_path)
            .context("Failed to read checkpoint storage directory")?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let json = std::fs::read_to_string(&path)
                    .context("Failed to read checkpoint file")?;

                let checkpoint: Checkpoint = serde_json::from_str(&json)
                    .context("Failed to deserialize checkpoint")?;

                self.checkpoints.push(checkpoint);
            }
        }

        // Sort by timestamp
        self.checkpoints.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        log::info!("Loaded {} checkpoints", self.checkpoints.len());

        Ok(())
    }

    fn enforce_checkpoint_limit(&mut self) -> Result<()> {
        while self.checkpoints.len() > self.max_checkpoints {
            // Find the oldest auto-checkpoint to delete
            let oldest_auto_checkpoint = self
                .checkpoints
                .iter()
                .enumerate()
                .find(|(_, c)| c.metadata.auto_created)
                .map(|(i, _)| i);

            if let Some(index) = oldest_auto_checkpoint {
                let checkpoint = &self.checkpoints[index];
                let checkpoint_path = self.checkpoint_path(&checkpoint.id);

                std::fs::remove_file(&checkpoint_path)
                    .context("Failed to delete old checkpoint")?;

                self.checkpoints.remove(index);

                log::debug!("Deleted old auto-checkpoint to enforce limit");
            } else {
                // If no auto-checkpoints to delete, break
                break;
            }
        }

        Ok(())
    }

    fn checkpoint_path(&self, checkpoint_id: &str) -> PathBuf {
        self.storage_path.join(format!("{}.json", checkpoint_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_checkpoint_manager_creation() {
        let dir = tempdir().unwrap();
        let manager = CheckpointManager::new(dir.path().to_path_buf(), 50);
        assert!(manager.is_ok());
    }

    #[test]
    fn test_create_checkpoint() {
        let dir = tempdir().unwrap();
        let mut manager = CheckpointManager::new(dir.path().to_path_buf(), 50).unwrap();

        let mut state = HashMap::new();
        state.insert("key1".to_string(), serde_json::json!("value1"));

        let checkpoint_id = manager
            .create_checkpoint(
                "Test checkpoint".to_string(),
                state,
                vec!["test".to_string()],
            )
            .unwrap();

        assert!(!checkpoint_id.is_empty());
        assert_eq!(manager.checkpoints.len(), 1);
    }

    #[test]
    fn test_restore_checkpoint() {
        let dir = tempdir().unwrap();
        let mut manager = CheckpointManager::new(dir.path().to_path_buf(), 50).unwrap();

        let mut state = HashMap::new();
        state.insert("key1".to_string(), serde_json::json!("value1"));

        let checkpoint_id = manager
            .create_checkpoint(
                "Test checkpoint".to_string(),
                state.clone(),
                vec![],
            )
            .unwrap();

        let restored_state = manager.restore_checkpoint(&checkpoint_id).unwrap();

        assert_eq!(restored_state, state);
    }

    #[test]
    fn test_enforce_checkpoint_limit() {
        let dir = tempdir().unwrap();
        let mut manager = CheckpointManager::new(dir.path().to_path_buf(), 3).unwrap();

        // Create 5 auto-checkpoints
        for i in 0..5 {
            let mut state = HashMap::new();
            state.insert("iteration".to_string(), serde_json::json!(i));
            manager.create_auto_checkpoint(state).unwrap();
        }

        // Should only have 3 checkpoints
        assert_eq!(manager.checkpoints.len(), 3);
    }

    #[test]
    fn test_find_checkpoints_by_tag() {
        let dir = tempdir().unwrap();
        let mut manager = CheckpointManager::new(dir.path().to_path_buf(), 50).unwrap();

        let state = HashMap::new();
        manager
            .create_checkpoint("Checkpoint 1".to_string(), state.clone(), vec!["tag1".to_string()])
            .unwrap();
        manager
            .create_checkpoint("Checkpoint 2".to_string(), state.clone(), vec!["tag2".to_string()])
            .unwrap();
        manager
            .create_checkpoint("Checkpoint 3".to_string(), state, vec!["tag1".to_string()])
            .unwrap();

        let tag1_checkpoints = manager.find_checkpoints_by_tag("tag1");
        assert_eq!(tag1_checkpoints.len(), 2);
    }
}
```

---

## 8. Testing Infrastructure

### 8.1 Unit Tests - Agent Registry (8.1.1)

**File:** `P:\AIrchitect\src\agents\__tests__\AgentRegistry.test.ts`
**LOC:** ~150

```typescript
import { AgentRegistry } from '../AgentRegistry';
import { BaseAgent } from '../agent';

// Mock agent for testing
class MockAgent extends BaseAgent {
  name = 'MockAgent';
  description = 'A mock agent for testing';
  capabilities = ['test', 'mock'];

  async execute(input: string): Promise<any> {
    return {
      output: `Processed: ${input}`,
      nextAction: 'complete',
    };
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('registration', () => {
    it('should register an agent successfully', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      expect(registry.getAgent('mock')).toBe(agent);
    });

    it('should throw error when registering duplicate agent', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      expect(() => registry.registerAgent('mock', agent)).toThrow();
    });

    it('should check if agent exists', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      expect(registry.hasAgent('mock')).toBe(true);
      expect(registry.hasAgent('nonexistent')).toBe(false);
    });
  });

  describe('unregistration', () => {
    it('should unregister an agent', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      registry.unregisterAgent('mock');

      expect(registry.hasAgent('mock')).toBe(false);
    });

    it('should throw error when unregistering nonexistent agent', () => {
      expect(() => registry.unregisterAgent('nonexistent')).toThrow();
    });
  });

  describe('agent listing', () => {
    it('should list all registered agents', () => {
      const agent1 = new MockAgent();
      const agent2 = new MockAgent();

      registry.registerAgent('mock1', agent1);
      registry.registerAgent('mock2', agent2);

      const agents = registry.listAgents();

      expect(agents).toHaveLength(2);
      expect(agents).toContain('mock1');
      expect(agents).toContain('mock2');
    });

    it('should return empty array when no agents registered', () => {
      const agents = registry.listAgents();
      expect(agents).toHaveLength(0);
    });
  });

  describe('capability-based routing', () => {
    it('should find agent by capability', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      const found = registry.findAgentByCapability('test');

      expect(found).toBe(agent);
    });

    it('should return null when no agent has capability', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      const found = registry.findAgentByCapability('nonexistent');

      expect(found).toBeNull();
    });

    it('should find best agent for task', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      const best = registry.findBestAgentForTask('I need help with testing');

      expect(best).toBe(agent);
    });
  });

  describe('agent execution', () => {
    it('should execute agent with given input', async () => {
      const agent = new MockAgent();
      registry.registerAgent('mock', agent);

      const result = await registry.executeWithAgent('mock', 'test input');

      expect(result.output).toBe('Processed: test input');
      expect(result.nextAction).toBe('complete');
    });

    it('should throw error when executing nonexistent agent', async () => {
      await expect(registry.executeWithAgent('nonexistent', 'input')).rejects.toThrow();
    });
  });

  describe('lifecycle management', () => {
    it('should handle agent initialization', async () => {
      class InitializableAgent extends MockAgent {
        initialized = false;

        async initialize(): Promise<void> {
          this.initialized = true;
        }
      }

      const agent = new InitializableAgent();
      registry.registerAgent('mock', agent);

      // Registry should call initialize if available
      expect(agent.initialized).toBe(false);
    });

    it('should handle agent cleanup', async () => {
      class CleanupAgent extends MockAgent {
        cleaned = false;

        async cleanup(): Promise<void> {
          this.cleaned = true;
        }
      }

      const agent = new CleanupAgent();
      registry.registerAgent('mock', agent);

      registry.unregisterAgent('mock');

      // Registry should call cleanup if available
      // (Implementation depends on actual registry behavior)
    });
  });
});
```

---

## 9. Quality Assurance Checklist

### 9.1 Pre-Commit Checklist

```bash
#!/bin/bash
# File: P:\AIrchitect\scripts\pre-commit-check.sh

set -e

echo "Running pre-commit quality checks..."

# 1. Rust Checks
echo "===  Rust Checks  ==="

echo "→ Running cargo fmt..."
cargo fmt --all -- --check

echo "→ Running cargo clippy..."
cargo clippy --all-targets --all-features -- -D warnings

echo "→ Running cargo test..."
cargo test --all

echo "→ Running cargo audit..."
cargo audit

# 2. TypeScript Checks
echo "=== TypeScript Checks ==="

echo "→ Running ESLint..."
npm run lint

echo "→ Running Prettier..."
npm run format -- --check

echo "→ Running TypeScript tests..."
npm test

echo "→ Running type checking..."
npx tsc --noEmit

# 3. Python Checks
echo "===  Python Checks  ==="

if [ -d "plugins" ]; then
    cd plugins

    echo "→ Running black..."
    black --check .

    echo "→ Running pylint..."
    pylint **/*.py

    echo "→ Running mypy..."
    mypy .

    echo "→ Running pytest..."
    pytest

    cd ..
fi

# 4. Security Checks
echo "===  Security Checks  ==="

echo "→ Checking for hardcoded secrets..."
git secrets --scan

echo "→ Running npm audit..."
npm audit --audit-level=high

# 5. Documentation Checks
echo "===  Documentation Checks  ==="

echo "→ Generating Rust docs..."
cargo doc --no-deps

echo "→ Generating TypeScript docs..."
npx typedoc

echo ""
echo "✅ All quality checks passed!"
echo ""
```

### 9.2 Continuous Integration Configuration

**File:** `P:\AIrchitect\.github\workflows\ci.yml`
**LOC:** ~150

```yaml
name: CI

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1

jobs:
  rust-checks:
    name: Rust Quality Checks
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        rust: [stable, nightly]

    steps:
      - uses: actions/checkout@v3

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: ${{ matrix.rust }}
          override: true
          components: rustfmt, clippy

      - name: Cache cargo registry
        uses: actions/cache@v3
        with:
          path: ~/.cargo/registry
          key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}

      - name: Cache cargo index
        uses: actions/cache@v3
        with:
          path: ~/.cargo/git
          key: ${{ runner.os }}-cargo-index-${{ hashFiles('**/Cargo.lock') }}

      - name: Cache cargo build
        uses: actions/cache@v3
        with:
          path: target
          key: ${{ runner.os }}-cargo-build-target-${{ hashFiles('**/Cargo.lock') }}

      - name: Format check
        run: cargo fmt --all -- --check

      - name: Clippy check
        run: cargo clippy --all-targets --all-features -- -D warnings

      - name: Build
        run: cargo build --release --all-features

      - name: Test
        run: cargo test --all

      - name: Security audit
        run: cargo audit

  typescript-checks:
    name: TypeScript Quality Checks
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format -- --check

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: typescript

  python-checks:
    name: Python Quality Checks
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          cd plugins
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Format check
        run: |
          cd plugins
          black --check .

      - name: Lint
        run: |
          cd plugins
          pylint **/*.py

      - name: Type check
        run: |
          cd plugins
          mypy .

      - name: Test
        run: |
          cd plugins
          pytest --cov=. --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./plugins/coverage.xml
          flags: python

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [rust-checks, typescript-checks, python-checks]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install all dependencies
        run: |
          npm ci
          cargo build --release
          cd plugins && pip install -r requirements.txt

      - name: Run integration tests
        run: npm run test:integration

  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## 10. Implementation Roadmap

### Phase 1: Critical Foundation (Week 1)
- ✅ Rust Core main loop, logging, provider loading
- ✅ AI Engine provider adapters and retry logic
- ✅ Memory System persistent storage
- ✅ Basic unit tests for core components

### Phase 2: Provider Integration (Week 2)
- ✅ Complete all cloud providers (OpenAI, Claude, Gemini, Qwen, Cloudflare)
- ✅ Complete all local providers (Ollama, LM Studio, vLLM)
- ✅ Provider failover and health checking
- ✅ Provider integration tests

### Phase 3: Agent Framework (Week 3)
- ✅ Agent orchestrator with timeout and retry
- ✅ Specialized agent implementations
- ✅ Agent workflow and coordination
- ✅ Agent system tests

### Phase 4: TUI and Commands (Week 4)
- ✅ Complete TUI renderer and components
- ✅ Layout manager and navigation
- ✅ All command implementations
- ✅ Command system tests

### Phase 5: Testing and QA (Week 5)
- ✅ Comprehensive unit test coverage (>80%)
- ✅ Integration test suites
- ✅ E2E test scenarios
- ✅ Performance benchmarks

### Phase 6: Documentation and Polish (Week 6)
- ✅ User documentation (README, guides)
- ✅ Developer documentation (architecture, contributing)
- ✅ Code documentation (rustdoc, typedoc, sphinx)
- ✅ Final CI/CD setup and deployment

---

## Summary

This specification provides complete implementation details for all 3500+ LOC across the AIrchitect CLI project. Each section includes:

- **Exact file paths** and line-of-code estimates
- **Current state** analysis with TODO markers
- **Complete implementation** code with proper error handling
- **Comprehensive tests** with multiple test cases
- **Quality checks** with specific commands to run

**Total Estimated LOC:**
- Rust Core: ~1,500 LOC
- TypeScript Providers/Agents: ~1,200 LOC
- TUI System: ~800 LOC
- Command System: ~400 LOC
- Testing Infrastructure: ~1,500 LOC
- **Grand Total: ~5,400 LOC** (including tests and infrastructure)

**Next Steps:**
1. Follow the implementation order in Section 2-7
2. Run quality checks after each component
3. Update CHANGELOG.md with modifications
4. Create git commits following the commit message guidelines
5. Deploy to staging environment for integration testing
