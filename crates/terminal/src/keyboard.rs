//! Keyboard Shortcut Handler
//!
//! Provides keyboard shortcut functionality for the interactive session

use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers, read};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use std::io;
use std::time::Duration;

/// Keyboard shortcut handler
pub struct KeyboardShortcuts;

impl KeyboardShortcuts {
    /// Read keyboard input with shortcut detection
    pub fn read_with_shortcuts() -> io::Result<Option<UserInput>> {
        // Enable raw mode to capture key events
        enable_raw_mode()?;
        
        loop {
            // Check for events with a short timeout
            if crossterm::event::poll(Duration::from_millis(50))? {
                match read()? {
                    Event::Key(KeyEvent { code, modifiers, .. }) => {
                        match (code, modifiers) {
                            // ESC ESC - Rewind to last checkpoint
                            (KeyCode::Esc, _) => {
                                // Check for double ESC
                                if let Ok(true) = crossterm::event::poll(Duration::from_millis(300)) {
                                    if let Ok(Event::Key(KeyEvent { code: KeyCode::Esc, .. })) = read() {
                                        disable_raw_mode()?;
                                        return Ok(Some(UserInput::Rewind));
                                    }
                                }
                                // Single ESC - continue normally
                                continue;
                            }
                            
                            // Ctrl+C - Exit
                            (KeyCode::Char('c'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Exit));
                            }
                            
                            // Ctrl+D - Exit
                            (KeyCode::Char('d'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Exit));
                            }
                            
                            // Ctrl+L - Clear screen
                            (KeyCode::Char('l'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::ClearScreen));
                            }
                            
                            // Ctrl+S - Save session
                            (KeyCode::Char('s'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Save));
                            }
                            
                            // Ctrl+H - Show help
                            (KeyCode::Char('h'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Help));
                            }
                            
                            // Ctrl+R - Rewind to last checkpoint
                            (KeyCode::Char('r'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Rewind));
                            }
                            
                            // Ctrl+N - New conversation
                            (KeyCode::Char('n'), KeyModifiers::CONTROL) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::NewConversation));
                            }
                            
                            // PageUp/PageDown - Scroll through history
                            (KeyCode::PageUp, _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::ScrollUp));
                            }
                            
                            (KeyCode::PageDown, _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::ScrollDown));
                            }
                            
                            // Arrow keys for navigation
                            (KeyCode::Up, _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::HistoryUp));
                            }
                            
                            (KeyCode::Down, _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::HistoryDown));
                            }
                            
                            // Enter - Submit input
                            (KeyCode::Enter, _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Submit));
                            }
                            
                            // Tab - Auto-complete
                            (KeyCode::Tab, _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::TabComplete));
                            }
                            
                            // Regular character input
                            (KeyCode::Char(ch), _) => {
                                disable_raw_mode()?;
                                return Ok(Some(UserInput::Character(ch)));
                            }
                            
                            // Other keys - ignore for now
                            _ => continue,
                        }
                    }
                    Event::Resize(_, _) => {
                        // Terminal was resized, notify caller
                        disable_raw_mode()?;
                        return Ok(Some(UserInput::Resize));
                    }
                    _ => continue,
                }
            } else {
                // Timeout - continue polling
                continue;
            }
        }
    }
    
    /// Display available keyboard shortcuts
    pub fn display_help() {
        println!("\n⌨️  Keyboard Shortcuts:");
        println!("  Ctrl+C / Ctrl+D  - Exit interactive mode");
        println!("  Ctrl+L           - Clear screen");
        println!("  Ctrl+S           - Save current session");
        println!("  Ctrl+H           - Show this help");
        println!("  Ctrl+R / ESC ESC - Rewind to last checkpoint");
        println!("  Ctrl+N           - Start new conversation");
        println!("  PageUp/PageDown  - Scroll through conversation history");
        println!("  ↑/↓              - Navigate command history");
        println!("  Tab              - Auto-complete commands");
        println!("  Enter            - Submit input");
        println!();
    }
}

/// User input types from keyboard shortcuts
#[derive(Debug, Clone, PartialEq)]
pub enum UserInput {
    /// Character input
    Character(char),
    
    /// Submit current input
    Submit,
    
    /// Auto-complete
    TabComplete,
    
    /// Navigate up in history
    HistoryUp,
    
    /// Navigate down in history
    HistoryDown,
    
    /// Scroll up in conversation
    ScrollUp,
    
    /// Scroll down in conversation
    ScrollDown,
    
    /// Exit interactive mode
    Exit,
    
    /// Clear screen
    ClearScreen,
    
    /// Save session
    Save,
    
    /// Show help
    Help,
    
    /// Rewind to last checkpoint
    Rewind,
    
    /// Start new conversation
    NewConversation,
    
    /// Terminal was resized
    Resize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_input_enum() {
        let char_input = UserInput::Character('a');
        let submit_input = UserInput::Submit;
        
        assert_ne!(char_input, submit_input);
        assert_eq!(char_input, UserInput::Character('a'));
    }
    
    #[test]
    fn test_keyboard_shortcuts_existence() {
        // Just test that the module compiles and has the expected structure
        assert!(true); // Placeholder - actual testing would require mocking terminal events
    }
}