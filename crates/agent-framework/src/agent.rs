use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub max_iterations: u32,
}

pub trait Agent: Send + Sync {
    fn get_config(&self) -> &AgentConfig;
    fn execute(&self, input: &str) -> Result<String, ai_cli_utils::error::AIError>;
    fn can_handle(&self, task: &str) -> bool;
}

pub struct SimpleAgent {
    config: AgentConfig,
}

impl SimpleAgent {
    pub fn new(config: AgentConfig) -> Self {
        SimpleAgent { config }
    }
}

impl Agent for SimpleAgent {
    fn get_config(&self) -> &AgentConfig {
        &self.config
    }

    fn execute(&self, input: &str) -> Result<String, ai_cli_utils::error::AIError> {
        // Placeholder implementation
        Ok(format!(
            "Agent {} executed task: {}",
            self.config.name, input
        ))
    }

    fn can_handle(&self, _task: &str) -> bool {
        // Placeholder implementation
        true
    }
}
