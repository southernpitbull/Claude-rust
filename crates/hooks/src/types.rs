//! Hook Type Definitions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Hook execution point
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HookPoint {
    /// Before user submits a prompt
    UserPromptSubmit,

    /// Before executing a tool
    BeforeToolUse,

    /// After executing a tool
    AfterToolUse,

    /// Before creating a commit
    PreCommit,

    /// After creating a commit
    PostCommit,

    /// When a session starts
    SessionStart,

    /// When a session ends
    SessionEnd,

    /// Before saving a file
    BeforeFileSave,

    /// After saving a file
    AfterFileSave,

    /// Before running tests
    BeforeTest,

    /// After running tests
    AfterTest,
}

impl HookPoint {
    /// Get all hook points
    pub fn all() -> Vec<HookPoint> {
        vec![
            HookPoint::UserPromptSubmit,
            HookPoint::BeforeToolUse,
            HookPoint::AfterToolUse,
            HookPoint::PreCommit,
            HookPoint::PostCommit,
            HookPoint::SessionStart,
            HookPoint::SessionEnd,
            HookPoint::BeforeFileSave,
            HookPoint::AfterFileSave,
            HookPoint::BeforeTest,
            HookPoint::AfterTest,
        ]
    }

    /// Get hook point name
    pub fn name(&self) -> &'static str {
        match self {
            HookPoint::UserPromptSubmit => "user-prompt-submit",
            HookPoint::BeforeToolUse => "before-tool-use",
            HookPoint::AfterToolUse => "after-tool-use",
            HookPoint::PreCommit => "pre-commit",
            HookPoint::PostCommit => "post-commit",
            HookPoint::SessionStart => "session-start",
            HookPoint::SessionEnd => "session-end",
            HookPoint::BeforeFileSave => "before-file-save",
            HookPoint::AfterFileSave => "after-file-save",
            HookPoint::BeforeTest => "before-test",
            HookPoint::AfterTest => "after-test",
        }
    }
}

/// Hook type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum HookType {
    /// Shell command hook
    #[serde(rename = "shell")]
    Shell {
        /// Command to execute
        command: String,

        /// Command arguments
        #[serde(default)]
        args: Vec<String>,

        /// Working directory
        cwd: Option<String>,

        /// Environment variables
        #[serde(default)]
        env: HashMap<String, String>,
    },

    /// JavaScript hook
    #[serde(rename = "javascript")]
    JavaScript {
        /// Script content or path
        script: String,

        /// Whether script is a file path
        #[serde(default)]
        is_file: bool,
    },

    /// Python hook
    #[serde(rename = "python")]
    Python {
        /// Script content or path
        script: String,

        /// Whether script is a file path
        #[serde(default)]
        is_file: bool,
    },
}

/// Hook execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookContext {
    /// Hook point
    pub point: HookPoint,

    /// Context data (varies by hook point)
    #[serde(default)]
    pub data: HashMap<String, serde_json::Value>,
}

impl HookContext {
    /// Create a new hook context
    pub fn new(point: HookPoint) -> Self {
        Self {
            point,
            data: HashMap::new(),
        }
    }

    /// Add context data
    pub fn with_data(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.data.insert(key.into(), value);
        self
    }

    /// Get context data
    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.data.get(key)
    }
}

/// Hook execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookResult {
    /// Whether the hook succeeded
    pub success: bool,

    /// Hook output (stdout)
    pub output: Option<String>,

    /// Hook error output (stderr)
    pub error: Option<String>,

    /// Exit code (for shell hooks)
    pub exit_code: Option<i32>,

    /// Whether to block the operation (for blocking hooks)
    pub block: bool,

    /// Message to display to user
    pub message: Option<String>,
}

impl HookResult {
    /// Create a successful result
    pub fn success() -> Self {
        Self {
            success: true,
            output: None,
            error: None,
            exit_code: Some(0),
            block: false,
            message: None,
        }
    }

    /// Create a failure result
    pub fn failure(error: impl Into<String>) -> Self {
        Self {
            success: false,
            output: None,
            error: Some(error.into()),
            exit_code: Some(1),
            block: false,
            message: None,
        }
    }

    /// Create a blocking result
    pub fn blocked(message: impl Into<String>) -> Self {
        Self {
            success: false,
            output: None,
            error: None,
            exit_code: None,
            block: true,
            message: Some(message.into()),
        }
    }

    /// Set output
    pub fn with_output(mut self, output: impl Into<String>) -> Self {
        self.output = Some(output.into());
        self
    }

    /// Set error
    pub fn with_error(mut self, error: impl Into<String>) -> Self {
        self.error = Some(error.into());
        self
    }

    /// Set message
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }
}
