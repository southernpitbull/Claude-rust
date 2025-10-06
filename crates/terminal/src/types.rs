/// Terminal Interface Types
///
/// Type definitions for the terminal interface module.

use serde::{Deserialize, Serialize};

/// Terminal theme options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TerminalTheme {
    Dark,
    Light,
    System,
}

impl Default for TerminalTheme {
    fn default() -> Self {
        Self::System
    }
}

/// Color support levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ColorLevel {
    /// No color support
    None = 0,
    /// 16 basic colors
    Basic = 1,
    /// 256 colors
    Ansi256 = 2,
    /// 16 million colors (RGB)
    TrueColor = 3,
}

impl ColorLevel {
    /// Detect color support level from environment
    pub fn detect() -> Self {
        // Check NO_COLOR environment variable
        if std::env::var("NO_COLOR").is_ok() {
            return Self::None;
        }

        // Check COLORTERM for true color support
        if let Ok(colorterm) = std::env::var("COLORTERM") {
            if colorterm == "truecolor" || colorterm == "24bit" {
                return Self::TrueColor;
            }
        }

        // Check TERM environment variable
        if let Ok(term) = std::env::var("TERM") {
            if term.contains("256color") {
                return Self::Ansi256;
            } else if term == "dumb" {
                return Self::None;
            } else if !term.is_empty() {
                return Self::Basic;
            }
        }

        // Windows-specific detection
        #[cfg(target_os = "windows")]
        {
            // Windows 10+ supports ANSI colors
            if let Ok(version) = std::env::var("OS") {
                if version.contains("Windows") {
                    return Self::Ansi256;
                }
            }
        }

        // Default to basic colors if we can't detect
        Self::Basic
    }

    /// Check if colors are supported
    pub fn has_colors(&self) -> bool {
        !matches!(self, Self::None)
    }

    /// Check if 256 colors are supported
    pub fn has_256_colors(&self) -> bool {
        matches!(self, Self::Ansi256 | Self::TrueColor)
    }

    /// Check if true color (RGB) is supported
    pub fn has_true_color(&self) -> bool {
        matches!(self, Self::TrueColor)
    }
}

/// Terminal size
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TerminalSize {
    /// Terminal width in columns
    pub width: u16,
    /// Terminal height in rows
    pub height: u16,
}

impl Default for TerminalSize {
    fn default() -> Self {
        Self {
            width: 80,
            height: 24,
        }
    }
}

impl TerminalSize {
    /// Create a new terminal size
    pub fn new(width: u16, height: u16) -> Self {
        Self { width, height }
    }

    /// Get current terminal size
    pub fn current() -> Self {
        crossterm::terminal::size()
            .map(|(w, h)| Self::new(w, h))
            .unwrap_or_default()
    }

    /// Check if terminal is narrow (< 80 columns)
    pub fn is_narrow(&self) -> bool {
        self.width < 80
    }

    /// Check if terminal is very narrow (< 60 columns)
    pub fn is_very_narrow(&self) -> bool {
        self.width < 60
    }

    /// Check if terminal is wide (>= 120 columns)
    pub fn is_wide(&self) -> bool {
        self.width >= 120
    }
}

/// Terminal capabilities
#[derive(Debug, Clone)]
pub struct TerminalCapabilities {
    /// Whether the terminal is interactive (has TTY)
    pub is_interactive: bool,
    /// Color support level
    pub color_level: ColorLevel,
    /// Whether hyperlinks are supported
    pub supports_hyperlinks: bool,
    /// Whether Unicode is supported
    pub supports_unicode: bool,
    /// Current terminal size
    pub size: TerminalSize,
}

impl Default for TerminalCapabilities {
    fn default() -> Self {
        Self::detect()
    }
}

