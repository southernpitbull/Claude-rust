//! Text Formatting Utilities
//!
//! Provides comprehensive text formatting, truncation, pluralization, and case conversion
//! utilities for displaying information in the terminal.
//!
//! # Features
//!
//! - Text truncation with ellipsis
//! - Pluralization helpers
//! - Duration formatting (human-readable)
//! - File size formatting (bytes to KB/MB/GB)
//! - Number formatting with commas
//! - Case conversion (snake_case, camelCase, PascalCase)
//! - ANSI stripping
//! - Text wrapping
//!
//! # Examples
//!
//! ```rust
//! use claude_code_utils::formatting::*;
//!
//! // Truncate long text
//! let truncated = truncate("This is a very long string", 10, "...");
//! assert_eq!(truncated, "This is...");
//!
//! // Format file sizes
//! let size = format_file_size(1024 * 1024 * 5); // 5 MB
//! assert_eq!(size, "5.00 MB");
//!
//! // Format durations
//! let duration = format_duration(std::time::Duration::from_secs(3665));
//! assert_eq!(duration, "1h 1m 5s");
//! ```

use regex::Regex;
use std::time::Duration;

/// Truncate a string to a maximum length with suffix
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::truncate;
///
/// assert_eq!(truncate("Hello, World!", 5, "..."), "He...");
/// assert_eq!(truncate("Short", 10, "..."), "Short");
/// ```
pub fn truncate(text: &str, max_length: usize, suffix: &str) -> String {
    if text.len() <= max_length {
        return text.to_string();
    }

    let truncate_at = max_length.saturating_sub(suffix.len());
    format!("{}{}", &text[..truncate_at], suffix)
}

/// Format a number with comma separators for thousands
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::format_number;
///
/// assert_eq!(format_number(1000), "1,000");
/// assert_eq!(format_number(1234567), "1,234,567");
/// ```
pub fn format_number(num: u64) -> String {
    let num_str = num.to_string();
    let mut result = String::new();
    let mut count = 0;

    for c in num_str.chars().rev() {
        if count > 0 && count % 3 == 0 {
            result.push(',');
        }
        result.push(c);
        count += 1;
    }

    result.chars().rev().collect()
}

/// Format a file size in bytes to human-readable string
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::format_file_size;
///
/// assert_eq!(format_file_size(0), "0 Bytes");
/// assert_eq!(format_file_size(1024), "1.00 KB");
/// assert_eq!(format_file_size(1024 * 1024), "1.00 MB");
/// assert_eq!(format_file_size(1024 * 1024 * 1024), "1.00 GB");
/// ```
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["Bytes", "KB", "MB", "GB", "TB", "PB"];

    if bytes == 0 {
        return "0 Bytes".to_string();
    }

    let bytes_f64 = bytes as f64;
    let i = (bytes_f64.log2() / 10.0).floor() as usize;
    let i = i.min(UNITS.len() - 1);

    let size = bytes_f64 / (1024_f64.powi(i as i32));

    format!("{:.2} {}", size, UNITS[i])
}

/// Format a duration to human-readable string
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::format_duration;
/// use std::time::Duration;
///
/// assert_eq!(format_duration(Duration::from_millis(500)), "500ms");
/// assert_eq!(format_duration(Duration::from_secs(5)), "5s");
/// assert_eq!(format_duration(Duration::from_secs(125)), "2m 5s");
/// assert_eq!(format_duration(Duration::from_secs(3665)), "1h 1m 5s");
/// ```
pub fn format_duration(duration: Duration) -> String {
    let total_secs = duration.as_secs();
    let millis = duration.as_millis();

    if millis < 1000 {
        return format!("{}ms", millis);
    }

    if total_secs < 60 {
        return format!("{}s", total_secs);
    }

    let minutes = total_secs / 60;
    let seconds = total_secs % 60;

    if minutes < 60 {
        return format!("{}m {}s", minutes, seconds);
    }

    let hours = minutes / 60;
    let remaining_minutes = minutes % 60;

    if hours < 24 {
        return format!("{}h {}m {}s", hours, remaining_minutes, seconds);
    }

    let days = hours / 24;
    let remaining_hours = hours % 24;

    format!("{}d {}h {}m", days, remaining_hours, remaining_minutes)
}

