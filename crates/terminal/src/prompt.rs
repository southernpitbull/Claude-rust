/// Terminal Prompts
///
/// Provides functions for creating and handling user prompts in the terminal.

use crate::error::{TerminalError, TerminalResult};
use dialoguer::{
    theme::{ColorfulTheme, SimpleTheme},
    Confirm, Editor, Input, MultiSelect, Password, Select,
};
use std::fmt::Display;

/// Prompt options for text input
pub struct InputPrompt<'a> {
    message: &'a str,
    default: Option<String>,
    validator: Option<Box<dyn Fn(&String) -> Result<(), String> + 'a>>,
    colorful: bool,
}

impl<'a> InputPrompt<'a> {
    /// Create a new input prompt
    pub fn new(message: &'a str) -> Self {
        Self {
            message,
            default: None,
            validator: None,
            colorful: true,
        }
    }

    /// Set default value
    pub fn with_default(mut self, default: impl Into<String>) -> Self {
        self.default = Some(default.into());
        self
    }

    /// Set validator function
    pub fn with_validator<F>(mut self, validator: F) -> Self
    where
        F: Fn(&String) -> Result<(), String> + 'a,
    {
        self.validator = Some(Box::new(validator));
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: PromptTheme) -> Self {
        self.colorful = matches!(theme, PromptTheme::Colorful);
        self
    }

    /// Show the prompt and get input
    pub fn interact(&self) -> TerminalResult<String> {
        let result = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = Input::<String>::with_theme(&theme)
                .with_prompt(self.message);

            if let Some(ref default) = self.default {
                prompt = prompt.default(default.clone());
            }

            if let Some(ref validator) = self.validator {
                prompt = prompt.validate_with(|input: &String| -> Result<(), String> { validator(input) });
            }

            prompt.interact_text()
        } else {
            let mut prompt = Input::<String>::with_theme(&SimpleTheme)
                .with_prompt(self.message);

            if let Some(ref default) = self.default {
                prompt = prompt.default(default.clone());
            }

            if let Some(ref validator) = self.validator {
                prompt = prompt.validate_with(|input: &String| -> Result<(), String> { validator(input) });
            }

            prompt.interact_text()
        };

        result.map_err(|e| TerminalError::Terminal(e.to_string()))
    }
}

/// Prompt options for password input
pub struct PasswordPrompt<'a> {
    message: &'a str,
    confirmation: bool,
    colorful: bool,
}

impl<'a> PasswordPrompt<'a> {
    /// Create a new password prompt
    pub fn new(message: &'a str) -> Self {
        Self {
            message,
            confirmation: false,
            colorful: true,
        }
    }

    /// Require confirmation
    pub fn with_confirmation(mut self) -> Self {
        self.confirmation = true;
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: PromptTheme) -> Self {
        self.colorful = matches!(theme, PromptTheme::Colorful);
        self
    }

    /// Show the prompt and get password
    pub fn interact(&self) -> TerminalResult<String> {
        let result = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = Password::with_theme(&theme)
                .with_prompt(self.message);

            if self.confirmation {
                prompt = prompt.with_confirmation("Confirm password", "Passwords do not match");
            }

            prompt.interact()
        } else {
            let mut prompt = Password::with_theme(&SimpleTheme)
                .with_prompt(self.message);

            if self.confirmation {
                prompt = prompt.with_confirmation("Confirm password", "Passwords do not match");
            }

            prompt.interact()
        };

        result.map_err(|e| TerminalError::Terminal(e.to_string()))
    }
}

/// Prompt options for confirmation
pub struct ConfirmPrompt<'a> {
    message: &'a str,
    default: Option<bool>,
    colorful: bool,
}

impl<'a> ConfirmPrompt<'a> {
    /// Create a new confirmation prompt
    pub fn new(message: &'a str) -> Self {
        Self {
            message,
            default: None,
            colorful: true,
        }
    }

    /// Set default value
    pub fn with_default(mut self, default: bool) -> Self {
        self.default = Some(default);
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: PromptTheme) -> Self {
        self.colorful = matches!(theme, PromptTheme::Colorful);
        self
    }

    /// Show the prompt and get confirmation
    pub fn interact(&self) -> TerminalResult<bool> {
        let result = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = Confirm::with_theme(&theme)
                .with_prompt(self.message);

            if let Some(default) = self.default {
                prompt = prompt.default(default);
            }

            prompt.interact()
        } else {
            let mut prompt = Confirm::with_theme(&SimpleTheme)
                .with_prompt(self.message);

            if let Some(default) = self.default {
                prompt = prompt.default(default);
            }

            prompt.interact()
        };

        result.map_err(|e| TerminalError::Terminal(e.to_string()))
    }
}

/// Prompt options for selection
pub struct SelectPrompt<'a, T> {
    message: &'a str,
    items: Vec<T>,
    default: Option<usize>,
    page_size: Option<usize>,
    colorful: bool,
}

