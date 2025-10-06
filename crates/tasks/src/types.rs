//! Task Type Definitions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Unique task identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TaskId(Uuid);

impl TaskId {
    /// Generate a new task ID
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Get the underlying UUID
    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl Default for TaskId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for TaskId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Uuid> for TaskId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

/// Task priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TaskPriority {
    /// Low priority task
    Low = 0,
    /// Normal priority task
    Normal = 1,
    /// High priority task
    High = 2,
    /// Critical priority task
    Critical = 3,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Normal
    }
}

/// Task status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    /// Task is queued
    Queued,
    /// Task is running
    Running,
    /// Task completed successfully
    Completed,
    /// Task failed
    Failed,
    /// Task was cancelled
    Cancelled,
}

/// Task metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    /// Task ID
    pub id: TaskId,

    /// Task name/description
    pub name: String,

    /// Task type
    pub task_type: String,

    /// Task priority
    pub priority: TaskPriority,

    /// Task status
    pub status: TaskStatus,

    /// When task was created
    pub created_at: DateTime<Utc>,

    /// When task started running
    pub started_at: Option<DateTime<Utc>>,

    /// When task completed
    pub completed_at: Option<DateTime<Utc>>,

    /// Task progress (0-100)
    pub progress: u8,

    /// Task result message
    pub message: Option<String>,
}

impl Task {
    /// Create a new task
    pub fn new(name: impl Into<String>, task_type: impl Into<String>) -> Self {
        Self {
            id: TaskId::new(),
            name: name.into(),
            task_type: task_type.into(),
            priority: TaskPriority::Normal,
            status: TaskStatus::Queued,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            progress: 0,
            message: None,
        }
    }

    /// Set task priority
    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }

    /// Mark task as running
    pub fn mark_running(&mut self) {
        self.status = TaskStatus::Running;
        self.started_at = Some(Utc::now());
    }

    /// Mark task as completed
    pub fn mark_completed(&mut self, message: Option<String>) {
        self.status = TaskStatus::Completed;
        self.completed_at = Some(Utc::now());
        self.progress = 100;
        self.message = message;
    }

    /// Mark task as failed
    pub fn mark_failed(&mut self, error: String) {
        self.status = TaskStatus::Failed;
        self.completed_at = Some(Utc::now());
        self.message = Some(error);
    }

    /// Mark task as cancelled
    pub fn mark_cancelled(&mut self) {
        self.status = TaskStatus::Cancelled;
        self.completed_at = Some(Utc::now());
    }

    /// Update task progress
    pub fn set_progress(&mut self, progress: u8) {
        self.progress = progress.min(100);
    }

    /// Get task duration
    pub fn duration(&self) -> Option<chrono::Duration> {
        if let (Some(started), Some(completed)) = (self.started_at, self.completed_at) {
            Some(completed - started)
        } else if let Some(started) = self.started_at {
            Some(Utc::now() - started)
        } else {
            None
        }
    }
}

/// Task execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    /// Task ID
    pub task_id: TaskId,

    /// Whether task succeeded
    pub success: bool,

    /// Result data
    pub data: Option<serde_json::Value>,

    /// Error message if failed
    pub error: Option<String>,

    /// Execution duration
    pub duration: Option<chrono::Duration>,
}

impl TaskResult {
    /// Create a successful result
    pub fn success(task_id: TaskId, data: Option<serde_json::Value>) -> Self {
        Self {
            task_id,
            success: true,
            data,
            error: None,
            duration: None,
        }
    }

    /// Create a failure result
    pub fn failure(task_id: TaskId, error: String) -> Self {
        Self {
            task_id,
            success: false,
            data: None,
            error: Some(error),
            duration: None,
        }
    }

    /// Set duration
    pub fn with_duration(mut self, duration: chrono::Duration) -> Self {
        self.duration = Some(duration);
        self
    }
}

