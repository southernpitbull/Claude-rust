//! Agent Type Definitions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Unique agent identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentId(Uuid);

impl AgentId {
    /// Generate a new agent ID
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Get the underlying UUID
    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl Default for AgentId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Uuid> for AgentId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

/// Agent type specialization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentType {
    /// General-purpose agent
    General,
    /// Code review agent
    CodeReview,
    /// Testing agent
    Testing,
    /// Documentation agent
    Documentation,
    /// Refactoring agent
    Refactoring,
    /// Security scanning agent
    SecurityScan,
    /// Performance optimization agent
    Performance,
    /// Code generation agent
    CodeGeneration,
}

impl AgentType {
    /// Get human-readable name
    pub fn name(&self) -> &str {
        match self {
            Self::General => "General",
            Self::CodeReview => "Code Review",
            Self::Testing => "Testing",
            Self::Documentation => "Documentation",
            Self::Refactoring => "Refactoring",
            Self::SecurityScan => "Security Scan",
            Self::Performance => "Performance",
            Self::CodeGeneration => "Code Generation",
        }
    }

    /// Get description
    pub fn description(&self) -> &str {
        match self {
            Self::General => "General-purpose agent for various tasks",
            Self::CodeReview => "Reviews code for quality, bugs, and best practices",
            Self::Testing => "Generates and runs tests",
            Self::Documentation => "Creates and updates documentation",
            Self::Refactoring => "Refactors code for better structure",
            Self::SecurityScan => "Scans code for security vulnerabilities",
            Self::Performance => "Optimizes code for performance",
            Self::CodeGeneration => "Generates code from specifications",
        }
    }
}

impl fmt::Display for AgentType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.name())
    }
}

/// Agent status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentStatus {
    /// Agent is idle
    Idle,
    /// Agent is busy with a task
    Busy,
    /// Agent is paused
    Paused,
    /// Agent encountered an error
    Error,
    /// Agent is stopped
    Stopped,
}

impl fmt::Display for AgentStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Idle => write!(f, "Idle"),
            Self::Busy => write!(f, "Busy"),
            Self::Paused => write!(f, "Paused"),
            Self::Error => write!(f, "Error"),
            Self::Stopped => write!(f, "Stopped"),
        }
    }
}

/// Agent metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    /// Unique agent ID
    pub id: AgentId,
    /// Agent type
    pub agent_type: AgentType,
    /// Agent name
    pub name: String,
    /// Current status
    pub status: AgentStatus,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last activity timestamp
    pub last_active: Option<DateTime<Utc>>,
    /// Current task ID (if busy)
    pub current_task: Option<claude_rust_tasks::TaskId>,
    /// Number of completed tasks
    pub tasks_completed: u64,
    /// Number of failed tasks
    pub tasks_failed: u64,
    /// Agent capabilities
    pub capabilities: Vec<String>,
}

impl Agent {
    /// Create a new agent
    pub fn new(agent_type: AgentType, name: impl Into<String>) -> Self {
        Self {
            id: AgentId::new(),
            agent_type,
            name: name.into(),
            status: AgentStatus::Idle,
            created_at: Utc::now(),
            last_active: None,
            current_task: None,
            tasks_completed: 0,
            tasks_failed: 0,
            capabilities: Vec::new(),
        }
    }

    /// Mark agent as busy with a task
    pub fn mark_busy(&mut self, task_id: claude_rust_tasks::TaskId) {
        self.status = AgentStatus::Busy;
        self.current_task = Some(task_id);
        self.last_active = Some(Utc::now());
    }

    /// Mark agent as idle
    pub fn mark_idle(&mut self) {
        self.status = AgentStatus::Idle;
        self.current_task = None;
        self.last_active = Some(Utc::now());
    }

    /// Mark task as completed
    pub fn task_completed(&mut self) {
        self.tasks_completed += 1;
        self.mark_idle();
    }

    /// Mark task as failed
    pub fn task_failed(&mut self) {
        self.tasks_failed += 1;
        self.mark_idle();
    }

    /// Mark agent as paused
    pub fn pause(&mut self) {
        self.status = AgentStatus::Paused;
    }

    /// Resume agent
    pub fn resume(&mut self) {
        self.status = AgentStatus::Idle;
    }

    /// Stop agent
    pub fn stop(&mut self) {
        self.status = AgentStatus::Stopped;
        self.current_task = None;
    }

    /// Check if agent is available
    pub fn is_available(&self) -> bool {
        self.status == AgentStatus::Idle
    }

    /// Add capability
    pub fn add_capability(&mut self, capability: String) {
        if !self.capabilities.contains(&capability) {
            self.capabilities.push(capability);
        }
    }
}

/// Agent request for task delegation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRequest {
    /// Request ID
    pub id: Uuid,
    /// Agent type requested
    pub agent_type: AgentType,
    /// Task to delegate
    pub task_id: claude_rust_tasks::TaskId,
    /// Required capabilities
    pub required_capabilities: Vec<String>,
    /// Request timestamp
    pub created_at: DateTime<Utc>,
}

impl AgentRequest {
    /// Create a new agent request
    pub fn new(
        agent_type: AgentType,
        task_id: claude_rust_tasks::TaskId,
        required_capabilities: Vec<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            agent_type,
            task_id,
            required_capabilities,
            created_at: Utc::now(),
        }
    }
}

/// Agent result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    /// Agent ID
    pub agent_id: AgentId,
    /// Task ID
    pub task_id: claude_rust_tasks::TaskId,
    /// Success flag
    pub success: bool,
    /// Result data
    pub data: Option<serde_json::Value>,
    /// Error message (if failed)
    pub error: Option<String>,
    /// Completion timestamp
    pub completed_at: DateTime<Utc>,
}

impl AgentResult {
    /// Create a successful result
    pub fn success(
        agent_id: AgentId,
        task_id: claude_rust_tasks::TaskId,
        data: Option<serde_json::Value>,
    ) -> Self {
        Self {
            agent_id,
            task_id,
            success: true,
            data,
            error: None,
            completed_at: Utc::now(),
        }
    }

    /// Create a failed result
    pub fn failure(
        agent_id: AgentId,
        task_id: claude_rust_tasks::TaskId,
        error: String,
    ) -> Self {
        Self {
            agent_id,
            task_id,
            success: false,
            data: None,
            error: Some(error),
            completed_at: Utc::now(),
        }
    }
}
