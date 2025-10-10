/// Terminal Spinner and Progress Bars
///
/// Provides functions for creating and managing spinners and progress bars.

use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::time::Duration;

/// Terminal spinner for showing progress
pub struct Spinner {
    progress: ProgressBar,
}

impl Spinner {
    /// Create a new spinner with a message
    pub fn new(message: &str) -> Self {
        let progress = ProgressBar::new_spinner();
        progress.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap(),
        );
        progress.set_message(message.to_string());
        progress.enable_steady_tick(Duration::from_millis(100));

        Self { progress }
    }

    /// Create a new spinner with custom tick interval
    pub fn with_tick_interval(message: &str, tick_ms: u64) -> Self {
        let progress = ProgressBar::new_spinner();
        progress.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap(),
        );
        progress.set_message(message.to_string());
        progress.enable_steady_tick(Duration::from_millis(tick_ms));

        Self { progress }
    }

    /// Create a new spinner with custom style
    pub fn with_style(message: &str, style: SpinnerStyle) -> Self {
        let progress = ProgressBar::new_spinner();
        progress.set_style(style.to_progress_style());
        progress.set_message(message.to_string());
        progress.enable_steady_tick(Duration::from_millis(100));

        Self { progress }
    }

    /// Set the spinner message
    pub fn set_message(&self, message: &str) {
        self.progress.set_message(message.to_string());
    }

    /// Update the spinner message
    pub fn update(&self, message: &str) {
        self.set_message(message);
    }

    /// Finish the spinner with a message
    pub fn finish(&self, message: &str) {
        self.progress.finish_with_message(message.to_string());
    }

    /// Finish the spinner and clear it
    pub fn finish_and_clear(&self) {
        self.progress.finish_and_clear();
    }

    /// Finish the spinner with success message
    pub fn finish_success(&self, message: &str) {
        self.progress.set_style(
            ProgressStyle::default_spinner()
                .template("{prefix:.bold.green} {msg}")
                .unwrap(),
        );
        self.progress.set_prefix("✓");
        self.progress.finish_with_message(message.to_string());
    }

    /// Finish the spinner with error message
    pub fn finish_error(&self, message: &str) {
        self.progress.set_style(
            ProgressStyle::default_spinner()
                .template("{prefix:.bold.red} {msg}")
                .unwrap(),
        );
        self.progress.set_prefix("✗");
        self.progress.finish_with_message(message.to_string());
    }

    /// Finish the spinner with warning message
    pub fn finish_warning(&self, message: &str) {
        self.progress.set_style(
            ProgressStyle::default_spinner()
                .template("{prefix:.bold.yellow} {msg}")
                .unwrap(),
        );
        self.progress.set_prefix("⚠");
        self.progress.finish_with_message(message.to_string());
    }
}

/// Spinner style options
#[derive(Debug, Clone, Copy)]
pub enum SpinnerStyle {
    /// Default dots spinner
    Dots,
    /// Line spinner
    Line,
    /// Circle spinner
    Circle,
    /// Arrow spinner
    Arrow,
}

impl SpinnerStyle {
    /// Convert to indicatif ProgressStyle
    fn to_progress_style(&self) -> ProgressStyle {
        match self {
            Self::Dots => ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap()
                .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
            Self::Line => ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap()
                .tick_strings(&["-", "\\", "|", "/"]),
            Self::Circle => ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap()
                .tick_strings(&["◐", "◓", "◑", "◒"]),
            Self::Arrow => ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap()
                .tick_strings(&["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"]),
        }
    }
}

/// Progress bar for showing task progress
pub struct ProgressBarWrapper {
    progress: ProgressBar,
}

impl ProgressBarWrapper {
    /// Create a new progress bar
    pub fn new(total: u64) -> Self {
        let progress = ProgressBar::new(total);
        progress.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("█▓▒░ "),
        );

        Self { progress }
    }

    /// Create a new progress bar with custom style
    pub fn with_style(total: u64, template: &str) -> Self {
        let progress = ProgressBar::new(total);
        progress.set_style(
            ProgressStyle::default_bar()
                .template(template)
                .unwrap()
                .progress_chars("█▓▒░ "),
        );

        Self { progress }
    }

    /// Set the progress bar message
    pub fn set_message(&self, message: &str) {
        self.progress.set_message(message.to_string());
    }

    /// Set the progress bar position
    pub fn set_position(&self, pos: u64) {
        self.progress.set_position(pos);
    }

    /// Increment the progress bar
    pub fn inc(&self, delta: u64) {
        self.progress.inc(delta);
    }

    /// Finish the progress bar
    pub fn finish(&self) {
        self.progress.finish();
    }

    /// Finish the progress bar with a message
    pub fn finish_with_message(&self, message: &str) {
        self.progress.finish_with_message(message.to_string());
    }

    /// Finish the progress bar and clear it
    pub fn finish_and_clear(&self) {
        self.progress.finish_and_clear();
    }
}

/// Multi-progress manager for handling multiple progress bars
pub struct MultiProgressManager {
    multi: MultiProgress,
}

impl MultiProgressManager {
    /// Create a new multi-progress manager
    pub fn new() -> Self {
        Self {
            multi: MultiProgress::new(),
        }
    }

    /// Add a spinner to the multi-progress
    pub fn add_spinner(&self, message: &str) -> Spinner {
        let progress = self.multi.add(ProgressBar::new_spinner());
        progress.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap(),
        );
        progress.set_message(message.to_string());
        progress.enable_steady_tick(Duration::from_millis(100));

        Spinner { progress }
    }

    /// Add a progress bar to the multi-progress
    pub fn add_progress_bar(&self, total: u64) -> ProgressBarWrapper {
        let progress = self.multi.add(ProgressBar::new(total));
        progress.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("█▓▒░ "),
        );

        ProgressBarWrapper { progress }
    }

    /// Clear all progress indicators
    pub fn clear(&self) {
        self.multi.clear().ok();
    }
}

impl Default for MultiProgressManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spinner_creation() {
        let spinner = Spinner::new("Loading...");
        spinner.set_message("Updated message");
        spinner.finish_and_clear();
    }

    #[test]
    fn test_spinner_with_tick_interval() {
        let spinner = Spinner::with_tick_interval("Processing...", 50);
        spinner.finish("Done!");
    }

    #[test]
    fn test_spinner_styles() {
        let spinner = Spinner::with_style("Working...", SpinnerStyle::Dots);
        spinner.finish_success("Success!");

        let spinner = Spinner::with_style("Working...", SpinnerStyle::Line);
        spinner.finish_error("Failed!");

        let spinner = Spinner::with_style("Working...", SpinnerStyle::Circle);
        spinner.finish_warning("Warning!");
    }

    #[test]
    fn test_progress_bar() {
        let progress = ProgressBarWrapper::new(100);
        progress.set_message("Downloading...");
        progress.set_position(50);
        progress.inc(25);
        progress.finish_with_message("Complete!");
    }

    #[test]
    fn test_multi_progress() {
        let multi = MultiProgressManager::new();
        let spinner1 = multi.add_spinner("Task 1");
        let spinner2 = multi.add_spinner("Task 2");
        let progress = multi.add_progress_bar(100);

        spinner1.finish("Task 1 done");
        spinner2.finish("Task 2 done");
        progress.finish();
        multi.clear();
    }

    #[test]
    fn test_spinner_finish_variants() {
        let spinner = Spinner::new("Test");
        spinner.finish_success("Success");

        let spinner = Spinner::new("Test");
        spinner.finish_error("Error");

        let spinner = Spinner::new("Test");
        spinner.finish_warning("Warning");
    }
}