/// Task notification type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskNotification {
    /// Task was queued
    Queued(Task),

    /// Task started running
    Started(Task),

    /// Task progress updated
    Progress {
        task_id: TaskId,
        progress: u8,
        message: Option<String>,
    },

    /// Task completed successfully
    Completed(TaskResult),

    /// Task failed
    Failed {
        task_id: TaskId,
        error: String,
    },

    /// Task was cancelled
    Cancelled(TaskId),
}

impl TaskNotification {
    /// Get task ID from notification
    pub fn task_id(&self) -> TaskId {
        match self {
            Self::Queued(task) => task.id,
            Self::Started(task) => task.id,
            Self::Progress { task_id, .. } => *task_id,
            Self::Completed(result) => result.task_id,
            Self::Failed { task_id, .. } => *task_id,
            Self::Cancelled(task_id) => *task_id,
        }
    }

    /// Check if notification indicates task completion
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            Self::Completed(_) | Self::Failed { .. } | Self::Cancelled(_)
        )
    }
}

/// Task notification channel
#[derive(Clone)]
pub struct TaskNotifier {
    tx: Arc<broadcast::Sender<TaskNotification>>,
}

impl TaskNotifier {
    /// Create a new task notifier with specified channel capacity
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx: Arc::new(tx) }
    }

    /// Send a notification
    pub fn notify(&self, notification: TaskNotification) {
        // Ignore send errors (no receivers is fine)
        let _ = self.tx.send(notification);
    }

    /// Subscribe to notifications
    pub fn subscribe(&self) -> broadcast::Receiver<TaskNotification> {
        self.tx.subscribe()
    }

    /// Get the number of active subscribers
    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }
}

impl Default for TaskNotifier {
    fn default() -> Self {
        Self::new(100) // Default capacity of 100 notifications
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_notification_task_id() {
        let task = Task::new("test", "test-type");
        let task_id = task.id;

        assert_eq!(TaskNotification::Queued(task.clone()).task_id(), task_id);
        assert_eq!(TaskNotification::Started(task.clone()).task_id(), task_id);
        assert_eq!(
            TaskNotification::Progress {
                task_id,
                progress: 50,
                message: None
            }
            .task_id(),
            task_id
        );
    }

    #[test]
    fn test_task_notification_is_terminal() {
        let task = Task::new("test", "test-type");

        assert!(!TaskNotification::Queued(task.clone()).is_terminal());
        assert!(!TaskNotification::Started(task).is_terminal());
        assert!(!TaskNotification::Progress {
            task_id: TaskId::new(),
            progress: 50,
            message: None
        }
        .is_terminal());

        assert!(TaskNotification::Completed(TaskResult::success(
            TaskId::new(),
            None
        ))
        .is_terminal());

        assert!(TaskNotification::Failed {
            task_id: TaskId::new(),
            error: "error".to_string()
        }
        .is_terminal());

        assert!(TaskNotification::Cancelled(TaskId::new()).is_terminal());
    }

    #[tokio::test]
    async fn test_task_notifier() {
        let notifier = TaskNotifier::new(10);
        let mut rx = notifier.subscribe();

        // Send a notification
        let task = Task::new("test", "test-type");
        notifier.notify(TaskNotification::Queued(task.clone()));

        // Receive the notification
        let notification = rx.recv().await.unwrap();
        assert_eq!(notification.task_id(), task.id);
    }

    #[tokio::test]
    async fn test_task_notifier_multiple_receivers() {
        let notifier = TaskNotifier::new(10);
        let mut rx1 = notifier.subscribe();
        let mut rx2 = notifier.subscribe();

        assert_eq!(notifier.receiver_count(), 2);

        // Send a notification
        let task = Task::new("test", "test-type");
        notifier.notify(TaskNotification::Queued(task.clone()));

        // Both receivers should get the notification
        let notif1 = rx1.recv().await.unwrap();
        let notif2 = rx2.recv().await.unwrap();

        assert_eq!(notif1.task_id(), task.id);
        assert_eq!(notif2.task_id(), task.id);
    }
}