impl TerminalCapabilities {
    /// Detect terminal capabilities
    pub fn detect() -> Self {
        use std::io::IsTerminal;

        let is_interactive = std::io::stdout().is_terminal();
        let color_level = ColorLevel::detect();
        let size = TerminalSize::current();

        // Check for hyperlink support (OSC 8)
        let supports_hyperlinks = is_interactive
            && std::env::var("TERM_PROGRAM")
                .map(|t| {
                    t == "iTerm.app"
                        || t == "vscode"
                        || t == "WezTerm"
                        || t == "Hyper"
                })
                .unwrap_or(false);

        // Check for Unicode support
        let supports_unicode = std::env::var("LANG")
            .or_else(|_| std::env::var("LC_ALL"))
            .map(|lang| lang.to_lowercase().contains("utf"))
            .unwrap_or(true); // Default to true on modern systems

        Self {
            is_interactive,
            color_level,
            supports_hyperlinks,
            supports_unicode,
            size,
        }
    }

    /// Create capabilities for testing (no TTY, no colors)
    pub fn for_testing() -> Self {
        Self {
            is_interactive: false,
            color_level: ColorLevel::None,
            supports_hyperlinks: false,
            supports_unicode: true,
            size: TerminalSize::default(),
        }
    }
}

/// Terminal configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
    /// Terminal color theme
    pub theme: TerminalTheme,
    /// Whether to use colors in output
    pub use_colors: bool,
    /// Whether to show progress indicators
    pub show_progress_indicators: bool,
    /// Whether to enable syntax highlighting for code
    pub code_highlighting: bool,
    /// Maximum terminal height (rows)
    pub max_height: Option<u16>,
    /// Maximum terminal width (columns)
    pub max_width: Option<u16>,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        let capabilities = TerminalCapabilities::detect();

        Self {
            theme: TerminalTheme::System,
            use_colors: capabilities.color_level.has_colors(),
            show_progress_indicators: capabilities.is_interactive,
            code_highlighting: true,
            max_height: None,
            max_width: None,
        }
    }
}

impl TerminalConfig {
    /// Create a new terminal configuration
    pub fn new() -> Self {
        Self::default()
    }

    /// Disable colors
    pub fn no_colors(mut self) -> Self {
        self.use_colors = false;
        self
    }

    /// Disable progress indicators
    pub fn no_progress(mut self) -> Self {
        self.show_progress_indicators = false;
        self
    }

    /// Disable syntax highlighting
    pub fn no_highlighting(mut self) -> Self {
        self.code_highlighting = false;
        self
    }

    /// Set theme
    pub fn with_theme(mut self, theme: TerminalTheme) -> Self {
        self.theme = theme;
        self
    }

    /// Set max width
    pub fn with_max_width(mut self, width: u16) -> Self {
        self.max_width = Some(width);
        self
    }

    /// Set max height
    pub fn with_max_height(mut self, height: u16) -> Self {
        self.max_height = Some(height);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_color_level_ordering() {
        assert!(ColorLevel::None < ColorLevel::Basic);
        assert!(ColorLevel::Basic < ColorLevel::Ansi256);
        assert!(ColorLevel::Ansi256 < ColorLevel::TrueColor);
    }

    #[test]
    fn test_color_level_has_colors() {
        assert!(!ColorLevel::None.has_colors());
        assert!(ColorLevel::Basic.has_colors());
        assert!(ColorLevel::Ansi256.has_colors());
        assert!(ColorLevel::TrueColor.has_colors());
    }

    #[test]
    fn test_terminal_size_predicates() {
        let narrow = TerminalSize::new(60, 24);
        assert!(narrow.is_narrow());
        assert!(!narrow.is_wide());

        let wide = TerminalSize::new(120, 40);
        assert!(!wide.is_narrow());
        assert!(wide.is_wide());

        let very_narrow = TerminalSize::new(50, 24);
        assert!(very_narrow.is_very_narrow());
    }

    #[test]
    fn test_terminal_config_builder() {
        let config = TerminalConfig::new()
            .no_colors()
            .with_theme(TerminalTheme::Dark)
            .with_max_width(100);

        assert!(!config.use_colors);
        assert_eq!(config.theme, TerminalTheme::Dark);
        assert_eq!(config.max_width, Some(100));
    }

    #[test]
    fn test_capabilities_for_testing() {
        let caps = TerminalCapabilities::for_testing();
        assert!(!caps.is_interactive);
        assert_eq!(caps.color_level, ColorLevel::None);
        assert!(!caps.supports_hyperlinks);
    }
}
