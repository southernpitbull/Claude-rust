//! Workflow state machine for agent orchestration
//!
//! Provides a flexible state machine for managing agent workflows with:
//! - State transitions with validation
//! - Event-driven architecture
//! - Persistence and recovery
//! - Parallel and sequential execution

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// Workflow error types
#[derive(Error, Debug)]
pub enum WorkflowError {
    #[error("Invalid state transition: {from} -> {to}")]
    InvalidTransition { from: String, to: String },

    #[error("State not found: {0}")]
    StateNotFound(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

pub type WorkflowResult<T> = Result<T, WorkflowError>;

/// Workflow state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum WorkflowState {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
    Paused,
    Custom(String),
}

impl ToString for WorkflowState {
    fn to_string(&self) -> String {
        match self {
            Self::Pending => "pending".to_string(),
            Self::Running => "running".to_string(),
            Self::Completed => "completed".to_string(),
            Self::Failed => "failed".to_string(),
            Self::Cancelled => "cancelled".to_string(),
            Self::Paused => "paused".to_string(),
            Self::Custom(s) => s.clone(),
        }
    }
}

/// Workflow event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEvent {
    pub id: String,
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub data: HashMap<String, serde_json::Value>,
}

impl WorkflowEvent {
    pub fn new(event_type: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: event_type.into(),
            timestamp: Utc::now(),
            data: HashMap::new(),
        }
    }

    pub fn with_data(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.data.insert(key.into(), value);
        self
    }
}

