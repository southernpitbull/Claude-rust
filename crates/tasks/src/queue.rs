//! Task Queue Implementation

use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info};

use crate::types::{Task, TaskId, TaskStatus};

/// Task queue for managing pending tasks
pub struct TaskQueue {
    /// Queued tasks by priority
    tasks: Arc<Mutex<HashMap<TaskId, Task>>>,

    /// Maximum queue size
    max_size: usize,
}

impl TaskQueue {
    /// Create a new task queue
    pub fn new(max_size: usize) -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            max_size,
        }
    }

    /// Add a task to the queue
    pub async fn enqueue(&self, task: Task) -> Result<TaskId> {
        let mut tasks = self.tasks.lock().await;

        if tasks.len() >= self.max_size {
            anyhow::bail!("Task queue is full (max: {})", self.max_size);
        }

        let task_id = task.id;
        info!("Enqueuing task: {} ({})", task.name, task_id);

        tasks.insert(task_id, task);
        Ok(task_id)
    }

    /// Get next task to execute (highest priority first)
    pub async fn dequeue(&self) -> Option<Task> {
        let mut tasks = self.tasks.lock().await;

        if tasks.is_empty() {
            return None;
        }

        // Find highest priority task
        let task_id = tasks
            .iter()
            .filter(|(_, t)| t.status == TaskStatus::Queued)
            .max_by_key(|(_, t)| (t.priority, t.created_at))?
            .0
            .clone();

        tasks.remove(&task_id)
    }

    /// Get a task by ID
    pub async fn get(&self, task_id: TaskId) -> Option<Task> {
        let tasks = self.tasks.lock().await;
        tasks.get(&task_id).cloned()
    }

    /// Update a task
    pub async fn update(&self, task: Task) {
        let mut tasks = self.tasks.lock().await;
        tasks.insert(task.id, task);
    }

    /// Remove a task
    pub async fn remove(&self, task_id: TaskId) -> Option<Task> {
        let mut tasks = self.tasks.lock().await;
        tasks.remove(&task_id)
    }

    /// List all tasks
    pub async fn list(&self) -> Vec<Task> {
        let tasks = self.tasks.lock().await;
        let mut task_list: Vec<Task> = tasks.values().cloned().collect();

        // Sort by priority and creation time
        task_list.sort_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.created_at.cmp(&b.created_at))
        });

        task_list
    }

    /// List tasks by status
    pub async fn list_by_status(&self, status: TaskStatus) -> Vec<Task> {
        let tasks = self.tasks.lock().await;
        let mut task_list: Vec<Task> = tasks
            .values()
            .filter(|t| t.status == status)
            .cloned()
            .collect();

        task_list.sort_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.created_at.cmp(&b.created_at))
        });

        task_list
    }

    /// Get queue size
    pub async fn size(&self) -> usize {
        let tasks = self.tasks.lock().await;
        tasks.len()
    }

    /// Check if queue is empty
    pub async fn is_empty(&self) -> bool {
        let tasks = self.tasks.lock().await;
        tasks.is_empty()
    }

    /// Clear all tasks
    pub async fn clear(&self) {
        let mut tasks = self.tasks.lock().await;
        tasks.clear();
        debug!("Task queue cleared");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TaskPriority;

    #[tokio::test]
    async fn test_enqueue_dequeue() {
        let queue = TaskQueue::new(10);

        let task = Task::new("test", "test-type");
        let task_id = queue.enqueue(task.clone()).await.unwrap();

        let dequeued = queue.dequeue().await.unwrap();
        assert_eq!(dequeued.id, task_id);
    }

    #[tokio::test]
    async fn test_priority_order() {
        let queue = TaskQueue::new(10);

        let low_task = Task::new("low", "test").with_priority(TaskPriority::Low);
        let high_task = Task::new("high", "test").with_priority(TaskPriority::High);

        queue.enqueue(low_task).await.unwrap();
        queue.enqueue(high_task.clone()).await.unwrap();

        let dequeued = queue.dequeue().await.unwrap();
        assert_eq!(dequeued.id, high_task.id);
    }

    #[tokio::test]
    async fn test_max_size() {
        let queue = TaskQueue::new(2);

        queue.enqueue(Task::new("task1", "test")).await.unwrap();
        queue.enqueue(Task::new("task2", "test")).await.unwrap();

        let result = queue.enqueue(Task::new("task3", "test")).await;
        assert!(result.is_err());
    }
}
