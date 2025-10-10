/// Terminal Formatting Utilities
///
/// Provides functions for formatting and displaying text in the terminal.

use colored::{Color, Colorize};
use crossterm::style::Attribute;
use regex::Regex;

/// Text formatting style
#[derive(Debug, Clone, Copy)]
pub enum Style {
    Bold,
    Dim,
    Italic,
    Underline,
    Reset,
}

impl Style {
    /// Convert to crossterm Attribute
    pub fn to_attribute(self) -> Attribute {
        match self {
            Style::Bold => Attribute::Bold,
            Style::Dim => Attribute::Dim,
            Style::Italic => Attribute::Italic,
            Style::Underline => Attribute::Underlined,
            Style::Reset => Attribute::Reset,
        }
    }

    /// Apply style to text (returns ANSI codes)
    pub fn apply(&self, text: &str) -> String {
        match self {
            Style::Bold => text.bold().to_string(),
            Style::Dim => text.dimmed().to_string(),
            Style::Italic => text.italic().to_string(),
            Style::Underline => text.underline().to_string(),
            Style::Reset => text.to_string(),
        }
    }
}

/// Options for formatting output
#[derive(Debug, Clone)]
pub struct FormatOptions {
    /// Terminal width in columns
    pub width: Option<u16>,
    /// Whether to use colors
    pub colors: bool,
    /// Whether to highlight code
    pub code_highlighting: bool,
}

impl Default for FormatOptions {
    fn default() -> Self {
        Self {
            width: None,
            colors: true,
            code_highlighting: true,
        }
    }
}

impl FormatOptions {
    /// Create new format options
    pub fn new() -> Self {
        Self::default()
    }

    /// Set width
    pub fn with_width(mut self, width: u16) -> Self {
        self.width = Some(width);
        self
    }

    /// Disable colors
    pub fn no_colors(mut self) -> Self {
        self.colors = false;
        self
    }

    /// Disable code highlighting
    pub fn no_highlighting(mut self) -> Self {
        self.code_highlighting = false;
        self
    }
}

/// Terminal formatter
pub struct Formatter {
    colors_enabled: bool,
}

impl Formatter {
    /// Create a new formatter
    pub fn new(colors_enabled: bool) -> Self {
        Self { colors_enabled }
    }

    /// Format text with color
    pub fn color(&self, text: &str, color: Color) -> String {
        if self.colors_enabled {
            text.color(color).to_string()
        } else {
            text.to_string()
        }
    }

    /// Format text with RGB color
    pub fn rgb(&self, text: &str, r: u8, g: u8, b: u8) -> String {
        if self.colors_enabled {
            text.truecolor(r, g, b).to_string()
        } else {
            text.to_string()
        }
    }

    /// Format text with background color
    pub fn bg_color(&self, text: &str, color: Color) -> String {
        if self.colors_enabled {
            text.on_color(color).to_string()
        } else {
            text.to_string()
        }
    }

    /// Format text with style
    pub fn style(&self, text: &str, style: Style) -> String {
        if self.colors_enabled {
            style.apply(text)
        } else {
            text.to_string()
        }
    }

    /// Format success message with checkmark
    pub fn success(&self, text: &str) -> String {
        if self.colors_enabled {
            format!("{} {}", "✓".green(), text.green())
        } else {
            format!("SUCCESS: {}", text)
        }
    }

    /// Format error message with X
    pub fn error(&self, text: &str) -> String {
        if self.colors_enabled {
            format!("{} {}", "✗".red(), text.red())
        } else {
            format!("ERROR: {}", text)
        }
    }

    /// Format warning message with warning sign
    pub fn warning(&self, text: &str) -> String {
        if self.colors_enabled {
            format!("{} {}", "⚠".yellow(), text.yellow())
        } else {
            format!("WARNING: {}", text)
        }
    }

    /// Format info message with info icon
    pub fn info(&self, text: &str) -> String {
        if self.colors_enabled {
            format!("{} {}", "ℹ".blue(), text.blue())
        } else {
            format!("INFO: {}", text)
        }
    }

    /// Format emphasized text
    pub fn emphasize(&self, text: &str) -> String {
        if self.colors_enabled {
            text.cyan().bold().to_string()
        } else {
            text.to_uppercase()
        }
    }

    /// Format output with markdown-like syntax
    pub fn format_output(&self, text: &str, options: &FormatOptions) -> String {
        if !self.colors_enabled {
            return self.strip_ansi(text);
        }

        let mut text = text.to_string();

        // Format code blocks with syntax highlighting
        if options.code_highlighting {
            text = self.format_code_blocks(&text);
        }

        // Format inline code
        text = self.format_inline_code(&text);

        // Format bold text (**text**)
        text = self.format_bold(&text);

        // Format italic text (*text*)
        text = self.format_italic(&text);

        // Format lists
        text = self.format_lists(&text);

        // Format headers
        text = self.format_headers(&text);

        // Word wrap if width is specified
        if let Some(width) = options.width {
            text = word_wrap(&text, width as usize);
        }

        text
    }