impl<'a, T: Display + Clone> SelectPrompt<'a, T> {
    /// Create a new selection prompt
    pub fn new(message: &'a str, items: Vec<T>) -> Self {
        Self {
            message,
            items,
            default: None,
            page_size: None,
            colorful: true,
        }
    }

    /// Set default selection
    pub fn with_default(mut self, default: usize) -> Self {
        self.default = Some(default);
        self
    }

    /// Set page size
    pub fn with_page_size(mut self, size: usize) -> Self {
        self.page_size = Some(size);
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: PromptTheme) -> Self {
        self.colorful = matches!(theme, PromptTheme::Colorful);
        self
    }

    /// Show the prompt and get selection
    pub fn interact(&self) -> TerminalResult<T> {
        let idx = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = Select::with_theme(&theme)
                .with_prompt(self.message)
                .items(&self.items);

            if let Some(default) = self.default {
                prompt = prompt.default(default);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        } else {
            let mut prompt = Select::with_theme(&SimpleTheme)
                .with_prompt(self.message)
                .items(&self.items);

            if let Some(default) = self.default {
                prompt = prompt.default(default);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        };

        let idx = idx.map_err(|e| TerminalError::Terminal(e.to_string()))?;
        Ok(self.items[idx].clone())
    }

    /// Show the prompt and get selection index
    pub fn interact_index(&self) -> TerminalResult<usize> {
        let result = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = Select::with_theme(&theme)
                .with_prompt(self.message)
                .items(&self.items);

            if let Some(default) = self.default {
                prompt = prompt.default(default);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        } else {
            let mut prompt = Select::with_theme(&SimpleTheme)
                .with_prompt(self.message)
                .items(&self.items);

            if let Some(default) = self.default {
                prompt = prompt.default(default);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        };

        result.map_err(|e| TerminalError::Terminal(e.to_string()))
    }
}

/// Prompt options for multi-selection
pub struct MultiSelectPrompt<'a, T> {
    message: &'a str,
    items: Vec<T>,
    defaults: Vec<bool>,
    page_size: Option<usize>,
    colorful: bool,
}

impl<'a, T: Display + Clone> MultiSelectPrompt<'a, T> {
    /// Create a new multi-selection prompt
    pub fn new(message: &'a str, items: Vec<T>) -> Self {
        let len = items.len();
        Self {
            message,
            items,
            defaults: vec![false; len],
            page_size: None,
            colorful: true,
        }
    }

    /// Set default selections
    pub fn with_defaults(mut self, defaults: Vec<bool>) -> Self {
        self.defaults = defaults;
        self
    }

    /// Set page size
    pub fn with_page_size(mut self, size: usize) -> Self {
        self.page_size = Some(size);
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: PromptTheme) -> Self {
        self.colorful = matches!(theme, PromptTheme::Colorful);
        self
    }

    /// Show the prompt and get selections
    pub fn interact(&self) -> TerminalResult<Vec<T>> {
        let indices = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = MultiSelect::with_theme(&theme)
                .with_prompt(self.message)
                .items(&self.items);

            // Check if any defaults are set
            if self.defaults.iter().any(|&d| d) {
                prompt = prompt.defaults(&self.defaults);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        } else {
            let mut prompt = MultiSelect::with_theme(&SimpleTheme)
                .with_prompt(self.message)
                .items(&self.items);

            // Check if any defaults are set
            if self.defaults.iter().any(|&d| d) {
                prompt = prompt.defaults(&self.defaults);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        };

        let indices = indices.map_err(|e| TerminalError::Terminal(e.to_string()))?;
        Ok(indices.into_iter().map(|i| self.items[i].clone()).collect())
    }

    /// Show the prompt and get selection indices
    pub fn interact_indices(&self) -> TerminalResult<Vec<usize>> {
        let result = if self.colorful {
            let theme = ColorfulTheme::default();
            let mut prompt = MultiSelect::with_theme(&theme)
                .with_prompt(self.message)
                .items(&self.items);

            // Check if any defaults are set
            if self.defaults.iter().any(|&d| d) {
                prompt = prompt.defaults(&self.defaults);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        } else {
            let mut prompt = MultiSelect::with_theme(&SimpleTheme)
                .with_prompt(self.message)
                .items(&self.items);

            // Check if any defaults are set
            if self.defaults.iter().any(|&d| d) {
                prompt = prompt.defaults(&self.defaults);
            }

            if let Some(page_size) = self.page_size {
                prompt = prompt.max_length(page_size);
            }

            prompt.interact()
        };

        result.map_err(|e| TerminalError::Terminal(e.to_string()))
    }
}

/// Prompt options for editor
pub struct EditorPrompt<'a> {
    message: &'a str,
    default: Option<String>,
    extension: Option<&'a str>,
    theme: PromptTheme,
}

impl<'a> EditorPrompt<'a> {
    /// Create a new editor prompt
    pub fn new(message: &'a str) -> Self {
        Self {
            message,
            default: None,
            extension: None,
            theme: PromptTheme::Colorful,
        }
    }

    /// Set default content
    pub fn with_default(mut self, default: impl Into<String>) -> Self {
        self.default = Some(default.into());
        self
    }

