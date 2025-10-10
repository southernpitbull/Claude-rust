//! Authentication command handlers.

use anyhow::{Context, Result};
use claude_code_terminal::Table;
use dialoguer::{Password, Confirm};
use tracing::{debug, info};
use chrono::{DateTime, Utc, TimeZone};

use crate::app::App;
use crate::cli::{AuthCommands, AiProvider, OutputFormat};

/// Handle authentication commands.
pub async fn handle(app: &App, command: &AuthCommands) -> Result<()> {
    match command {
        AuthCommands::Login { provider, api_key, key } => {
            handle_login(app, *provider, *api_key, key.clone()).await
        }
        AuthCommands::Logout { provider, all } => {
            handle_logout(app, *provider, *all).await
        }
        AuthCommands::Status { detailed } => {
            handle_status(app, *detailed).await
        }
        AuthCommands::Accounts { format } => {
            handle_accounts(app, *format).await
        }
    }
}

/// Handle login command - OAuth or API key authentication.
async fn handle_login(
    app: &App,
    provider: AiProvider,
    use_api_key: bool,
    api_key: Option<String>,
) -> Result<()> {
    let formatter = app.formatter();
    let auth_manager = app.auth_manager();

    formatter.print_header(&format!("Authenticating with {}", provider));
    println!();

    let provider_name = provider.to_string();

    if use_api_key {
        // API Key authentication
        let key = if let Some(k) = api_key {
            k
        } else {
            // Prompt for API key
            Password::new()
                .with_prompt(format!("Enter {} API key", provider))
                .interact()
                .context("Failed to read API key")?
        };

        info!("Authenticating with API key for {}", provider_name);

        // Store credentials
        auth_manager
            .store_api_key(&provider_name, &key)
            .await
            .context("Failed to store API key")?;

        formatter.print_success(&format!("Successfully authenticated with {}", provider));
        println!();
        println!("API key has been securely stored in your system keychain.");
    } else {
        // OAuth authentication
        info!("Starting OAuth flow for {}", provider_name);

        formatter.print_info("Opening browser for authentication...");
        println!();

        // Start OAuth flow
        let token = auth_manager
            .authenticate_oauth(&provider_name)
            .await
            .context("OAuth authentication failed")?;

        debug!("OAuth token received");

        formatter.print_success(&format!("Successfully authenticated with {}", provider));
        println!();
        println!("Access token has been securely stored.");

        if !app.is_quiet() {
            println!("Token expires: {}", token.expires_at()
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| "Never".to_string()));
        }
    }

    println!();
    formatter.print_info(&format!(
        "You can now use {} with: claude-code query --provider {}",
        provider, provider
    ));

    Ok(())
}

/// Handle logout command - clear credentials.
async fn handle_logout(
    app: &App,
    provider: Option<AiProvider>,
    logout_all: bool,
) -> Result<()> {
    let formatter = app.formatter();
    let auth_manager = app.auth_manager();

    if logout_all {
        // Confirm logout from all providers
        let confirmed = if app.is_quiet() {
            true
        } else {
            Confirm::new()
                .with_prompt("Are you sure you want to logout from all providers?")
                .default(false)
                .interact()
                .context("Failed to read confirmation")?
        };

        if !confirmed {
            formatter.print_warning("Logout cancelled");
            return Ok(());
        }

        formatter.print_info("Logging out from all providers...");
        println!();

        let providers = vec![
            "claude", "openai", "gemini", "qwen", "ollama", "lmstudio"
        ];

        for provider_name in providers {
            if auth_manager.has_credentials(provider_name).await {
                auth_manager
                    .clear_credentials(provider_name)
                    .await
                    .context(format!("Failed to clear credentials for {}", provider_name))?;

                formatter.print_success(&format!("Logged out from {}", provider_name));
            }
        }

        println!();
        formatter.print_success("Successfully logged out from all providers");
    } else if let Some(provider) = provider {
        let provider_name = provider.to_string();

        if !auth_manager.has_credentials(&provider_name).await {
            formatter.print_warning(&format!("Not logged in to {}", provider));
            return Ok(());
        }

        formatter.print_info(&format!("Logging out from {}...", provider));

        auth_manager
            .clear_credentials(&provider_name)
            .await
            .context(format!("Failed to clear credentials for {}", provider))?;

        formatter.print_success(&format!("Successfully logged out from {}", provider));
    } else {
        anyhow::bail!("Must specify --provider or --all");
    }

    Ok(())
}

