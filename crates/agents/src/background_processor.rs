//! Background Task Processor
//!
//! Processes background tasks using agents in dedicated threads

use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio::time;
use tracing::{debug, error, info, warn};

use claude_code_tasks::{Task, TaskExecutor, TaskId, TaskResult, TaskStatus};
use crate::types::{Agent, AgentId, AgentType};
use crate::registry::AgentRegistry;

/// Background task processor
pub struct BackgroundTaskProcessor {
    /// Agent registry
    registry: Arc<AgentRegistry>,
    
    /// Task executor
    executor: Arc<TaskExecutor>,
    
    /// Channel for task submissions
    task_tx: mpsc::UnboundedSender<Task>,
    task_rx: Arc<Mutex<mpsc::UnboundedReceiver<Task>>>,
    
    /// Channel for task results
    result_tx: mpsc::UnboundedSender<TaskResult>,
    result_rx: Arc<Mutex<mpsc::UnboundedReceiver<TaskResult>>>,
    
    /// Running flag
    running: Arc<Mutex<bool>>,
}

impl BackgroundTaskProcessor {
    /// Create a new background task processor
    pub fn new(registry: Arc<AgentRegistry>, executor: Arc<TaskExecutor>) -> Self {
        let (task_tx, task_rx) = mpsc::unbounded_channel();
        let (result_tx, result_rx) = mpsc::unbounded_channel();
        
        Self {
            registry,
            executor,
            task_tx,
            task_rx: Arc::new(Mutex::new(task_rx)),
            result_tx,
            result_rx: Arc::new(Mutex::new(result_rx)),
            running: Arc::new(Mutex::new(false)),
        }
    }
    
    /// Start the background processor
    pub async fn start(&self) {
        let mut running = self.running.lock().await;
        *running = true;
        drop(running);
        
        info!("Starting background task processor");
        
        // Start processing loop in a separate task
        let processor = self.clone();
        tokio::spawn(async move {
            processor.process_loop().await;
        });
    }
    
    /// Stop the background processor
    pub async fn stop(&self) {
        let mut running = self.running.lock().await;
        *running = false;
        info!("Stopping background task processor");
    }
    
    /// Main processing loop
    async fn process_loop(&self) {
        let mut interval = time::interval(Duration::from_millis(100));
        
        loop {
            // Check if we should stop
            {
                let running = self.running.lock().await;
                if !*running {
                    break;
                }
            }
            
            interval.tick().await;
            
            // Check for tasks to process
            self.process_tasks().await;
            
            // Handle results
            self.handle_results().await;
        }
        
        info!("Background task processor stopped");
    }
    
    /// Process available tasks
    async fn process_tasks(&self) {
        // Check for tasks in the channel
        let mut task_rx = self.task_rx.lock().await;
        while let Ok(task) = task_rx.try_recv() {
            debug!("Processing background task: {}", task.id);
            
            // Try to find an available agent for this task
            if let Some(mut agent) = self.find_suitable_agent(&task).await {
                info!("Assigning task {} to agent {}", task.id, agent.name);
                
                // Mark agent as busy
                agent.mark_busy(task.id);
                self.registry.update(agent.clone()).await;
                
                // Execute task in background
                let task_id = task.id;
                let agent_id = agent.id;
                let executor = self.executor.clone();
                let result_tx = self.result_tx.clone();
                let registry = self.registry.clone();
                
                tokio::spawn(async move {
                    match Self::execute_task_with_agent(task, agent_id, executor).await {
                        Ok(result) => {
                            let _ = result_tx.send(result);
                        }
                        Err(e) => {
                            error!("Failed to execute task {}: {}", task_id, e);
                            let result = TaskResult::failure(
                                task_id, 
                                format!("Task execution failed: {}", e)
                            );
                            let _ = result_tx.send(result);
                        }
                    }
                    
                    // Update agent status
                    if let Some(mut agent) = registry.get(agent_id).await {
                        agent.mark_idle();
                        registry.update(agent).await;
                    }
                });
            } else {
                warn!("No suitable agent found for task {}", task.id);
                // Put task back in queue or mark as failed
                let result = TaskResult::failure(
                    task.id, 
                    "No suitable agent available".to_string()
                );
                let _ = self.result_tx.send(result);
            }
        }
    }
    
    /// Find a suitable agent for a task
    async fn find_suitable_agent(&self, task: &Task) -> Option<Agent> {
        // For now, we'll use the task type to determine agent type
        let agent_type = match task.task_type.as_str() {
            "code-review" => AgentType::CodeReview,
            "testing" => AgentType::Testing,
            "documentation" => AgentType::Documentation,
            "refactoring" => AgentType::Refactoring,
            "security-scan" => AgentType::SecurityScan,
            "performance" => AgentType::Performance,
            "code-generation" => AgentType::CodeGeneration,
            _ => AgentType::General,
        };
        
        // Try to find an available agent of the required type
        self.registry.find_available(agent_type).await
    }
    