    /// Set file extension (for syntax highlighting)
    pub fn with_extension(mut self, extension: &'a str) -> Self {
        self.extension = Some(extension);
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: PromptTheme) -> Self {
        self.theme = theme;
        self
    }

    /// Show the editor and get content
    pub fn interact(&self) -> TerminalResult<String> {
        let mut editor = Editor::new();

        if let Some(ref default) = self.default {
            editor.require_save(false);
            editor.edit(default)
        } else {
            editor.edit("")
        }
        .map_err(|e| TerminalError::Terminal(e.to_string()))?
        .ok_or_else(|| TerminalError::Terminal("Editor was cancelled".to_string()))
    }
}

/// Prompt theme
#[derive(Debug, Clone, Copy)]
pub enum PromptTheme {
    /// Colorful theme with colors
    Colorful,
    /// Simple theme without colors
    Simple,
}


/// Terminal prompt utilities (convenience functions)
pub struct Prompt;

impl Prompt {
    /// Prompt for text input
    pub fn input(message: &str) -> TerminalResult<String> {
        InputPrompt::new(message).interact()
    }

    /// Prompt for text input with default
    pub fn input_with_default(message: &str, default: impl Into<String>) -> TerminalResult<String> {
        InputPrompt::new(message).with_default(default).interact()
    }

    /// Prompt for text input with validation
    pub fn input_validated<F>(message: &str, validator: F) -> TerminalResult<String>
    where
        F: Fn(&String) -> Result<(), String>,
    {
        InputPrompt::new(message).with_validator(validator).interact()
    }

    /// Prompt for password
    pub fn password(message: &str) -> TerminalResult<String> {
        PasswordPrompt::new(message).interact()
    }

    /// Prompt for password with confirmation
    pub fn password_with_confirmation(message: &str) -> TerminalResult<String> {
        PasswordPrompt::new(message)
            .with_confirmation()
            .interact()
    }

    /// Prompt for confirmation
    pub fn confirm(message: &str) -> TerminalResult<bool> {
        ConfirmPrompt::new(message).interact()
    }

    /// Prompt for confirmation with default
    pub fn confirm_with_default(message: &str, default: bool) -> TerminalResult<bool> {
        ConfirmPrompt::new(message).with_default(default).interact()
    }

    /// Prompt for selection from a list
    pub fn select<T: Display + Clone>(message: &str, items: Vec<T>) -> TerminalResult<T> {
        SelectPrompt::new(message, items).interact()
    }

    /// Prompt for selection from string list
    pub fn select_from_list(message: &str, items: &[&str]) -> TerminalResult<usize> {
        let items: Vec<String> = items.iter().map(|s| s.to_string()).collect();
        SelectPrompt::new(message, items).interact_index()
    }

    /// Prompt for multiple selections
    pub fn multi_select<T: Display + Clone>(message: &str, items: Vec<T>) -> TerminalResult<Vec<T>> {
        MultiSelectPrompt::new(message, items).interact()
    }

    /// Prompt for editor input
    pub fn editor(message: &str) -> TerminalResult<String> {
        EditorPrompt::new(message).interact()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_input_prompt_builder() {
        let prompt = InputPrompt::new("Enter name")
            .with_default("John")
            .with_theme(PromptTheme::Simple);

        assert_eq!(prompt.message, "Enter name");
        assert_eq!(prompt.default, Some("John".to_string()));
    }

    #[test]
    fn test_password_prompt_builder() {
        let prompt = PasswordPrompt::new("Enter password").with_confirmation();

        assert_eq!(prompt.message, "Enter password");
        assert!(prompt.confirmation);
    }

    #[test]
    fn test_confirm_prompt_builder() {
        let prompt = ConfirmPrompt::new("Continue?").with_default(true);

        assert_eq!(prompt.message, "Continue?");
        assert_eq!(prompt.default, Some(true));
    }

    #[test]
    fn test_select_prompt_builder() {
        let items = vec!["Option 1", "Option 2", "Option 3"];
        let prompt = SelectPrompt::new("Select option", items)
            .with_default(1)
            .with_page_size(10);

        assert_eq!(prompt.message, "Select option");
        assert_eq!(prompt.default, Some(1));
        assert_eq!(prompt.page_size, Some(10));
    }

    #[test]
    fn test_multi_select_prompt_builder() {
        let items = vec!["Item 1", "Item 2", "Item 3"];
        let prompt = MultiSelectPrompt::new("Select items", items)
            .with_defaults(vec![true, false, true])
            .with_page_size(5);

        assert_eq!(prompt.message, "Select items");
        assert_eq!(prompt.defaults, vec![true, false, true]);
        assert_eq!(prompt.page_size, Some(5));
    }

    #[test]
    fn test_editor_prompt_builder() {
        let prompt = EditorPrompt::new("Edit content")
            .with_default("Initial content")
            .with_extension("md");

        assert_eq!(prompt.message, "Edit content");
        assert_eq!(prompt.default, Some("Initial content".to_string()));
        assert_eq!(prompt.extension, Some("md"));
    }
}