/// Handle status command - show authentication status.
async fn handle_status(app: &App, detailed: bool) -> Result<()> {
    let formatter = app.formatter();
    let auth_manager = app.auth_manager();

    formatter.print_header("Authentication Status");
    println!();

    let providers = vec![
        ("Claude", "claude"),
        ("OpenAI", "openai"),
        ("Gemini", "gemini"),
        ("Qwen", "qwen"),
        ("Ollama", "ollama"),
        ("LM Studio", "lmstudio"),
    ];

    let mut table = Table::new().set_header(vec!["Provider", "Status", "Method"]);

    for (display_name, provider_name) in providers {
        let has_creds = auth_manager.has_credentials(provider_name).await;

        let status = if has_creds {
            formatter.style_success("Authenticated")
        } else {
            formatter.style_dim("Not authenticated")
        };

        let method = if has_creds {
            if auth_manager.has_api_key(provider_name).await {
                "API Key"
            } else {
                "OAuth"
            }
        } else {
            "-"
        };

        table = table.add_row(vec![
            display_name.to_string(),
            status,
            method.to_string(),
        ]);

        if detailed && has_creds {
            if let Ok(Some(token)) = auth_manager.get_token_str(provider_name).await {
                println!();
                println!("  {}:", display_name);
                println!("    Token Type: {}", token.token_type);
                let expires_at: DateTime<Utc> = Utc.timestamp_opt(token.expires_at, 0).unwrap();
                println!("    Expires: {}", expires_at.to_rfc3339());
                if !token.scope.is_empty() {
                    println!("    Scopes: {}", token.scope);
                }
            }
        }
    }

    table.print();

    if !detailed {
        println!();
        formatter.print_dim("Run with --detailed for more information");
    }

    Ok(())
}

/// Handle accounts command - list authenticated accounts.
async fn handle_accounts(app: &App, format: OutputFormat) -> Result<()> {
    let formatter = app.formatter();
    let auth_manager = app.auth_manager();

    let providers = vec![
        ("Claude", "claude"),
        ("OpenAI", "openai"),
        ("Gemini", "gemini"),
        ("Qwen", "qwen"),
        ("Ollama", "ollama"),
        ("LM Studio", "lmstudio"),
    ];

    let mut accounts = Vec::new();

    for (display_name, provider_name) in providers {
        if auth_manager.has_credentials(provider_name).await {
            let method = if auth_manager.has_api_key(provider_name).await {
                "API Key"
            } else {
                "OAuth"
            };

            let expires = if let Ok(Some(token)) = auth_manager.get_token_str(provider_name).await {
                let expires_at: DateTime<Utc> = Utc.timestamp_opt(token.expires_at, 0).unwrap();
                expires_at.to_rfc3339()
            } else {
                "Unknown".to_string()
            };

            accounts.push((display_name, provider_name, method, expires));
        }
    }

    if accounts.is_empty() {
        formatter.print_warning("No authenticated accounts found");
        println!();
        formatter.print_info("Run 'claude-code auth login --provider <PROVIDER>' to authenticate");
        return Ok(());
    }

    match format {
        OutputFormat::Table => {
            formatter.print_header("Authenticated Accounts");
            println!();

            let mut table = Table::new().set_header(vec!["Provider", "Method", "Expires"]);

            for (display_name, _, method, expires) in accounts {
                table = table.add_row(vec![
                    display_name.to_string(),
                    method.to_string(),
                    expires,
                ]);
            }

            table.print();
        }
        OutputFormat::Json => {
            let json_accounts: Vec<serde_json::Value> = accounts
                .iter()
                .map(|(name, id, method, expires)| {
                    serde_json::json!({
                        "provider": name,
                        "provider_id": id,
                        "auth_method": method,
                        "expires_at": expires,
                    })
                })
                .collect();

            println!(
                "{}",
                serde_json::to_string_pretty(&json_accounts)
                    .context("Failed to serialize to JSON")?
            );
        }
        OutputFormat::Yaml => {
            let yaml_accounts: Vec<serde_json::Value> = accounts
                .iter()
                .map(|(name, id, method, expires)| {
                    serde_json::json!({
                        "provider": name,
                        "provider_id": id,
                        "auth_method": method,
                        "expires_at": expires,
                    })
                })
                .collect();

            println!(
                "{}",
                serde_yaml::to_string(&yaml_accounts)
                    .context("Failed to serialize to YAML")?
            );
        }
        OutputFormat::Text => {
            for (display_name, _, method, expires) in accounts {
                println!("{} ({}) - Expires: {}", display_name, method, expires);
            }
        }
    }

    Ok(())
}