/// Workflow context shared across states
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowContext {
    pub workflow_id: String,
    pub variables: HashMap<String, serde_json::Value>,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl WorkflowContext {
    pub fn new(workflow_id: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            workflow_id: workflow_id.into(),
            variables: HashMap::new(),
            metadata: HashMap::new(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn set_variable(&mut self, key: impl Into<String>, value: serde_json::Value) {
        self.variables.insert(key.into(), value);
        self.updated_at = Utc::now();
    }

    pub fn get_variable(&self, key: &str) -> Option<&serde_json::Value> {
        self.variables.get(key)
    }

    pub fn set_metadata(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.metadata.insert(key.into(), value.into());
        self.updated_at = Utc::now();
    }
}

/// State handler trait
#[async_trait]
pub trait StateHandler: Send + Sync {
    /// Execute state logic
    async fn execute(&self, context: &mut WorkflowContext) -> WorkflowResult<WorkflowState>;

    /// Validate state entry
    async fn validate(&self, _context: &WorkflowContext) -> WorkflowResult<()> {
        Ok(())
    }

    /// Called when entering state
    async fn on_enter(&self, _context: &mut WorkflowContext) -> WorkflowResult<()> {
        Ok(())
    }

    /// Called when exiting state
    async fn on_exit(&self, _context: &mut WorkflowContext) -> WorkflowResult<()> {
        Ok(())
    }

    /// Get state name
    fn state(&self) -> WorkflowState;
}

/// Workflow definition
pub struct Workflow {
    id: String,
    current_state: Arc<RwLock<WorkflowState>>,
    context: Arc<RwLock<WorkflowContext>>,
    handlers: Arc<RwLock<HashMap<String, Arc<dyn StateHandler>>>>,
    transitions: Arc<RwLock<HashMap<String, Vec<String>>>>,
    history: Arc<RwLock<Vec<StateTransition>>>,
}

/// State transition record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTransition {
    pub from: String,
    pub to: String,
    pub timestamp: DateTime<Utc>,
    pub event: Option<WorkflowEvent>,
}

impl Workflow {
    pub fn new(id: impl Into<String>, initial_state: WorkflowState) -> Self {
        let workflow_id = id.into();
        Self {
            id: workflow_id.clone(),
            current_state: Arc::new(RwLock::new(initial_state)),
            context: Arc::new(RwLock::new(WorkflowContext::new(workflow_id))),
            handlers: Arc::new(RwLock::new(HashMap::new())),
            transitions: Arc::new(RwLock::new(HashMap::new())),
            history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register a state handler
    pub async fn register_handler(&self, handler: Arc<dyn StateHandler>) {
        let state = handler.state().to_string();
        self.handlers.write().await.insert(state, handler);
    }

    /// Define allowed transition
    pub async fn add_transition(&self, from: WorkflowState, to: WorkflowState) {
        let from_str = from.to_string();
        let to_str = to.to_string();

        self.transitions
            .write()
            .await
            .entry(from_str)
            .or_insert_with(Vec::new)
            .push(to_str);
    }

    /// Get current state
    pub async fn current_state(&self) -> WorkflowState {
        self.current_state.read().await.clone()
    }

    /// Transition to new state
    pub async fn transition(&self, new_state: WorkflowState) -> WorkflowResult<()> {
        let current = self.current_state.read().await.clone();

        // Validate transition
        if !self.is_transition_allowed(&current, &new_state).await {
            return Err(WorkflowError::InvalidTransition {
                from: current.to_string(),
                to: new_state.to_string(),
            });
        }

        // Exit current state
        if let Some(handler) = self.handlers.read().await.get(&current.to_string()) {
            let mut ctx = self.context.write().await;
            handler.on_exit(&mut *ctx).await?;
        }

        // Record transition
        let transition = StateTransition {
            from: current.to_string(),
            to: new_state.to_string(),
            timestamp: Utc::now(),
            event: None,
        };
        self.history.write().await.push(transition);

        // Update state
        *self.current_state.write().await = new_state.clone();

        // Enter new state
        if let Some(handler) = self.handlers.read().await.get(&new_state.to_string()) {
            let mut ctx = self.context.write().await;
            handler.on_enter(&mut *ctx).await?;
        }

        Ok(())
    }

    /// Execute current state
    pub async fn execute(&self) -> WorkflowResult<WorkflowState> {
        let current = self.current_state.read().await.clone();
        let state_str = current.to_string();

        let handler = self
            .handlers
            .read()
            .await
            .get(&state_str)
            .cloned()
            .ok_or_else(|| WorkflowError::StateNotFound(state_str))?;

        // Validate before execution
        {
            let ctx = self.context.read().await;
            handler.validate(&*ctx).await?;
        }

        // Execute handler
        let mut ctx = self.context.write().await;
        handler.execute(&mut *ctx).await
    }

    /// Run workflow until completion
    pub async fn run(&self) -> WorkflowResult<()> {
        loop {
            let current = self.current_state().await;

            match current {
                WorkflowState::Completed | WorkflowState::Failed | WorkflowState::Cancelled => {
                    break;
                }
                _ => {}
            }

            let next_state = self.execute().await?;

            if next_state != current {
                self.transition(next_state).await?;
            }
        }

        Ok(())
    }

    /// Check if transition is allowed
    async fn is_transition_allowed(&self, from: &WorkflowState, to: &WorkflowState) -> bool {
        let transitions = self.transitions.read().await;
        let from_str = from.to_string();
        let to_str = to.to_string();

        transitions
            .get(&from_str)
            .map(|allowed| allowed.contains(&to_str))
            .unwrap_or(true) // Allow all transitions if none defined
    }

    /// Get workflow context
    pub async fn context(&self) -> WorkflowContext {
        self.context.read().await.clone()
    }

    /// Get workflow history
    pub async fn history(&self) -> Vec<StateTransition> {
        self.history.read().await.clone()
    }

    /// Get workflow ID
    pub fn id(&self) -> &str {
        &self.id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHandler {
        state: WorkflowState,
        next_state: WorkflowState,
    }

    #[async_trait]
    impl StateHandler for TestHandler {
        async fn execute(&self, _context: &mut WorkflowContext) -> WorkflowResult<WorkflowState> {
            Ok(self.next_state.clone())
        }

        fn state(&self) -> WorkflowState {
            self.state.clone()
        }
    }

    #[test]
    fn test_workflow_state_to_string() {
        assert_eq!(WorkflowState::Pending.to_string(), "pending");
        assert_eq!(WorkflowState::Running.to_string(), "running");
        assert_eq!(WorkflowState::Completed.to_string(), "completed");
    }

    #[test]
    fn test_workflow_event_creation() {
        let event = WorkflowEvent::new("test_event");
        assert_eq!(event.event_type, "test_event");
        assert!(!event.id.is_empty());
    }

    #[test]
    fn test_workflow_context_creation() {
        let ctx = WorkflowContext::new("workflow1");
        assert_eq!(ctx.workflow_id, "workflow1");
    }

    #[tokio::test]
    async fn test_workflow_creation() {
        let workflow = Workflow::new("test", WorkflowState::Pending);
        assert_eq!(workflow.id(), "test");
        assert_eq!(workflow.current_state().await, WorkflowState::Pending);
    }

    #[tokio::test]
    async fn test_workflow_transition() {
        let workflow = Workflow::new("test", WorkflowState::Pending);
        workflow
            .add_transition(WorkflowState::Pending, WorkflowState::Running)
            .await;

        workflow.transition(WorkflowState::Running).await.unwrap();
        assert_eq!(workflow.current_state().await, WorkflowState::Running);
    }

    #[tokio::test]
    async fn test_workflow_execute() {
        let workflow = Workflow::new("test", WorkflowState::Pending);
        let handler = Arc::new(TestHandler {
            state: WorkflowState::Pending,
            next_state: WorkflowState::Running,
        });

        workflow.register_handler(handler).await;

        let next_state = workflow.execute().await.unwrap();
        assert_eq!(next_state, WorkflowState::Running);
    }
}
