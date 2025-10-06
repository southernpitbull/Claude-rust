//! First-run experience and setup wizard
//!
//! Handles initial setup, provider selection, and multi-provider authentication

use anyhow::Result;
use claude_rust_auth::{AuthManager, CredentialStore};
use claude_rust_core::types::ProviderType;
use claude_rust_core::config::ConfigLoader;
use std::io::{self, Write};
use std::fs;
use tracing::{info, warn};

/// Check if this is the first run (no authenticated providers)
pub async fn is_first_run() -> Result<bool> {
    let store = CredentialStore::new();
    let manager = AuthManager::new(store)?;

    // Check if any provider has credentials
    for provider in &["claude", "openai", "gemini", "qwen"] {
        if manager.has_credentials(provider).await {
            return Ok(false);
        }
    }

    // No provider authenticated - first run
    Ok(true)
}

/// Run the first-time setup wizard
pub async fn run_first_time_setup() -> Result<()> {
    println!("\n🎉 Welcome to Claude-Rust Rust!\n");
    println!("Let's get you set up with AI providers.\n");

    // Show available providers
    println!("Available providers:");
    println!("  1. Claude (Anthropic) - claude-3-5-sonnet-20241022");
    println!("  2. OpenAI - GPT-4, GPT-3.5");
    println!("  3. Google Gemini - gemini-pro");
    println!("  4. Alibaba Qwen - qwen-turbo");
    println!();

    // Ask which providers to set up
    println!("Which providers would you like to set up?");
    println!("  [a] All providers");
    println!("  [s] Select specific providers");
    println!("  [c] Claude only (recommended for first-time users)");
    print!("\nYour choice [a/s/c]: ");
    io::stdout().flush()?;

    let mut choice = String::new();
    io::stdin().read_line(&mut choice)?;
    let choice = choice.trim().to_lowercase();

    let providers_to_setup = match choice.as_str() {
        "a" | "all" => {
            vec![
                ProviderType::Claude,
                ProviderType::OpenAI,
                ProviderType::Gemini,
                ProviderType::Qwen,
            ]
        }
        "c" | "claude" => vec![ProviderType::Claude],
        "s" | "select" => select_specific_providers()?,
        _ => {
            println!("Invalid choice. Defaulting to Claude only.");
            vec![ProviderType::Claude]
        }
    };

    println!();

    // Track successfully configured providers
    let mut configured_providers = Vec::new();

    // Set up each provider
    for provider in &providers_to_setup {
        if let Err(e) = setup_provider(*provider).await {
            warn!("Failed to set up {}: {}", provider, e);
            println!("⚠️  Failed to set up {}. You can set it up later with:", provider);
            println!("   claude-rust auth login {}\n", provider.to_string().to_lowercase());
        } else {
            configured_providers.push(*provider);
        }
    }

    // If multiple providers configured, ask which should be default
    if configured_providers.len() > 1 {
        println!("\n📌 You've set up multiple providers!");
        println!("Which one would you like to use as the default?\n");

        for (i, provider) in configured_providers.iter().enumerate() {
            println!("  {}. {}", i + 1, provider);
        }

        print!("\nYour choice [1-{}]: ", configured_providers.len());
        io::stdout().flush()?;

        let mut choice = String::new();
        io::stdin().read_line(&mut choice)?;

        if let Ok(idx) = choice.trim().parse::<usize>() {
            if idx > 0 && idx <= configured_providers.len() {
                let default_provider = configured_providers[idx - 1];
                if let Err(e) = set_default_provider(default_provider).await {
                    warn!("Failed to set default provider: {}", e);
                    println!("⚠️  Could not set default provider. You can set it later with:");
                    println!("   claude-code config set provider.default {}", default_provider.to_string().to_lowercase());
                } else {
                    println!("\n✅ {} set as default provider!", default_provider);
                }
            } else {
                println!("\n⚠️  Invalid choice. Using {} as default.", configured_providers[0]);
                let _ = set_default_provider(configured_providers[0]).await;
            }
        } else {
            println!("\n⚠️  Invalid input. Using {} as default.", configured_providers[0]);
            let _ = set_default_provider(configured_providers[0]).await;
        }
    } else if configured_providers.len() == 1 {
        // Only one provider - set it as default automatically
        let default_provider = configured_providers[0];
        if let Err(e) = set_default_provider(default_provider).await {
            warn!("Failed to set default provider: {}", e);
        } else {
            println!("\n✅ {} set as your default provider!", default_provider);
        }
    }

    println!("\n✅ Setup complete! You're ready to use Claude-Rust.");
    println!("\nQuick start:");
    println!("  claude-code ask \"What is Rust?\"");
    println!("  claude-code chat");
    println!("  claude-rust --help\n");

    Ok(())
}

/// Prompt user to select specific providers
fn select_specific_providers() -> Result<Vec<ProviderType>> {
    let mut selected = Vec::new();

    println!("\nSelect providers (y/n for each):");

    if prompt_yes_no("  Claude (Anthropic)?")? {
        selected.push(ProviderType::Claude);
    }
    if prompt_yes_no("  OpenAI?")? {
        selected.push(ProviderType::OpenAI);
    }
    if prompt_yes_no("  Google Gemini?")? {
        selected.push(ProviderType::Gemini);
    }
    if prompt_yes_no("  Alibaba Qwen?")? {
        selected.push(ProviderType::Qwen);
    }

    if selected.is_empty() {
        println!("No providers selected. Adding Claude as default.");
        selected.push(ProviderType::Claude);
    }

    Ok(selected)
}