/// Pluralize a word based on count
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::pluralize;
///
/// assert_eq!(pluralize(1, "file", "files"), "1 file");
/// assert_eq!(pluralize(5, "file", "files"), "5 files");
/// assert_eq!(pluralize(0, "item", "items"), "0 items");
/// ```
pub fn pluralize(count: usize, singular: &str, plural: &str) -> String {
    if count == 1 {
        format!("{} {}", count, singular)
    } else {
        format!("{} {}", count, plural)
    }
}

/// Simple pluralization using 's' suffix
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::pluralize_simple;
///
/// assert_eq!(pluralize_simple(1, "error"), "1 error");
/// assert_eq!(pluralize_simple(3, "error"), "3 errors");
/// ```
pub fn pluralize_simple(count: usize, word: &str) -> String {
    pluralize(count, word, &format!("{}s", word))
}

/// Strip ANSI escape codes from a string
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::strip_ansi;
///
/// let colored = "\x1b[31mRed Text\x1b[0m";
/// assert_eq!(strip_ansi(colored), "Red Text");
/// ```
pub fn strip_ansi(text: &str) -> String {
    // ANSI escape code regex pattern
    let re = Regex::new(r"\x1b\[[0-9;]*[mGKHf]").unwrap();
    re.replace_all(text, "").to_string()
}

/// Indent text with specified number of spaces
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::indent;
///
/// let text = "Line 1\nLine 2";
/// let indented = indent(text, 2);
/// assert_eq!(indented, "  Line 1\n  Line 2");
/// ```
pub fn indent(text: &str, spaces: usize) -> String {
    let indentation = " ".repeat(spaces);
    text.lines()
        .map(|line| format!("{}{}", indentation, line))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Pad a string to a fixed width
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::pad_string;
///
/// assert_eq!(pad_string("test", 8, ' ', true), "test    ");
/// assert_eq!(pad_string("test", 8, ' ', false), "    test");
/// ```
pub fn pad_string(text: &str, width: usize, pad_char: char, pad_right: bool) -> String {
    if text.len() >= width {
        return text.to_string();
    }

    let padding = pad_char.to_string().repeat(width - text.len());

    if pad_right {
        format!("{}{}", text, padding)
    } else {
        format!("{}{}", padding, text)
    }
}

/// Center a string within a fixed width
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::center_string;
///
/// assert_eq!(center_string("Hi", 6, ' '), "  Hi  ");
/// assert_eq!(center_string("Test", 8, '-'), "--Test--");
/// ```
pub fn center_string(text: &str, width: usize, pad_char: char) -> String {
    if text.len() >= width {
        return text.to_string();
    }

    let total_padding = width - text.len();
    let left_padding = total_padding / 2;
    let right_padding = total_padding - left_padding;

    format!(
        "{}{}{}",
        pad_char.to_string().repeat(left_padding),
        text,
        pad_char.to_string().repeat(right_padding)
    )
}

/// Wrap text to a specified width
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::wrap_text;
///
/// let text = "This is a very long line that needs to be wrapped";
/// let wrapped = wrap_text(text, 20);
/// // Result will have line breaks at appropriate positions
/// ```
pub fn wrap_text(text: &str, width: usize) -> String {
    let mut result = Vec::new();

    for line in text.lines() {
        if line.len() <= width {
            result.push(line.to_string());
            continue;
        }

        let mut current_line = String::new();
        for word in line.split_whitespace() {
            if current_line.is_empty() {
                if word.len() > width {
                    // Word is longer than width, split it
                    for chunk in word.as_bytes().chunks(width) {
                        result.push(String::from_utf8_lossy(chunk).to_string());
                    }
                } else {
                    current_line = word.to_string();
                }
            } else if current_line.len() + 1 + word.len() <= width {
                current_line.push(' ');
                current_line.push_str(word);
            } else {
                result.push(current_line);
                if word.len() > width {
                    // Word is longer than width, split it
                    for chunk in word.as_bytes().chunks(width) {
                        result.push(String::from_utf8_lossy(chunk).to_string());
                    }
                    current_line = String::new();
                } else {
                    current_line = word.to_string();
                }
            }
        }

        if !current_line.is_empty() {
            result.push(current_line);
        }
    }

    result.join("\n")
}

/// Convert snake_case to camelCase
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::snake_to_camel;
///
/// assert_eq!(snake_to_camel("hello_world"), "helloWorld");
/// assert_eq!(snake_to_camel("foo_bar_baz"), "fooBarBaz");
/// ```
pub fn snake_to_camel(text: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;

    for ch in text.chars() {
        if ch == '_' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(ch.to_ascii_uppercase());
            capitalize_next = false;
        } else {
            result.push(ch);
        }
    }

    result
}