    /// Format code blocks with syntax highlighting
    fn format_code_blocks(&self, text: &str) -> String {
        let re = Regex::new(r"```(\w+)?\n([\s\S]+?)```").unwrap();

        re.replace_all(text, |caps: &regex::Captures| {
            let language = caps.get(1).map(|m| m.as_str());
            let code = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            let highlighted = if let Some(lang) = language {
                self.highlight_syntax(code, lang)
            } else {
                code.to_string()
            };

            self.format_code_block_border(&highlighted, language)
        })
        .to_string()
    }

    /// Format a code block with borders
    fn format_code_block_border(&self, code: &str, language: Option<&str>) -> String {
        let lines: Vec<&str> = code.lines().collect();
        let max_len = lines.iter().map(|l| l.len()).max().unwrap_or(0);

        let border = "┃".dimmed();
        let top = format!("┏{}┓", "━".repeat(max_len + 2)).dimmed();
        let bottom = format!("┗{}┛", "━".repeat(max_len + 2)).dimmed();

        let mut result = vec![top.to_string()];

        // Add language indicator if present
        if let Some(lang) = language {
            result.push(format!("{} {}", border, lang.bold().blue()));
        }

        // Add code lines
        for line in lines {
            result.push(format!("{} {}", border, line));
        }

        result.push(bottom.to_string());
        result.join("\n")
    }

