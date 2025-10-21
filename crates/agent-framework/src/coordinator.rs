use std::collections::HashMap;

pub struct AgentCoordinator {
    agents: HashMap<String, Box<dyn crate::agent::Agent>>,
    #[allow(dead_code)]
    max_concurrent: u8,
}

impl AgentCoordinator {
    pub fn new(max_concurrent: u8) -> Self {
        AgentCoordinator {
            agents: HashMap::new(),
            max_concurrent,
        }
    }

    pub fn add_agent(&mut self, name: String, agent: Box<dyn crate::agent::Agent>) {
        self.agents.insert(name, agent);
    }

    pub fn execute_task(&self, task: &str) -> Result<String, ai_cli_utils::error::AIError> {
        // Find an appropriate agent for the task
        for (_name, agent) in &self.agents {
            if agent.can_handle(task) {
                return agent.execute(task);
            }
        }

        Err(ai_cli_utils::error::AIError::GenericError(
            "No suitable agent found for task".to_string(),
        ))
    }

    pub fn execute_parallel(
        &self,
        tasks: Vec<&str>,
    ) -> Result<Vec<String>, ai_cli_utils::error::AIError> {
        let mut results = Vec::new();

        for task in tasks {
            match self.execute_task(task) {
                Ok(result) => results.push(result),
                Err(e) => results.push(format!("Error: {}", e)),
            }
        }

        Ok(results)
    }
}