/// Convert snake_case to PascalCase
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::snake_to_pascal;
///
/// assert_eq!(snake_to_pascal("hello_world"), "HelloWorld");
/// assert_eq!(snake_to_pascal("foo_bar"), "FooBar");
/// ```
pub fn snake_to_pascal(text: &str) -> String {
    text.split('_')
        .filter(|s| !s.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    first.to_uppercase().collect::<String>() + chars.as_str()
                }
            }
        })
        .collect()
}

/// Convert camelCase to snake_case
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::camel_to_snake;
///
/// assert_eq!(camel_to_snake("helloWorld"), "hello_world");
/// assert_eq!(camel_to_snake("fooBarBaz"), "foo_bar_baz");
/// ```
pub fn camel_to_snake(text: &str) -> String {
    let mut result = String::new();

    for (i, ch) in text.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('_');
            result.push(ch.to_ascii_lowercase());
        } else {
            result.push(ch);
        }
    }

    result
}

/// Convert PascalCase to snake_case
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::pascal_to_snake;
///
/// assert_eq!(pascal_to_snake("HelloWorld"), "hello_world");
/// assert_eq!(pascal_to_snake("FooBar"), "foo_bar");
/// ```
pub fn pascal_to_snake(text: &str) -> String {
    camel_to_snake(text).to_lowercase()
}

/// Format a percentage value
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::format_percentage;
///
/// assert_eq!(format_percentage(0.5), "50.00%");
/// assert_eq!(format_percentage(0.333), "33.30%");
/// ```
pub fn format_percentage(value: f64) -> String {
    format!("{:.2}%", value * 100.0)
}

