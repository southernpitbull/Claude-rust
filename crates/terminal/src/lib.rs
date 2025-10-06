//! Terminal Interface Layer
//!
//! This crate provides a comprehensive terminal interface with support for:
//! - Formatting and colored output
//! - Interactive prompts (text, select, confirm, password)
//! - Spinners and progress bars
//! - Table rendering
//! - Terminal capabilities detection
//!
//! # Examples
//!
//! ```no_run
//! use claude_code_terminal::{Formatter, Spinner, Prompt, Table};
//!
//! // Format colored output
//! let formatter = Formatter::new(true);
//! println!("{}", formatter.success("Operation completed!"));
//!
//! // Show a spinner
//! let spinner = Spinner::new("Loading...");
//! // do work...
//! spinner.finish_success("Done!");
//!
//! // Prompt for input
//! let name = Prompt::input("Enter your name:").unwrap();
//!
//! // Create a table
//! let table = Table::new()
//!     .set_header(vec!["Name", "Age"])
//!     .add_row(vec!["Alice", "30"])
//!     .render();
//! println!("{}", table);
//! ```

pub mod error;
pub mod format;
pub mod prompt;
pub mod spinner;
pub mod table;
pub mod types;

pub use error::{TerminalError, TerminalResult};
pub use format::{FormatOptions, Formatter, Style, hyperlink, word_wrap};
pub use prompt::{
    ConfirmPrompt, EditorPrompt, InputPrompt, MultiSelectPrompt, PasswordPrompt, Prompt,
    PromptTheme, SelectPrompt,
};
pub use spinner::{MultiProgressManager, ProgressBarWrapper, Spinner, SpinnerStyle};
pub use table::{key_value_table, simple_table, status_table, Alignment, StatusIndicator, Table};
pub use types::{
    ColorLevel, TerminalCapabilities, TerminalConfig, TerminalSize, TerminalTheme,
};