    /// Simple syntax highlighting for code
    fn highlight_syntax(&self, code: &str, language: &str) -> String {
        // Basic keyword highlighting based on language
        let keywords = match language.to_lowercase().as_str() {
            "rust" => vec![
                "fn", "let", "mut", "const", "static", "if", "else", "match", "for", "while",
                "loop", "return", "break", "continue", "impl", "trait", "struct", "enum", "pub",
                "use", "mod", "async", "await", "type", "where", "unsafe",
            ],
            "typescript" | "javascript" | "js" | "ts" => vec![
                "function", "const", "let", "var", "if", "else", "for", "while", "return",
                "import", "export", "class", "interface", "extends", "implements", "public",
                "private", "protected", "static", "async", "await", "type", "enum",
            ],
            "python" | "py" => vec![
                "def", "class", "if", "elif", "else", "for", "while", "return", "import", "from",
                "as", "with", "try", "except", "finally", "raise", "pass", "break", "continue",
                "lambda", "yield", "async", "await",
            ],
            _ => vec![],
        };

        let mut result = code.to_string();

        // Highlight keywords
        for keyword in keywords {
            let pattern = format!(r"\b{}\b", regex::escape(keyword));
            let re = Regex::new(&pattern).unwrap();
            result = re
                .replace_all(&result, |_: &regex::Captures| keyword.blue().to_string())
                .to_string();
        }

        // Highlight strings
        let string_re = Regex::new(r#"["'][^"']*["']"#).unwrap();
        result = string_re
            .replace_all(&result, |caps: &regex::Captures| {
                caps[0].green().to_string()
            })
            .to_string();

        // Highlight numbers
        let number_re = Regex::new(r"\b\d+(\.\d+)?\b").unwrap();
        result = number_re
            .replace_all(&result, |caps: &regex::Captures| {
                caps[0].yellow().to_string()
            })
            .to_string();

        // Highlight comments
        let comment_re = Regex::new(r"//.*$|/\*[\s\S]*?\*/|#.*$").unwrap();
        result = comment_re
            .replace_all(&result, |caps: &regex::Captures| {
                caps[0].dimmed().to_string()
            })
            .to_string();

        result
    }

    /// Format inline code (`code`)
    fn format_inline_code(&self, text: &str) -> String {
        let re = Regex::new(r"`([^`]+)`").unwrap();
        re.replace_all(text, |caps: &regex::Captures| caps[1].cyan().to_string())
            .to_string()
    }

    /// Format bold text (**text**)
    fn format_bold(&self, text: &str) -> String {
        let re = Regex::new(r"\*\*([^*]+)\*\*").unwrap();
        re.replace_all(text, |caps: &regex::Captures| caps[1].bold().to_string())
            .to_string()
    }

    /// Format italic text (*text*)
    fn format_italic(&self, text: &str) -> String {
        let re = Regex::new(r"\*([^*]+)\*").unwrap();
        re.replace_all(text, |caps: &regex::Captures| caps[1].italic().to_string())
            .to_string()
    }

    /// Format lists
    fn format_lists(&self, text: &str) -> String {
        let re = Regex::new(r"^(\s*)-\s+(.+)$").unwrap();
        text.lines()
            .map(|line| {
                re.replace(line, |caps: &regex::Captures| {
                    format!("{}• {}", &caps[1], &caps[2])
                })
                .to_string()
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Format headers (# Header)
    fn format_headers(&self, text: &str) -> String {
        let re = Regex::new(r"^(#+)\s+(.+)$").unwrap();
        text.lines()
            .map(|line| {
                re.replace(line, |caps: &regex::Captures| {
                    let level = caps[1].len();
                    let header = &caps[2];

                    match level {
                        1 => header.bold().underline().blue().to_string(),
                        2 => header.bold().blue().to_string(),
                        _ => header.bold().to_string(),
                    }
                })
                .to_string()
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Strip ANSI escape codes from text
    pub fn strip_ansi(&self, text: &str) -> String {
        let re = Regex::new(r"\x1B\[[0-9;]*[a-zA-Z]").unwrap();
        re.replace_all(text, "").to_string()
    }

    /// Get terminal size
    pub fn terminal_size() -> (u16, u16) {
        crossterm::terminal::size().unwrap_or((80, 24))
    }

    /// Clear the terminal screen
    pub fn clear_screen() -> std::io::Result<()> {
        let mut stdout = std::io::stdout();
        crossterm::execute!(
            stdout,
            crossterm::terminal::Clear(crossterm::terminal::ClearType::All),
            crossterm::cursor::MoveTo(0, 0)
        )
    }
}

impl Default for Formatter {
    fn default() -> Self {
        Self::new(true)
    }
}

// Convenience print methods
impl Formatter {
    /// Print a success message
    pub fn print_success(&self, text: &str) {
        println!("{}", self.success(text));
    }

    /// Print an error message
    pub fn print_error(&self, text: &str) {
        eprintln!("{}", self.error(text));
    }

    /// Print a warning message
    pub fn print_warning(&self, text: &str) {
        println!("{}", self.warning(text));
    }

    /// Print an info message
    pub fn print_info(&self, text: &str) {
        println!("{}", self.info(text));
    }

    /// Print dimmed text
    pub fn print_dim(&self, text: &str) {
        println!("{}", self.style(text, Style::Dim));
    }

    /// Print a header (bold and underlined)
    pub fn print_header(&self, text: &str) {
        let formatted = if self.colors_enabled {
            text.bold().underline().to_string()
        } else {
            format!("=== {} ===", text)
        };
        println!("{}", formatted);
    }

    /// Style text as success (returns formatted string)
    pub fn style_success(&self, text: &str) -> String {
        if self.colors_enabled {
            text.green().to_string()
        } else {
            text.to_string()
        }
    }

    /// Style text as dimmed (returns formatted string)
    pub fn style_dim(&self, text: &str) -> String {
        if self.colors_enabled {
            text.dimmed().to_string()
        } else {
            text.to_string()
        }
    }
}

/// Word wrap text to the specified width
pub fn word_wrap(text: &str, width: usize) -> String {
    text.lines()
        .map(|line| {
            // If the line is a code block or already shorter, leave it as is
            if line.trim_start().starts_with('┃') || line.len() <= width {
                return line.to_string();
            }

            // Word wrap the line
            let words: Vec<&str> = line.split_whitespace().collect();
            let mut wrapped_lines = Vec::new();
            let mut current_line = String::new();

            for word in words {
                if current_line.len() + word.len() + 1 > width {
                    if !current_line.is_empty() {
                        wrapped_lines.push(current_line.clone());
                        current_line.clear();
                        current_line.push_str(word);
                    } else {
                        // Word itself is longer than width
                        wrapped_lines.push(word.to_string());
                    }
                } else if current_line.is_empty() {
                    current_line.push_str(word);
                } else {
                    current_line.push(' ');
                    current_line.push_str(word);
                }
            }

            if !current_line.is_empty() {
                wrapped_lines.push(current_line);
            }

            wrapped_lines.join("\n")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Create a hyperlink if supported
pub fn hyperlink(text: &str, url: &str, supports_hyperlinks: bool) -> String {
    if supports_hyperlinks {
        format!("\x1b]8;;{}\x1b\\{}\x1b]8;;\x1b\\", url, text)
    } else {
        format!("{} ({})", text, url)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi() {
        let formatter = Formatter::new(false);
        let text = "\x1b[31mRed text\x1b[0m";
        assert_eq!(formatter.strip_ansi(text), "Red text");
    }

    #[test]
    fn test_word_wrap() {
        let text = "This is a very long line that should be wrapped to multiple lines when the width is limited";
        let wrapped = word_wrap(text, 40);
        let lines: Vec<&str> = wrapped.lines().collect();
        assert!(lines.len() > 1);
        for line in lines {
            assert!(line.len() <= 40);
        }
    }

    #[test]
    fn test_format_inline_code() {
        let formatter = Formatter::new(true);
        let text = "This is `inline code` in text";
        let formatted = formatter.format_inline_code(text);
        assert!(formatted.contains("inline code"));
    }

    #[test]
    fn test_format_bold() {
        let formatter = Formatter::new(true);
        let text = "This is **bold text** in markdown";
        let formatted = formatter.format_bold(text);
        assert!(formatted.contains("bold text"));
    }

    #[test]
    fn test_hyperlink_without_support() {
        let link = hyperlink("Click here", "https://example.com", false);
        assert!(link.contains("Click here"));
        assert!(link.contains("https://example.com"));
    }

    #[test]
    fn test_formatter_no_colors() {
        let formatter = Formatter::new(false);
        let success = formatter.success("All good!");
        assert!(success.contains("SUCCESS"));
        assert!(!success.contains('\x1b'));
    }
}
