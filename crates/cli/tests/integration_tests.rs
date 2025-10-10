//! Integration tests for CLI
//!
//! Tests the main functionality of the CLI including slash commands,
//! session management, and interactive mode components

use claude_code_cli::slash_commands::{CommandContext, CommandRegistry, CommandResult};
use claude_code_core::session::{Session, SessionStore};
use claude_code_core::checkpoint::CheckpointStore;
use std::path::PathBuf;
use std::collections::HashMap;

#[test]
fn test_command_registry_initialization() {
    let registry = CommandRegistry::new();
    
    // Verify all built-in commands are registered
    assert!(registry.get("help").is_some());
    assert!(registry.get("quit").is_some());
    assert!(registry.get("exit").is_some());
    assert!(registry.get("clear").is_some());
    assert!(registry.get("history").is_some());
    assert!(registry.get("save").is_some());
    assert!(registry.get("load").is_some());
    assert!(registry.get("model").is_some());
}

#[test]
fn test_slash_command_help() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    
    let result = registry.execute("/help", &mut ctx).unwrap();
    
    match result {
        CommandResult::MessageAndContinue(msg) => {
            assert!(msg.contains("help"));
            assert!(msg.contains("quit"));
        }
        _ => panic!("Expected MessageAndContinue result"),
    }
}

#[test]
fn test_slash_command_quit() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    
    let result = registry.execute("/quit", &mut ctx).unwrap();
    
    assert!(matches!(result, CommandResult::Exit));
}

#[test]
fn test_slash_command_clear() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    
    // Add some history
    ctx.history.push(claude_code_ai::Message {
        role: claude_code_ai::MessageRole::User,
        content: "test message".to_string(),
    });
    
    let result = registry.execute("/clear", &mut ctx).unwrap();
    
    assert!(matches!(result, CommandResult::ClearHistory));
}

#[test]
fn test_unknown_command() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    
    let result = registry.execute("/nonexistent", &mut ctx).unwrap();
    
    match result {
        CommandResult::Message(msg) => {
            assert!(msg.contains("Unknown command"));
            assert!(msg.contains("/help"));
        }
        _ => panic!("Expected Message result for unknown command"),
    }
}

#[tokio::test]
async fn test_session_store_create_and_load() {
    let temp_dir = std::env::temp_dir().join("claude_test_sessions");
    std::fs::create_dir_all(&temp_dir).unwrap();
    
    let store = SessionStore::new(Some(temp_dir.clone())).unwrap();
    let session = Session::new();
    let session_id = session.id.clone();
    
    // Save session
    store.save(&session).await.unwrap();
    
    // Load session
    let loaded = store.load(&session_id).await.unwrap();
    assert_eq!(session.id, loaded.id);
    
    // Cleanup
    std::fs::remove_dir_all(&temp_dir).ok();
}

#[tokio::test]
async fn test_session_store_list() {
    let temp_dir = std::env::temp_dir().join("claude_test_sessions_list");
    std::fs::create_dir_all(&temp_dir).unwrap();
    
    let store = SessionStore::new(Some(temp_dir.clone())).unwrap();
    
    // Create and save multiple sessions
    for _ in 0..3 {
        let session = Session::new();
        store.save(&session).await.unwrap();
    }
    
    // List sessions
    let sessions = store.list().await.unwrap();
    assert_eq!(sessions.len(), 3);
    
    // Cleanup
    std::fs::remove_dir_all(&temp_dir).ok();
}

#[tokio::test]
async fn test_checkpoint_store_create_and_restore() {
    let temp_dir = std::env::temp_dir().join("claude_test_checkpoints");
    std::fs::create_dir_all(&temp_dir).unwrap();
    
    let store = CheckpointStore::new(Some(temp_dir.clone()), true).unwrap();
    
    // Create checkpoint
    let checkpoint = claude_code_core::checkpoint::Checkpoint {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now(),
        description: Some("Test checkpoint".to_string()),
        conversation: vec![],
        files: HashMap::new(),
    };
    
    let checkpoint_id = checkpoint.id.clone();
    store.save(&checkpoint).await.unwrap();
    
    // List checkpoints
    let checkpoints = store.list().await.unwrap();
    assert_eq!(checkpoints.len(), 1);
    assert_eq!(checkpoints[0].id, checkpoint_id);
    
    // Load checkpoint
    let loaded = store.load(&checkpoint_id).await.unwrap();
    assert_eq!(loaded.id, checkpoint_id);
    
    // Cleanup
    std::fs::remove_dir_all(&temp_dir).ok();
}

