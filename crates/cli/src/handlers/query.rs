//! AI query and interactive mode handlers.

use anyhow::{Context, Result};
use claude_rust_ai::{CompletionRequest, Message, MessageRole};
use futures::StreamExt;
use indicatif::{ProgressBar, ProgressStyle};
use std::io::Write;
use tracing::{debug, info};

use crate::app::App;
use crate::cli::{AiProvider, Commands};
use crate::interactive::InteractiveSession;

/// Handle query command - send a query to AI.
pub async fn handle(app: &App) -> Result<()> {
    let formatter = app.formatter();

    // Extract query parameters from CLI
    let (query, provider, model, stream, include_context, max_tokens) = match &app.cli_args().command {
        Some(Commands::Query {
            query,
            provider,
            model,
            stream,
            context,
            max_tokens,
        }) => (
            query.clone(),
            *provider,
            model.clone(),
            *stream,
            *context,
            *max_tokens,
        ),
        _ => anyhow::bail!("Invalid command for query handler"),
    };

    info!("Processing query: {}", query);

    // Get AI client
    let ai_client = app.get_ai_client(provider).await?;
    let client = ai_client.read().await;
    let client = client.as_ref()
        .context("AI client not initialized")?;

    // Build request
    let messages = vec![
        Message {
            role: MessageRole::User,
            content: query.clone(),
            name: None,
            extra: std::collections::HashMap::new(),
        },
    ];

    // Add codebase context if requested
    if include_context {
        debug!("Including codebase context");

        // TODO: Add codebase indexing and context extraction
        formatter.print_warning("Codebase context not yet implemented");
    }

    let mut request = CompletionRequest::new(messages, model.unwrap_or_else(|| "default".to_string()));

    // Set max tokens if specified
    if let Some(tokens) = max_tokens {
        request.max_tokens = Some(tokens);
    }

    // Execute query
    if stream {
        handle_streaming_query(app, client, request).await?;
    } else {
        handle_blocking_query(app, client, request).await?;
    }

    Ok(())
}

/// Handle streaming query with real-time output.
async fn handle_streaming_query(
    app: &App,
    client: &claude_rust_ai::AIClient,
    request: AIRequest,
) -> Result<()> {
    let formatter = app.formatter();

    if !app.is_quiet() {
        formatter.print_header("Response");
        println!();
    }

    // Create streaming request
    let mut stream = client
        .complete_stream(&request)
        .await
        .context("Failed to create stream")?;

    // Process stream chunks
    let mut response_text = String::new();

    while let Some(result) = stream.next().await {
        match result {
            Ok(chunk) => {
                print!("{}", chunk.content);
                std::io::stdout().flush().context("Failed to flush stdout")?;
                response_text.push_str(&chunk.content);

                if chunk.is_final {
                    break;
                }
            }
            Err(e) => {
                anyhow::bail!("Stream error: {}", e);
            }
        }
    }

    println!();
    println!();

    // Show usage stats if available and verbose
    if app.is_verbose() {
        formatter.print_dim(&format!("Response length: {} characters", response_text.len()));
    }

    Ok(())
}

/// Handle blocking query with progress indicator.
async fn handle_blocking_query(
    app: &App,
    client: &claude_rust_ai::AIClient,
    request: AIRequest,
) -> Result<()> {
    let formatter = app.formatter();

    // Show progress indicator
    let progress = if !app.is_quiet() {
        let pb = ProgressBar::new_spinner();
        pb.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.cyan} {msg}")
                .context("Failed to set progress style")?
        );
        pb.set_message("Thinking...");
        pb.enable_steady_tick(std::time::Duration::from_millis(100));
        Some(pb)
    } else {
        None
    };

    // Execute request
    let response = client
        .complete(&request)
        .await
        .context("Failed to get response from AI")?;

    // Clear progress indicator
    if let Some(pb) = progress {
        pb.finish_and_clear();
    }

    // Display response
    if !app.is_quiet() {
        formatter.print_header("Response");
        println!();
    }

    println!("{}", response.message.content);
    println!();

    // Show usage statistics
    if app.is_verbose() {
        if let Some(usage) = &response.usage {
            println!();
            formatter.print_dim("Usage Statistics:");
            formatter.print_dim(&format!("  Input tokens: {}", usage.prompt_tokens.unwrap_or(0)));
            formatter.print_dim(&format!("  Output tokens: {}", usage.completion_tokens.unwrap_or(0)));
            formatter.print_dim(&format!("  Total tokens: {}", usage.total_tokens.unwrap_or(0)));
        }
    }

    Ok(())
}

/// Handle interactive mode - start REPL session.
pub async fn handle_interactive(app: &App) -> Result<()> {
    let formatter = app.formatter();

    // Extract parameters
    let (provider, model, load_history) = match &app.cli_args().command {
        Some(Commands::Interactive { provider, model, load }) => (
            *provider,
            model.clone(),
            load.clone(),
        ),
        _ => anyhow::bail!("Invalid command for interactive handler"),
    };

    // Print welcome message
    formatter.print_header("Claude-Rust Interactive Session");
    println!();
    formatter.print_info("Type your questions or commands. Use /help for available commands.");
    formatter.print_info("Press Ctrl+C or type /quit to exit.");
    println!();

    // Get AI client
    let ai_client = app.get_ai_client(provider).await?;

    // Create interactive session
    let mut session = InteractiveSession::new(
        ai_client,
        app.formatter(),
        model,
        load_history,
    ).await?;

    // Run REPL loop
    session.run().await?;

    Ok(())
}

/// Helper function to format AI provider for display.
pub fn format_provider(provider: AiProvider) -> &'static str {
    match provider {
        AiProvider::Claude => "Claude",
        AiProvider::OpenAI => "OpenAI",
        AiProvider::Gemini => "Gemini",
        AiProvider::Qwen => "Qwen",
        AiProvider::Ollama => "Ollama",
        AiProvider::LMStudio => "LM Studio",
    }
}
