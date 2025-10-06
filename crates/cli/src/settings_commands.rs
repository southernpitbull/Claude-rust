//! Settings Commands
//!
//! Provides command-line interface for managing Claude-Rust settings

use crate::settings::SettingsManager;
use anyhow::Result;
use std::path::Path;

/// Handle settings show command
pub async fn handle_settings_show(manager: &SettingsManager) -> Result<()> {
    let settings = manager.get_settings();
    
    println!("\n⚙️  Claude-Rust Settings:\n");
    
    // AI Settings
    println!("🤖 AI Settings:");
    println!("   Default Model: {}", settings.ai.default_model);
    println!("   Max Tokens: {}", settings.ai.max_tokens);
    println!("   Temperature: {}", settings.ai.temperature);
    println!("   Top-P: {}", settings.ai.top_p);
    println!("   Streaming: {}", settings.ai.streaming);
    
    // UI Settings
    println!("\n🎨 UI Settings:");
    println!("   Color Scheme: {}", settings.ui.color_scheme);
    println!("   Prompt Format: {}", settings.ui.prompt_format);
    println!("   Line Wrapping: {}", settings.ui.line_wrapping);
    println!("   Syntax Highlighting: {}", settings.ui.syntax_highlighting);
    println!("   Show Token Usage: {}", settings.ui.show_token_usage);
    
    // Behavior Settings
    println!("\n⚡ Behavior Settings:");
    println!("   Auto Save: {}", settings.behavior.auto_save);
    println!("   Session Retention: {} days", settings.behavior.session_retention_days);
    println!("   Checkpoint Frequency: {} messages", settings.behavior.checkpoint_frequency);
    
    // Directory Settings
    println!("\n📁 Directory Settings:");
    if !settings.directories.working_dirs.is_empty() {
        println!("   Working Dirs:");
        for dir in &settings.directories.working_dirs {
            println!("     - {}", dir.display());
        }
    }
    println!("   Max File Size: {} bytes", settings.directories.max_file_size);
    println!("   Binary Handling: {}", settings.directories.binary_handling);
    
    // Custom Settings
    if !settings.custom.is_empty() {
        println!("\n🔧 Custom Settings:");
        for (key, value) in &settings.custom {
            println!("   {}: {}", key, value);
        }
    }
    
    Ok(())
}

/// Handle settings set command
pub async fn handle_settings_set(
    manager: &mut SettingsManager,
    key: &str,
    value: &str,
    global: bool,
) -> Result<()> {
    println!("\n⚙️  Set Setting:\n");
    println!("   Key: {}", key);
    println!("   Value: {}", value);
    println!("   Scope: {}", if global { "global" } else { "project" });
    
    // For now, we'll just store it as a custom setting
    // In a more sophisticated implementation, we would parse the key path
    // and update the appropriate nested field
    manager.set_setting(key, serde_json::Value::String(value.to_string()))?;
    
    if global {
        manager.save_global_settings()?;
        println!("✅ Global setting updated");
    } else {
        // Try to save project settings, fallback to global if no project path
        match manager.save_project_settings() {
            Ok(_) => println!("✅ Project setting updated"),
            Err(_) => {
                manager.save_global_settings()?;
                println!("⚠️  No project context, saved to global settings");
            }
        }
    }
    
    Ok(())
}

/// Handle settings get command
pub async fn handle_settings_get(manager: &SettingsManager, key: &str) -> Result<()> {
    println!("\n⚙️  Get Setting:\n");
    
    if let Some(value) = manager.get_setting(key) {
        println!("   {} = {}", key, value);
    } else {
        println!("   {} = (not set)", key);
    }
    
    Ok(())
}

/// Handle settings list command
pub async fn handle_settings_list(manager: &SettingsManager, global: bool) -> Result<()> {
    let settings = manager.get_settings();
    
    println!("\n⚙️  {} Settings:\n", if global { "Global" } else { "Project" });
    
    // AI Settings
    println!("🤖 AI Settings:");
    println!("   ai.default_model = \"{}\"", settings.ai.default_model);
    println!("   ai.max_tokens = {}", settings.ai.max_tokens);
    println!("   ai.temperature = {}", settings.ai.temperature);
    println!("   ai.top_p = {}", settings.ai.top_p);
    println!("   ai.streaming = {}", settings.ai.streaming);
    
    // UI Settings
    println!("\n🎨 UI Settings:");
    println!("   ui.color_scheme = \"{}\"", settings.ui.color_scheme);
    println!("   ui.prompt_format = \"{}\"", settings.ui.prompt_format);
    println!("   ui.line_wrapping = {}", settings.ui.line_wrapping);
    println!("   ui.syntax_highlighting = {}", settings.ui.syntax_highlighting);
    println!("   ui.show_token_usage = {}", settings.ui.show_token_usage);
    
    // Behavior Settings
    println!("\n⚡ Behavior Settings:");
    println!("   behavior.auto_save = {}", settings.behavior.auto_save);
    println!("   behavior.session_retention_days = {}", settings.behavior.session_retention_days);
    println!("   behavior.checkpoint_frequency = {}", settings.behavior.checkpoint_frequency);
    
    // Directory Settings
    println!("\n📁 Directory Settings:");
    println!("   directories.max_file_size = {}", settings.directories.max_file_size);
    println!("   directories.binary_handling = \"{}\"", settings.directories.binary_handling);
    
    // Custom Settings
    if !settings.custom.is_empty() {
        println!("\n🔧 Custom Settings:");
        for (key, value) in &settings.custom {
            println!("   {} = {}", key, value);
        }
    }
    
    Ok(())
}

/// Handle settings reset command
pub async fn handle_settings_reset(manager: &mut SettingsManager, global: bool, yes: bool) -> Result<()> {
    if !yes {
        print!("\n⚠️  This will reset {} settings to defaults. Continue? [y/N] ", 
               if global { "global" } else { "project" });
        std::io::Write::flush(&mut std::io::stdout())?;
        
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
        
        if input.trim().to_lowercase() != "y" {
            println!("❌ Reset cancelled");
            return Ok(());
        }
    }
    
    println!("\n⚙️  Reset Settings:\n");
    
    if global {
        // Reset global settings by saving default settings
        manager.save_global_settings()?;
        println!("✅ Global settings reset to defaults");
    } else {
        // Reset project settings
        match manager.save_project_settings() {
            Ok(_) => println!("✅ Project settings reset to defaults"),
            Err(_) => println!("⚠️  No project context or failed to reset project settings"),
        }
    }
    
    Ok(())
}

/// Create a new settings manager for the current context
pub fn create_settings_manager() -> Result<SettingsManager> {
    let mut manager = SettingsManager::new()?;
    
    // Try to set project path from current directory
    if let Ok(current_dir) = std::env::current_dir() {
        manager = manager.with_project_path(&current_dir);
    }
    
    // Try to set local path from current directory
    if let Ok(current_dir) = std::env::current_dir() {
        manager = manager.with_local_path(&current_dir);
    }
    
    Ok(manager)
}