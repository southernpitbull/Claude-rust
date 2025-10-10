//! Task Delegation System

use anyhow::Result;
use async_channel::{unbounded, Receiver, Sender};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use claude_code_tasks::{Task, TaskExecutor, TaskId};

use crate::handler::AgentTaskHandler;
use crate::registry::AgentRegistry;
use crate::types::{Agent, AgentRequest, AgentResult, AgentType};

/// Task delegation coordinator
pub struct TaskDelegator {
    /// Agent registry
    registry: Arc<AgentRegistry>,

    /// Task executor
    executor: Arc<TaskExecutor>,

    /// Pending requests
    pending: Arc<Mutex<Vec<AgentRequest>>>,

    /// Request channel
    request_tx: Sender<AgentRequest>,
    request_rx: Receiver<AgentRequest>,

    /// Result channel
    result_tx: Sender<AgentResult>,
    result_rx: Receiver<AgentResult>,

    /// Shutdown signal
    shutdown_tx: Sender<()>,
    shutdown_rx: Receiver<()>,
}

impl TaskDelegator {
    /// Create a new task delegator
    pub fn new(registry: Arc<AgentRegistry>, executor: Arc<TaskExecutor>) -> Self {
        let (request_tx, request_rx) = unbounded();
        let (result_tx, result_rx) = unbounded();
        let (shutdown_tx, shutdown_rx) = unbounded();

        Self {
            registry,
            executor,
            pending: Arc::new(Mutex::new(Vec::new())),
            request_tx,
            request_rx,
            result_tx,
            result_rx,
            shutdown_tx,
            shutdown_rx,
        }
    }

    /// Delegate task to an agent
    pub async fn delegate(
        &self,
        agent_type: AgentType,
        task: Task,
        required_capabilities: Vec<String>,
    ) -> Result<TaskId> {
        let task_id = task.id;

        // Submit task to executor
        self.executor.submit(task).await?;

        // Create delegation request
        let request = AgentRequest::new(agent_type, task_id, required_capabilities);

        info!(
            "Delegating task {} to {} agent",
            task_id, agent_type
        );

        // Queue request
        self.pending.lock().await.push(request.clone());
        self.request_tx.send(request).await?;

        Ok(task_id)
    }

    /// Start delegation loop
    pub async fn start(&self) {
        info!("Starting task delegator");

        loop {
            tokio::select! {
                _ = self.shutdown_rx.recv() => {
                    info!("Task delegator shutting down");
                    break;
                }
                Ok(request) = self.request_rx.recv() => {
                    self.process_request(request).await;
                }
                Ok(result) = self.result_rx.recv() => {
                    self.process_result(result).await;
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                    self.process_pending().await;
                }
            }
        }
    }

    /// Process delegation request
    async fn process_request(&self, request: AgentRequest) {
        debug!("Processing delegation request: {:?}", request.id);

        // Try to find available agent
        let agent = if request.required_capabilities.is_empty() {
            self.registry.find_available(request.agent_type).await
        } else {
            self.registry
                .find_with_capabilities(request.agent_type, &request.required_capabilities)
                .await
        };

        if let Some(mut agent) = agent {
            // Assign task to agent
            agent.mark_busy(request.task_id);

            let agent_name = agent.name.clone();

            // Register agent handler with executor
            let handler = Arc::new(AgentTaskHandler::new(agent.clone()));
            self.executor.register_handler(handler).await;

            // Update registry
            self.registry.update(agent).await;

            // Remove from pending
            let mut pending = self.pending.lock().await;
            pending.retain(|r| r.id != request.id);

            info!(
                "Assigned task {} to agent {}",
                request.task_id, agent_name
            );
        } else {
            warn!(
                "No available {} agent for task {}",
                request.agent_type, request.task_id
            );
        }
    }

    /// Process agent result
    async fn process_result(&self, result: AgentResult) {
        debug!("Processing agent result for task: {}", result.task_id);

        // Update agent status
        if let Some(mut agent) = self.registry.get(result.agent_id).await {
            if result.success {
                agent.task_completed();
            } else {
                agent.task_failed();
            }
            self.registry.update(agent).await;
        }
    }

    /// Process pending requests
    async fn process_pending(&self) {
        let pending = self.pending.lock().await;

        if pending.is_empty() {
            return;
        }

        debug!("Processing {} pending delegation requests", pending.len());

        // Clone pending requests to process
        let requests: Vec<_> = pending.clone();
        drop(pending);

        for request in requests {
            // Try to assign again
            self.process_request(request).await;
        }
    }

    /// Submit agent result
    pub async fn submit_result(&self, result: AgentResult) -> Result<()> {
        self.result_tx.send(result).await?;
        Ok(())
    }

    /// Get pending request count
    pub async fn pending_count(&self) -> usize {
        self.pending.lock().await.len()
    }

    /// Shutdown delegator
    pub async fn shutdown(&self) {
        info!("Shutting down task delegator");
        let _ = self.shutdown_tx.send(()).await;
    }

    /// Helper to clone for async tasks
    fn clone_for_task(&self) -> Self {
        Self {
            registry: self.registry.clone(),
            executor: self.executor.clone(),
            pending: self.pending.clone(),
            request_tx: self.request_tx.clone(),
            request_rx: self.request_rx.clone(),
            result_tx: self.result_tx.clone(),
            result_rx: self.result_rx.clone(),
            shutdown_tx: self.shutdown_tx.clone(),
            shutdown_rx: self.shutdown_rx.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Agent, AgentType};

    #[tokio::test]
    async fn test_delegate_task() {
        let registry = Arc::new(AgentRegistry::new(5));
        let executor = Arc::new(TaskExecutor::new(5, 10));

        // Register an agent
        let agent = Agent::new(AgentType::General, "test-agent");
        registry.register(agent).await.unwrap();

        let delegator = TaskDelegator::new(registry, executor);

        let task = Task::new("test-task", "general");
        let task_id = delegator
            .delegate(AgentType::General, task, vec![])
            .await
            .unwrap();

        assert!(task_id.as_uuid().get_version().is_some());
    }
}
