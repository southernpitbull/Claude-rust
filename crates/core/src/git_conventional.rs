//! Conventional Commits Support
//!
//! Implements conventional commit message generation and validation

use serde::{Deserialize, Serialize};
use std::fmt;

/// Conventional commit types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CommitType {
    /// New feature
    Feat,
    /// Bug fix
    Fix,
    /// Documentation changes
    Docs,
    /// Code style changes (formatting, etc.)
    Style,
    /// Code refactoring
    Refactor,
    /// Performance improvements
    Perf,
    /// Tests
    Test,
    /// Build system or dependencies
    Build,
    /// CI configuration
    Ci,
    /// Chores (maintenance, etc.)
    Chore,
    /// Revert previous commit
    Revert,
}

impl CommitType {
    /// Get all commit types
    pub fn all() -> Vec<CommitType> {
        vec![
            CommitType::Feat,
            CommitType::Fix,
            CommitType::Docs,
            CommitType::Style,
            CommitType::Refactor,
            CommitType::Perf,
            CommitType::Test,
            CommitType::Build,
            CommitType::Ci,
            CommitType::Chore,
            CommitType::Revert,
        ]
    }

    /// Get emoji for commit type
    pub fn emoji(&self) -> &'static str {
        match self {
            CommitType::Feat => "✨",
            CommitType::Fix => "🐛",
            CommitType::Docs => "📝",
            CommitType::Style => "💄",
            CommitType::Refactor => "♻️",
            CommitType::Perf => "⚡",
            CommitType::Test => "✅",
            CommitType::Build => "📦",
            CommitType::Ci => "👷",
            CommitType::Chore => "🔧",
            CommitType::Revert => "⏪",
        }
    }

    /// Get description of commit type
    pub fn description(&self) -> &'static str {
        match self {
            CommitType::Feat => "A new feature",
            CommitType::Fix => "A bug fix",
            CommitType::Docs => "Documentation only changes",
            CommitType::Style => "Changes that do not affect the meaning of the code",
            CommitType::Refactor => "A code change that neither fixes a bug nor adds a feature",
            CommitType::Perf => "A code change that improves performance",
            CommitType::Test => "Adding missing tests or correcting existing tests",
            CommitType::Build => "Changes that affect the build system or external dependencies",
            CommitType::Ci => "Changes to CI configuration files and scripts",
            CommitType::Chore => "Other changes that don't modify src or test files",
            CommitType::Revert => "Reverts a previous commit",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "feat" | "feature" => Some(CommitType::Feat),
            "fix" => Some(CommitType::Fix),
            "docs" | "doc" => Some(CommitType::Docs),
            "style" => Some(CommitType::Style),
            "refactor" => Some(CommitType::Refactor),
            "perf" | "performance" => Some(CommitType::Perf),
            "test" => Some(CommitType::Test),
            "build" => Some(CommitType::Build),
            "ci" => Some(CommitType::Ci),
            "chore" => Some(CommitType::Chore),
            "revert" => Some(CommitType::Revert),
            _ => None,
        }
    }
}

impl fmt::Display for CommitType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CommitType::Feat => write!(f, "feat"),
            CommitType::Fix => write!(f, "fix"),
            CommitType::Docs => write!(f, "docs"),
            CommitType::Style => write!(f, "style"),
            CommitType::Refactor => write!(f, "refactor"),
            CommitType::Perf => write!(f, "perf"),
            CommitType::Test => write!(f, "test"),
            CommitType::Build => write!(f, "build"),
            CommitType::Ci => write!(f, "ci"),
            CommitType::Chore => write!(f, "chore"),
            CommitType::Revert => write!(f, "revert"),
        }
    }
}

/// Conventional commit message builder
#[derive(Debug, Clone)]
pub struct ConventionalCommit {
    /// Commit type
    pub commit_type: CommitType,
    /// Scope (optional)
    pub scope: Option<String>,
    /// Short description
    pub description: String,
    /// Body (optional)
    pub body: Option<String>,
    /// Footer (optional)
    pub footer: Option<String>,
    /// Breaking change flag
    pub breaking: bool,
    /// Include emoji
    pub with_emoji: bool,
}