/// Prompt for yes/no answer
fn prompt_yes_no(question: &str) -> Result<bool> {
    print!("{} [y/n]: ", question);
    io::stdout().flush()?;

    let mut answer = String::new();
    io::stdin().read_line(&mut answer)?;

    Ok(matches!(answer.trim().to_lowercase().as_str(), "y" | "yes"))
}

/// Set up authentication for a specific provider
async fn setup_provider(provider: ProviderType) -> Result<()> {
    println!("\n🔐 Setting up {}...", provider);

    // Check for environment variable first
    let env_var = match provider {
        ProviderType::Claude => "CLAUDE_API_KEY",
        ProviderType::OpenAI => "OPENAI_API_KEY",
        ProviderType::Gemini => "GEMINI_API_KEY",
        ProviderType::Qwen => "QWEN_API_KEY",
        ProviderType::Ollama => "OLLAMA_API_KEY",
        ProviderType::LMStudio => "LMSTUDIO_API_KEY",
    };

    if let Ok(api_key) = std::env::var(env_var) {
        println!("   Found API key in ${}", env_var);

        // Store the API key
        let store = CredentialStore::new();
        let manager = AuthManager::new(store)?;
        manager.store_api_key(&provider.to_string().to_lowercase(), &api_key).await?;

        println!("   ✅ {} configured successfully!", provider);
        return Ok(());
    }

    // Prompt for authentication method
    println!("   Choose authentication method:");
    println!("     1. API Key (paste your key)");
    println!("     2. OAuth (browser-based login)");
    print!("   Choice [1/2]: ");
    io::stdout().flush()?;

    let mut method = String::new();
    io::stdin().read_line(&mut method)?;

    match method.trim() {
        "1" => setup_api_key(provider).await,
        "2" => setup_oauth(provider).await,
        _ => {
            println!("   Invalid choice. Defaulting to API key.");
            setup_api_key(provider).await
        }
    }
}

/// Set up provider using API key
async fn setup_api_key(provider: ProviderType) -> Result<()> {
    println!("\n   Enter your {} API key:", provider);
    println!("   (Get it from: {})", get_api_key_url(provider));
    print!("   API Key: ");
    io::stdout().flush()?;

    let mut api_key = String::new();
    io::stdin().read_line(&mut api_key)?;
    let api_key = api_key.trim();

    if api_key.is_empty() {
        return Err(anyhow::anyhow!("API key cannot be empty"));
    }

    // Store the API key
    let store = CredentialStore::new();
    let manager = AuthManager::new(store)?;
    manager.store_api_key(&provider.to_string().to_lowercase(), api_key).await?;

    println!("   ✅ {} configured successfully!", provider);
    Ok(())
}

/// Set up provider using OAuth
async fn setup_oauth(provider: ProviderType) -> Result<()> {
    println!("\n   Starting OAuth flow for {}...", provider);
    println!("   A browser window will open for authentication.");
    println!("   Follow the prompts to authorize Claude-Rust.");

    // TODO: Implement OAuth flow
    // For now, this is a placeholder
    warn!("OAuth not yet implemented for {}", provider);
    println!("   ⚠️  OAuth not yet available. Please use API key instead.");

    setup_api_key(provider).await
}

/// Get the URL where users can obtain API keys
fn get_api_key_url(provider: ProviderType) -> &'static str {
    match provider {
        ProviderType::Claude => "https://console.anthropic.com/settings/keys",
        ProviderType::OpenAI => "https://platform.openai.com/api-keys",
        ProviderType::Gemini => "https://makersuite.google.com/app/apikey",
        ProviderType::Qwen => "https://dashscope.console.aliyun.com/apiKey",
        ProviderType::Ollama => "http://localhost:11434 (local installation)",
        ProviderType::LMStudio => "http://localhost:1234 (local installation)",
    }
}

/// Set the default provider in the configuration
async fn set_default_provider(provider: ProviderType) -> Result<()> {
    // Load current configuration
    let loader = ConfigLoader::new();
    let mut config = loader.load()?;

    // Set the default provider
    let provider_name = provider.to_string().to_lowercase();
    config.providers.default_provider = Some(provider_name.clone());

    info!("Setting default provider to: {}", provider_name);

    // Save the updated configuration
    let config_dir = if cfg!(target_os = "windows") {
        dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not determine config directory"))?
            .join("claude-code")
    } else {
        dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
            .join(".config")
            .join("claude-code")
    };

    // Create config directory if it doesn't exist
    fs::create_dir_all(&config_dir)?;

    let config_path = config_dir.join("config.toml");

    // Serialize and save configuration
    let toml_content = toml::to_string_pretty(&config)?;
    fs::write(&config_path, toml_content)?;

    info!("Saved default provider configuration to {}", config_path.display());

    Ok(())
}

// Use dirs crate for cross-platform directory detection
mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .ok()
            .map(PathBuf::from)
    }

    pub fn config_dir() -> Option<PathBuf> {
        if cfg!(target_os = "windows") {
            std::env::var("APPDATA").ok().map(PathBuf::from)
        } else {
            home_dir().map(|h| h.join(".config"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_urls() {
        assert!(!get_api_key_url(ProviderType::Claude).is_empty());
        assert!(!get_api_key_url(ProviderType::OpenAI).is_empty());
        assert!(!get_api_key_url(ProviderType::Gemini).is_empty());
        assert!(!get_api_key_url(ProviderType::Qwen).is_empty());
    }
}