    /// Execute a task with a specific agent
    async fn execute_task_with_agent(
        task: Task,
        agent_id: AgentId,
        executor: Arc<TaskExecutor>,
    ) -> Result<TaskResult> {
        debug!("Executing task {} with agent {}", task.id, agent_id);
        
        // Submit task to executor and wait for completion
        executor.submit(task.clone()).await?;
        
        // Wait for task to complete with timeout
        let timeout = Duration::from_secs(300); // 5 minute timeout
        let start_time = std::time::Instant::now();
        
        loop {
            // Check if task is complete
            if let Some(task_state) = executor.get_status(task.id).await {
                match task_state.status {
                    TaskStatus::Completed => {
                        // Task completed successfully - convert Task to TaskResult
                        let result = TaskResult::success(
                            task_state.id,
                            task_state.message.map(serde_json::Value::String)
                        );
                        return Ok(result);
                    }
                    TaskStatus::Failed => {
                        // Task failed - convert Task to TaskResult
                        let error_msg = task_state.message.unwrap_or_else(|| "Task execution failed".to_string());
                        return Err(anyhow::anyhow!("{}", error_msg));
                    }
                    TaskStatus::Cancelled => {
                        // Task was cancelled
                        return Err(anyhow::anyhow!("Task was cancelled"));
                    }
                    _ => {
                        // Task is still running, check timeout
                        if start_time.elapsed() > timeout {
                            return Err(anyhow::anyhow!("Task execution timed out"));
                        }

                        // Wait a bit before checking again
                        tokio::time::sleep(Duration::from_millis(100)).await;
                    }
                }
            } else {
                return Err(anyhow::anyhow!("Task not found in executor"));
            }
        }
    }
    
    /// Handle task results
    async fn handle_results(&self) {
        let mut result_rx = self.result_rx.lock().await;
        while let Ok(result) = result_rx.try_recv() {
            debug!("Handling task result for: {}", result.task_id);

            // Log the result (executor manages its own task state internally)
            if result.success {
                info!("Task {} completed successfully", result.task_id);
            } else {
                error!("Task {} failed: {:?}", result.task_id, result.error);
            }
        }
    }
    
    /// Submit a task for background processing
    pub async fn submit_task(&self, task: Task) -> Result<TaskId> {
        let task_id = task.id;
        self.task_tx.send(task)
            .map_err(|e| anyhow::anyhow!("Failed to submit task: {}", e))?;
        Ok(task_id)
    }
    
    /// Get task result (non-blocking)
    pub async fn get_task_result(&self, task_id: TaskId) -> Option<TaskResult> {
        // Get task status from executor and convert to TaskResult
        if let Some(task_state) = self.executor.get_status(task_id).await {
            match task_state.status {
                TaskStatus::Completed => {
                    Some(TaskResult::success(
                        task_state.id,
                        task_state.message.map(serde_json::Value::String)
                    ))
                }
                TaskStatus::Failed => {
                    let error_msg = task_state.message.unwrap_or_else(|| "Task failed".to_string());
                    Some(TaskResult::failure(task_state.id, error_msg))
                }
                _ => None, // Task not yet completed
            }
        } else {
            None
        }
    }
    
    /// Check if processor is running
    pub async fn is_running(&self) -> bool {
        let running = self.running.lock().await;
        *running
    }
}

impl Clone for BackgroundTaskProcessor {
    fn clone(&self) -> Self {
        Self {
            registry: self.registry.clone(),
            executor: self.executor.clone(),
            task_tx: self.task_tx.clone(),
            task_rx: self.task_rx.clone(),
            result_tx: self.result_tx.clone(),
            result_rx: self.result_rx.clone(),
            running: self.running.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use claude_code_tasks::Task;

    #[tokio::test]
    async fn test_processor_creation() {
        let registry = Arc::new(AgentRegistry::new(5));
        let executor = Arc::new(TaskExecutor::new(5, 10));
        
        let processor = BackgroundTaskProcessor::new(registry, executor);
        assert!(!processor.is_running().await);
    }
    
    #[tokio::test]
    async fn test_submit_task() {
        let registry = Arc::new(AgentRegistry::new(5));
        let executor = Arc::new(TaskExecutor::new(5, 10));
        
        let processor = BackgroundTaskProcessor::new(registry, executor);
        
        let task = Task::new("test-task", "general");
        let task_id = processor.submit_task(task).await.unwrap();

        assert!(task_id.as_uuid().get_version().is_some());
    }
}