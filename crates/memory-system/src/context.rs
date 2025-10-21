use std::collections::HashMap;

pub struct ContextManager {
    contexts: HashMap<String, String>,
    current_context: Option<String>,
}

impl Default for ContextManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ContextManager {
    pub fn new() -> Self {
        ContextManager {
            contexts: HashMap::new(),
            current_context: None,
        }
    }

    pub fn create_context(
        &mut self,
        name: String,
        content: String,
    ) -> Result<(), ai_cli_utils::error::AIError> {
        self.contexts.insert(name, content);
        Ok(())
    }

    pub fn switch_context(&mut self, name: &str) -> Result<(), ai_cli_utils::error::AIError> {
        if self.contexts.contains_key(name) {
            self.current_context = Some(name.to_string());
            Ok(())
        } else {
            Err(ai_cli_utils::error::AIError::GenericError(format!(
                "Context {} does not exist",
                name
            )))
        }
    }

    pub fn get_current_context(&self) -> Option<&String> {
        if let Some(ref name) = self.current_context {
            self.contexts.get(name)
        } else {
            None
        }
    }

    pub fn list_contexts(&self) -> Vec<String> {
        self.contexts.keys().cloned().collect()
    }
}
