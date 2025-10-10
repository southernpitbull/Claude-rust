//! Task Executor

use anyhow::Result;
use async_channel::{Receiver, Sender, unbounded};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use crate::queue::TaskQueue;
use crate::types::{Task, TaskId, TaskResult};

/// Task handler trait
#[async_trait]
pub trait TaskHandler: Send + Sync {
    /// Handle a task execution
    async fn handle(&self, task: &mut Task) -> Result<TaskResult>;

    /// Get task type this handler supports
    fn task_type(&self) -> &str;
}

/// Task executor for running background tasks
pub struct TaskExecutor {
    /// Task queue
    queue: Arc<TaskQueue>,

    /// Running tasks
    running: Arc<Mutex<HashMap<TaskId, Task>>>,

    /// Completed tasks (limited history)
    completed: Arc<Mutex<Vec<Task>>>,

    /// Task handlers by type
    handlers: Arc<Mutex<HashMap<String, Arc<dyn TaskHandler>>>>,

    /// Shutdown signal
    shutdown_tx: Sender<()>,
    shutdown_rx: Receiver<()>,

    /// Maximum concurrent tasks
    max_concurrent: usize,

    /// Maximum completed task history
    max_history: usize,
}

impl TaskExecutor {
    /// Create a new task executor
    pub fn new(max_concurrent: usize, max_queue_size: usize) -> Self {
        let (shutdown_tx, shutdown_rx) = unbounded();

        Self {
            queue: Arc::new(TaskQueue::new(max_queue_size)),
            running: Arc::new(Mutex::new(HashMap::new())),
            completed: Arc::new(Mutex::new(Vec::new())),
            handlers: Arc::new(Mutex::new(HashMap::new())),
            shutdown_tx,
            shutdown_rx,
            max_concurrent,
            max_history: 100,
        }
    }

    /// Register a task handler
    pub async fn register_handler(&self, handler: Arc<dyn TaskHandler>) {
        let mut handlers = self.handlers.lock().await;
        let task_type = handler.task_type().to_string();
        info!("Registering task handler for type: {}", task_type);
        handlers.insert(task_type, handler);
    }

    /// Submit a task for execution
    pub async fn submit(&self, task: Task) -> Result<TaskId> {
        let task_id = self.queue.enqueue(task).await?;
        info!("Task submitted: {}", task_id);
        Ok(task_id)
    }

    /// Start the executor
    pub async fn start(&self) {
        info!("Starting task executor (max concurrent: {})", self.max_concurrent);

        loop {
            tokio::select! {
                _ = self.shutdown_rx.recv() => {
                    info!("Task executor shutting down");
                    break;
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                    self.process_tasks().await;
                }
            }
        }
    }

    /// Process pending tasks
    async fn process_tasks(&self) {
        // Check how many tasks are currently running
        let running_count = self.running.lock().await.len();

        if running_count >= self.max_concurrent {
            return;
        }

        // Get next task from queue
        if let Some(mut task) = self.queue.dequeue().await {
            let task_id = task.id;

            // Mark as running
            task.mark_running();
            self.running.lock().await.insert(task_id, task.clone());

            // Execute in background
            let executor = self.clone_for_task();
            tokio::spawn(async move {
                executor.execute_task(task).await;
            });
        }
    }

    /// Execute a single task
    async fn execute_task(&self, mut task: Task) {
        let task_id = task.id;
        info!("Executing task: {} ({})", task.name, task_id);

        // Get handler for task type
        let handler = {
            let handlers = self.handlers.lock().await;
            handlers.get(&task.task_type).cloned()
        };

        let _result = if let Some(handler) = handler {
            match handler.handle(&mut task).await {
                Ok(result) => {
                    task.mark_completed(result.data.as_ref().map(|d| d.to_string()));
                    result
                }
                Err(e) => {
                    error!("Task {} failed: {}", task_id, e);
                    task.mark_failed(e.to_string());
                    TaskResult::failure(task_id, e.to_string())
                }
            }
        } else {
            warn!("No handler registered for task type: {}", task.task_type);
            task.mark_failed(format!("No handler for type: {}", task.task_type));
            TaskResult::failure(task_id, "No handler found".to_string())
        };

        // Move to completed
        self.running.lock().await.remove(&task_id);

        let mut completed = self.completed.lock().await;
        completed.push(task.clone());

        // Trim history
        if completed.len() > self.max_history {
            completed.remove(0);
        }

        debug!("Task {} completed with status: {:?}", task_id, task.status);
    }

    /// Get task status
    pub async fn get_status(&self, task_id: TaskId) -> Option<Task> {
        // Check running tasks
        if let Some(task) = self.running.lock().await.get(&task_id) {
            return Some(task.clone());
        }

        // Check completed tasks
        let completed = self.completed.lock().await;
        if let Some(task) = completed.iter().find(|t| t.id == task_id) {
            return Some(task.clone());
        }

        // Check queue
        self.queue.get(task_id).await
    }

    /// List all running tasks
    pub async fn list_running(&self) -> Vec<Task> {
        let running = self.running.lock().await;
        running.values().cloned().collect()
    }

    /// List completed tasks
    pub async fn list_completed(&self) -> Vec<Task> {
        let completed = self.completed.lock().await;
        completed.clone()
    }

    /// List all tasks (queued, running, completed)
    pub async fn list_all(&self) -> Vec<Task> {
        let mut tasks = Vec::new();

        // Add queued
        tasks.extend(self.queue.list().await);

        // Add running
        tasks.extend(self.list_running().await);

        // Add completed
        tasks.extend(self.list_completed().await);

        tasks
    }

    /// Cancel a task
    pub async fn cancel(&self, task_id: TaskId) -> Result<()> {
        // Check if task is queued
        if let Some(mut task) = self.queue.remove(task_id).await {
            task.mark_cancelled();
            self.completed.lock().await.push(task);
            info!("Cancelled queued task: {}", task_id);
            return Ok(());
        }

        // Can't cancel running tasks (yet)
        if self.running.lock().await.contains_key(&task_id) {
            anyhow::bail!("Cannot cancel running task (not yet supported)");
        }

        anyhow::bail!("Task not found: {}", task_id);
    }

    /// Shutdown the executor
    pub async fn shutdown(&self) {
        info!("Shutting down task executor");
        let _ = self.shutdown_tx.send(()).await;
    }

    /// Helper to clone executor for task execution
    fn clone_for_task(&self) -> Self {
        Self {
            queue: self.queue.clone(),
            running: self.running.clone(),
            completed: self.completed.clone(),
            handlers: self.handlers.clone(),
            shutdown_tx: self.shutdown_tx.clone(),
            shutdown_rx: self.shutdown_rx.clone(),
            max_concurrent: self.max_concurrent,
            max_history: self.max_history,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TaskStatus;

    struct TestHandler;

    #[async_trait]
    impl TaskHandler for TestHandler {
        async fn handle(&self, _task: &mut Task) -> Result<TaskResult> {
            Ok(TaskResult::success(_task.id, None))
        }

        fn task_type(&self) -> &str {
            "test"
        }
    }

    #[tokio::test]
    async fn test_submit_and_execute() {
        let executor = TaskExecutor::new(5, 10);
        executor.register_handler(Arc::new(TestHandler)).await;

        let task = Task::new("test", "test");
        let task_id = executor.submit(task).await.unwrap();

        // Process tasks
        executor.process_tasks().await;

        // Wait a bit for execution
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let status = executor.get_status(task_id).await.unwrap();
        assert!(matches!(status.status, TaskStatus::Completed | TaskStatus::Running));
    }
}