impl ConventionalCommit {
    /// Create a new conventional commit builder
    pub fn new(commit_type: CommitType, description: impl Into<String>) -> Self {
        Self {
            commit_type,
            scope: None,
            description: description.into(),
            body: None,
            footer: None,
            breaking: false,
            with_emoji: false,
        }
    }

    /// Set scope
    pub fn scope(mut self, scope: impl Into<String>) -> Self {
        self.scope = Some(scope.into());
        self
    }

    /// Set body
    pub fn body(mut self, body: impl Into<String>) -> Self {
        self.body = Some(body.into());
        self
    }

    /// Set footer
    pub fn footer(mut self, footer: impl Into<String>) -> Self {
        self.footer = Some(footer.into());
        self
    }

    /// Mark as breaking change
    pub fn breaking(mut self) -> Self {
        self.breaking = true;
        self
    }

    /// Include emoji
    pub fn emoji(mut self) -> Self {
        self.with_emoji = true;
        self
    }

    /// Build commit message
    pub fn build(&self) -> String {
        let mut message = String::new();

        // Type and scope
        message.push_str(&format!("{}", self.commit_type));
        if let Some(ref scope) = self.scope {
            message.push_str(&format!("({})", scope));
        }

        // Breaking change indicator
        if self.breaking {
            message.push('!');
        }

        message.push_str(": ");

        // Emoji
        if self.with_emoji {
            message.push_str(self.commit_type.emoji());
            message.push(' ');
        }

        // Description
        message.push_str(&self.description);

        // Body
        if let Some(ref body) = self.body {
            message.push_str("\n\n");
            message.push_str(body);
        }

        // Footer
        if let Some(ref footer) = self.footer {
            message.push_str("\n\n");
            message.push_str(footer);
        }

        // Breaking change footer
        if self.breaking && !message.contains("BREAKING CHANGE:") {
            message.push_str("\n\nBREAKING CHANGE: ");
            message.push_str(&self.description);
        }

        message
    }
}

/// Validate conventional commit message format
pub fn validate_commit_message(message: &str) -> Result<(), String> {
    let first_line = message.lines().next().unwrap_or("");

    // Check for type
    let type_regex = regex::Regex::new(r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:")
        .unwrap();

    if !type_regex.is_match(first_line) {
        return Err("Commit message must start with a valid conventional commit type".to_string());
    }

    // Check description length
    let description_start = first_line.find(':').unwrap_or(0) + 1;
    let description = first_line[description_start..].trim();

    if description.is_empty() {
        return Err("Commit message must have a description".to_string());
    }

    if description.len() > 100 {
        return Err("Description should be 100 characters or less".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conventional_commit_simple() {
        let commit = ConventionalCommit::new(CommitType::Feat, "add new feature");
        assert_eq!(commit.build(), "feat: add new feature");
    }

    #[test]
    fn test_conventional_commit_with_scope() {
        let commit = ConventionalCommit::new(CommitType::Fix, "fix bug")
            .scope("auth");
        assert_eq!(commit.build(), "fix(auth): fix bug");
    }

    #[test]
    fn test_conventional_commit_with_emoji() {
        let commit = ConventionalCommit::new(CommitType::Feat, "add feature")
            .emoji();
        assert_eq!(commit.build(), "feat: ✨ add feature");
    }

    #[test]
    fn test_conventional_commit_breaking() {
        let commit = ConventionalCommit::new(CommitType::Feat, "breaking change")
            .breaking();
        let message = commit.build();
        assert!(message.starts_with("feat!:"));
        assert!(message.contains("BREAKING CHANGE:"));
    }

    #[test]
    fn test_validate_valid_message() {
        assert!(validate_commit_message("feat: add new feature").is_ok());
        assert!(validate_commit_message("fix(auth): fix login bug").is_ok());
        assert!(validate_commit_message("feat!: breaking change").is_ok());
    }

    #[test]
    fn test_validate_invalid_message() {
        assert!(validate_commit_message("invalid message").is_err());
        assert!(validate_commit_message("feat:").is_err());
    }
}
