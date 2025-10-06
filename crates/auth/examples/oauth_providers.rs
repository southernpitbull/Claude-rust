//! OAuth Provider Examples
//!
//! This example demonstrates how to use the provider-specific OAuth implementations.
//!
//! # Usage
//!
//! ```bash
//! cargo run --example oauth_providers --features="auth"
//! ```

use claude_rust_auth::{ClaudeOAuth, GeminiOAuth, OpenAIOAuth, QwenOAuth};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing for logging
    tracing_subscriber::fmt::init();

    println!("OAuth Provider Examples");
    println!("======================\n");

    // Example 1: Claude OAuth
    println!("1. Claude OAuth Configuration:");
    let claude_oauth = ClaudeOAuth::new("your_claude_client_id".to_string())
        .with_scopes(vec!["read".to_string(), "write".to_string()]);
    println!("   ✓ Configured with PKCE and default scopes\n");

    // Example 2: OpenAI OAuth
    println!("2. OpenAI OAuth Configuration:");
    let openai_oauth = OpenAIOAuth::new("your_openai_client_id".to_string())
        .with_scopes(vec!["api.read".to_string(), "api.write".to_string()]);
    println!("   ✓ Configured with PKCE and API scopes\n");

    // Example 3: Gemini OAuth
    println!("3. Gemini OAuth Configuration:");
    let gemini_oauth = GeminiOAuth::new("your_gemini_client_id".to_string())
        .with_scopes(vec![
            "https://www.googleapis.com/auth/generative-language.retriever".to_string(),
        ]);
    println!("   ✓ Configured with Google-specific parameters\n");

    // Example 4: Qwen OAuth
    println!("4. Qwen OAuth Configuration:");
    let qwen_oauth = QwenOAuth::new("your_qwen_client_id".to_string())
        .with_scopes(vec!["qwen.read".to_string(), "qwen.write".to_string()]);
    println!("   ✓ Configured with Alibaba Cloud OAuth\n");

    println!("\nAll providers configured successfully!");
    println!("\nTo authenticate, uncomment the following line:");
    println!("// let token = claude_oauth.authenticate().await?;");

    Ok(())
}
