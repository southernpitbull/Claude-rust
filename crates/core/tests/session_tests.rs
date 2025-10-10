//! Unit tests for session management

use claude_code_core::session::{Session, SessionMetadata};
use claude_code_ai::{Message, MessageRole};

#[test]
fn test_session_creation() {
    let session = Session::new();
    assert!(!session.id.is_empty());
    assert!(session.messages.is_empty());
}

#[test]
fn test_session_add_message() {
    let mut session = Session::new();
    
    let msg = Message {
        role: MessageRole::User,
        content: "Hello".to_string(),
    };
    
    session.add_message(msg.clone());
    assert_eq!(session.messages.len(), 1);
    assert_eq!(session.messages[0].content, "Hello");
}

#[test]
fn test_session_metadata() {
    let session = Session::new();
    let metadata = session.metadata();
    
    assert_eq!(metadata.id, session.id);
    assert!(!metadata.created_at.is_empty());
}

#[test]
fn test_session_clear_history() {
    let mut session = Session::new();
    
    session.add_message(Message {
        role: MessageRole::User,
        content: "Test".to_string(),
    });
    
    assert_eq!(session.messages.len(), 1);
    
    session.clear_history();
    assert_eq!(session.messages.len(), 0);
}

#[test]
fn test_session_message_count() {
    let mut session = Session::new();
    
    for i in 0..5 {
        session.add_message(Message {
            role: MessageRole::User,
            content: format!("Message {}", i),
        });
    }
    
    assert_eq!(session.messages.len(), 5);
}