#[test]
fn test_command_context_history_limit() {
    let mut ctx = create_test_context();
    
    // Add messages up to the limit
    for i in 0..1100 {
        ctx.add_message(claude_code_ai::Message {
            role: claude_code_ai::MessageRole::User,
            content: format!("Message {}", i),
        });
    }
    
    // Should have been truncated to MAX_HISTORY_IN_MEMORY (1000)
    assert_eq!(ctx.history.len(), 1000);
    
    // First message should be "Message 100" (0-99 removed)
    assert_eq!(ctx.history[0].content, "Message 100");
}

#[test]
fn test_command_context_recent_history() {
    let mut ctx = create_test_context();
    
    // Add 50 messages
    for i in 0..50 {
        ctx.history.push(claude_code_ai::Message {
            role: claude_code_ai::MessageRole::User,
            content: format!("Message {}", i),
        });
    }
    
    // Get recent 10
    let recent = ctx.recent_history(10);
    assert_eq!(recent.len(), 10);
    assert_eq!(recent[0].content, "Message 40");
    assert_eq!(recent[9].content, "Message 49");
}

#[test]
fn test_model_command() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    ctx.model = "claude-3-5-sonnet-20241022".to_string();
    
    // Test showing current model
    let result = registry.execute("/model", &mut ctx).unwrap();
    match result {
        CommandResult::MessageAndContinue(msg) => {
            assert!(msg.contains("claude-3-5-sonnet"));
        }
        _ => panic!("Expected MessageAndContinue"),
    }
}

#[test]
fn test_history_command_empty() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    
    let result = registry.execute("/history", &mut ctx).unwrap();
    match result {
        CommandResult::MessageAndContinue(msg) => {
            assert!(msg.contains("empty") || msg.contains("No messages"));
        }
        _ => panic!("Expected MessageAndContinue"),
    }
}

#[test]
fn test_history_command_with_messages() {
    let registry = CommandRegistry::new();
    let mut ctx = create_test_context();
    
    // Add some messages
    ctx.history.push(claude_code_ai::Message {
        role: claude_code_ai::MessageRole::User,
        content: "Hello".to_string(),
    });
    ctx.history.push(claude_code_ai::Message {
        role: claude_code_ai::MessageRole::Assistant,
        content: "Hi there!".to_string(),
    });
    
    let result = registry.execute("/history", &mut ctx).unwrap();
    match result {
        CommandResult::MessageAndContinue(msg) => {
            assert!(msg.contains("Hello"));
            assert!(msg.contains("Hi there!"));
        }
        _ => panic!("Expected MessageAndContinue"),
    }
}

// Helper function to create a test context
fn create_test_context() -> CommandContext {
    CommandContext {
        history: Vec::new(),
        model: "claude-3-5-sonnet-20241022".to_string(),
        session_store: None,
        checkpoint_store: None,
        session_id: None,
        working_dir: PathBuf::from("."),
        metadata: HashMap::new(),
    }
}

#[cfg(test)]
mod session_integration {
    use super::*;
    
    #[tokio::test]
    async fn test_full_session_lifecycle() {
        let temp_dir = std::env::temp_dir().join("claude_test_lifecycle");
        std::fs::create_dir_all(&temp_dir).unwrap();
        
        let store = SessionStore::new(Some(temp_dir.clone())).unwrap();
        
        // Create session
        let mut session = Session::new();
        let session_id = session.id.clone();
        
        // Add some messages
        session.add_message(claude_code_ai::Message {
            role: claude_code_ai::MessageRole::User,
            content: "Test message".to_string(),
        });
        
        // Save
        store.save(&session).await.unwrap();
        
        // Load
        let loaded = store.load(&session_id).await.unwrap();
        assert_eq!(loaded.messages.len(), 1);
        assert_eq!(loaded.messages[0].content, "Test message");
        
        // Delete
        store.delete(&session_id).await.unwrap();
        
        // Verify deleted
        assert!(store.load(&session_id).await.is_err());
        
        // Cleanup
        std::fs::remove_dir_all(&temp_dir).ok();
    }
}
