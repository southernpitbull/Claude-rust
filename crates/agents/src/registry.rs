//! Agent Registry

use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::types::{Agent, AgentId, AgentType, AgentStatus};

/// Agent registry for managing agents
pub struct AgentRegistry {
    /// Registered agents by ID
    agents: Arc<Mutex<HashMap<AgentId, Agent>>>,

    /// Agents by type for quick lookup
    agents_by_type: Arc<Mutex<HashMap<AgentType, Vec<AgentId>>>>,

    /// Maximum agents per type
    max_per_type: usize,
}

impl AgentRegistry {
    /// Create a new agent registry
    pub fn new(max_per_type: usize) -> Self {
        Self {
            agents: Arc::new(Mutex::new(HashMap::new())),
            agents_by_type: Arc::new(Mutex::new(HashMap::new())),
            max_per_type,
        }
    }

    /// Register a new agent
    pub async fn register(&self, agent: Agent) -> Result<AgentId> {
        let mut agents = self.agents.lock().await;
        let mut by_type = self.agents_by_type.lock().await;

        // Check if we've reached the limit for this type
        let type_agents = by_type.entry(agent.agent_type).or_insert_with(Vec::new);
        if type_agents.len() >= self.max_per_type {
            anyhow::bail!(
                "Maximum number of {} agents reached ({})",
                agent.agent_type,
                self.max_per_type
            );
        }

        let agent_id = agent.id;
        info!(
            "Registering agent: {} ({}) - {}",
            agent.name, agent.agent_type, agent_id
        );

        type_agents.push(agent_id);
        agents.insert(agent_id, agent);

        Ok(agent_id)
    }

    /// Unregister an agent
    pub async fn unregister(&self, agent_id: AgentId) -> Result<()> {
        let mut agents = self.agents.lock().await;
        let mut by_type = self.agents_by_type.lock().await;

        if let Some(agent) = agents.remove(&agent_id) {
            info!(
                "Unregistering agent: {} ({}) - {}",
                agent.name, agent.agent_type, agent_id
            );

            // Remove from type index
            if let Some(type_agents) = by_type.get_mut(&agent.agent_type) {
                type_agents.retain(|&id| id != agent_id);
            }

            Ok(())
        } else {
            anyhow::bail!("Agent not found: {}", agent_id)
        }
    }

    /// Get agent by ID
    pub async fn get(&self, agent_id: AgentId) -> Option<Agent> {
        let agents = self.agents.lock().await;
        agents.get(&agent_id).cloned()
    }

    /// Update agent
    pub async fn update(&self, agent: Agent) {
        let mut agents = self.agents.lock().await;
        agents.insert(agent.id, agent);
    }

    /// List all agents
    pub async fn list(&self) -> Vec<Agent> {
        let agents = self.agents.lock().await;
        agents.values().cloned().collect()
    }

    /// List agents by type
    pub async fn list_by_type(&self, agent_type: AgentType) -> Vec<Agent> {
        let agents = self.agents.lock().await;
        let by_type = self.agents_by_type.lock().await;

        if let Some(type_agents) = by_type.get(&agent_type) {
            type_agents
                .iter()
                .filter_map(|id| agents.get(id).cloned())
                .collect()
        } else {
            Vec::new()
        }
    }

    /// List agents by status
    pub async fn list_by_status(&self, status: AgentStatus) -> Vec<Agent> {
        let agents = self.agents.lock().await;
        agents
            .values()
            .filter(|a| a.status == status)
            .cloned()
            .collect()
    }

    /// Find available agent of type
    pub async fn find_available(&self, agent_type: AgentType) -> Option<Agent> {
        let agents = self.agents.lock().await;
        let by_type = self.agents_by_type.lock().await;

        if let Some(type_agents) = by_type.get(&agent_type) {
            for agent_id in type_agents {
                if let Some(agent) = agents.get(agent_id) {
                    if agent.is_available() {
                        return Some(agent.clone());
                    }
                }
            }
        }

        None
    }

    /// Find available agent with capabilities
    pub async fn find_with_capabilities(
        &self,
        agent_type: AgentType,
        required_capabilities: &[String],
    ) -> Option<Agent> {
        let agents = self.agents.lock().await;
        let by_type = self.agents_by_type.lock().await;

        if let Some(type_agents) = by_type.get(&agent_type) {
            for agent_id in type_agents {
                if let Some(agent) = agents.get(agent_id) {
                    if agent.is_available() {
                        // Check if agent has all required capabilities
                        let has_all = required_capabilities
                            .iter()
                            .all(|cap| agent.capabilities.contains(cap));

                        if has_all {
                            return Some(agent.clone());
                        }
                    }
                }
            }
        }

        debug!(
            "No available {} agent found with capabilities: {:?}",
            agent_type, required_capabilities
        );
        None
    }

    /// Get agent count
    pub async fn count(&self) -> usize {
        let agents = self.agents.lock().await;
        agents.len()
    }

    /// Get agent count by type
    pub async fn count_by_type(&self, agent_type: AgentType) -> usize {
        let by_type = self.agents_by_type.lock().await;
        by_type.get(&agent_type).map(|v| v.len()).unwrap_or(0)
    }

    /// Get statistics
    pub async fn stats(&self) -> RegistryStats {
        let agents = self.agents.lock().await;

        let mut stats = RegistryStats {
            total: agents.len(),
            idle: 0,
            busy: 0,
            paused: 0,
            error: 0,
            stopped: 0,
            total_completed: 0,
            total_failed: 0,
        };

        for agent in agents.values() {
            match agent.status {
                AgentStatus::Idle => stats.idle += 1,
                AgentStatus::Busy => stats.busy += 1,
                AgentStatus::Paused => stats.paused += 1,
                AgentStatus::Error => stats.error += 1,
                AgentStatus::Stopped => stats.stopped += 1,
            }
            stats.total_completed += agent.tasks_completed;
            stats.total_failed += agent.tasks_failed;
        }

        stats
    }
}

/// Registry statistics
#[derive(Debug, Clone)]
pub struct RegistryStats {
    pub total: usize,
    pub idle: usize,
    pub busy: usize,
    pub paused: usize,
    pub error: usize,
    pub stopped: usize,
    pub total_completed: u64,
    pub total_failed: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::AgentType;

    #[tokio::test]
    async fn test_register_agent() {
        let registry = AgentRegistry::new(5);
        let agent = Agent::new(AgentType::General, "test-agent");

        let agent_id = registry.register(agent).await.unwrap();
        assert_eq!(registry.count().await, 1);

        let retrieved = registry.get(agent_id).await.unwrap();
        assert_eq!(retrieved.name, "test-agent");
    }

    #[tokio::test]
    async fn test_find_available() {
        let registry = AgentRegistry::new(5);
        let agent = Agent::new(AgentType::CodeReview, "reviewer");

        registry.register(agent).await.unwrap();

        let found = registry.find_available(AgentType::CodeReview).await;
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "reviewer");
    }

    #[tokio::test]
    async fn test_max_per_type() {
        let registry = AgentRegistry::new(2);

        registry
            .register(Agent::new(AgentType::Testing, "test1"))
            .await
            .unwrap();
        registry
            .register(Agent::new(AgentType::Testing, "test2"))
            .await
            .unwrap();

        let result = registry
            .register(Agent::new(AgentType::Testing, "test3"))
            .await;
        assert!(result.is_err());
    }
}