/// Create a simple progress bar
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::formatting::progress_bar;
///
/// let bar = progress_bar(50, 100, 20, '=', '-');
/// // Creates: [==========----------] 50%
/// ```
pub fn progress_bar(
    current: usize,
    total: usize,
    width: usize,
    filled_char: char,
    empty_char: char,
) -> String {
    if total == 0 {
        return format!("[{}] 0%", empty_char.to_string().repeat(width));
    }

    let percentage = (current as f64 / total as f64) * 100.0;
    let filled = ((current as f64 / total as f64) * width as f64).round() as usize;
    let empty = width.saturating_sub(filled);

    format!(
        "[{}{}] {:.0}%",
        filled_char.to_string().repeat(filled),
        empty_char.to_string().repeat(empty),
        percentage
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate() {
        assert_eq!(truncate("Hello, World!", 5, "..."), "He...");
        assert_eq!(truncate("Short", 10, "..."), "Short");
        assert_eq!(truncate("", 5, "..."), "");
    }

    #[test]
    fn test_format_number() {
        assert_eq!(format_number(0), "0");
        assert_eq!(format_number(1000), "1,000");
        assert_eq!(format_number(1234567), "1,234,567");
        assert_eq!(format_number(999), "999");
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(0), "0 Bytes");
        assert_eq!(format_file_size(1024), "1.00 KB");
        assert_eq!(format_file_size(1024 * 1024), "1.00 MB");
        assert_eq!(format_file_size(1024 * 1024 * 1024), "1.00 GB");
        assert_eq!(format_file_size(1536), "1.50 KB");
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(Duration::from_millis(500)), "500ms");
        assert_eq!(format_duration(Duration::from_secs(5)), "5s");
        assert_eq!(format_duration(Duration::from_secs(65)), "1m 5s");
        assert_eq!(format_duration(Duration::from_secs(3665)), "1h 1m 5s");
        assert_eq!(format_duration(Duration::from_secs(90000)), "1d 1h 0m");
    }

    #[test]
    fn test_pluralize() {
        assert_eq!(pluralize(1, "file", "files"), "1 file");
        assert_eq!(pluralize(5, "file", "files"), "5 files");
        assert_eq!(pluralize(0, "item", "items"), "0 items");
    }

    #[test]
    fn test_pluralize_simple() {
        assert_eq!(pluralize_simple(1, "error"), "1 error");
        assert_eq!(pluralize_simple(3, "error"), "3 errors");
    }

    #[test]
    fn test_strip_ansi() {
        let colored = "\x1b[31mRed Text\x1b[0m";
        assert_eq!(strip_ansi(colored), "Red Text");
        assert_eq!(strip_ansi("Plain text"), "Plain text");
    }

    #[test]
    fn test_indent() {
        let text = "Line 1\nLine 2";
        assert_eq!(indent(text, 2), "  Line 1\n  Line 2");
        assert_eq!(indent("Single", 4), "    Single");
    }

    #[test]
    fn test_pad_string() {
        assert_eq!(pad_string("test", 8, ' ', true), "test    ");
        assert_eq!(pad_string("test", 8, ' ', false), "    test");
        assert_eq!(pad_string("toolong", 4, ' ', true), "toolong");
    }

    #[test]
    fn test_center_string() {
        assert_eq!(center_string("Hi", 6, ' '), "  Hi  ");
        assert_eq!(center_string("Test", 8, '-'), "--Test--");
    }

    #[test]
    fn test_snake_to_camel() {
        assert_eq!(snake_to_camel("hello_world"), "helloWorld");
        assert_eq!(snake_to_camel("foo_bar_baz"), "fooBarBaz");
        assert_eq!(snake_to_camel("single"), "single");
    }

    #[test]
    fn test_snake_to_pascal() {
        assert_eq!(snake_to_pascal("hello_world"), "HelloWorld");
        assert_eq!(snake_to_pascal("foo_bar"), "FooBar");
    }

    #[test]
    fn test_camel_to_snake() {
        assert_eq!(camel_to_snake("helloWorld"), "hello_world");
        assert_eq!(camel_to_snake("fooBarBaz"), "foo_bar_baz");
        assert_eq!(camel_to_snake("HelloWorld"), "hello_world");
    }

    #[test]
    fn test_format_percentage() {
        assert_eq!(format_percentage(0.5), "50.00%");
        assert_eq!(format_percentage(0.333), "33.30%");
        assert_eq!(format_percentage(1.0), "100.00%");
    }

    #[test]
    fn test_progress_bar() {
        let bar = progress_bar(50, 100, 10, '=', '-');
        assert!(bar.contains("50%"));
        assert!(bar.contains('['));
        assert!(bar.contains(']'));
    }

    #[test]
    fn test_wrap_text() {
        let text = "This is a test";
        let wrapped = wrap_text(text, 10);
        assert!(wrapped.contains('\n') || wrapped.len() <= 10);
    }
}
