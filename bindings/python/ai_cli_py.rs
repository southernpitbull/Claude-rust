//! Python bindings for AIrchitect CLI core components
//!
//! This module provides Python bindings using PyO3 to allow
//! Python plugins to interact with the Rust core components.

use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// Core AIrchitect CLI functionality exposed to Python
#[pymodule]
fn ai_cli_core(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<AIClient>()?;
    m.add_class::<ProjectMemory>()?;
    m.add_class::<Agent>()?;
    m.add_function(wrap_pyfunction!(initialize_system, m)?)?;
    Ok(())
}

/// AI Client for interacting with various AI providers
#[pyclass]
struct AIClient {
    provider: String,
    model: String,
}

#[pymethods]
impl AIClient {
    #[new]
    fn new(provider: String, model: String) -> Self {
        AIClient { provider, model }
    }

    /// Send a prompt to the AI provider
    fn send_prompt(&self, prompt: &str) -> PyResult<String> {
        // In a real implementation, this would call the Rust AI engine
        // For now, we'll return a simulated response
        Ok(format!("Response to: {}", prompt))
    }

    /// Get provider information
    fn get_provider_info(&self) -> PyResult<HashMap<String, String>> {
        let mut info = HashMap::new();
        info.insert("provider".to_string(), self.provider.clone());
        info.insert("model".to_string(), self.model.clone());
        Ok(info)
    }
}

/// Project Memory system for storing and retrieving context
#[pyclass]
struct ProjectMemory {
    project_id: String,
}

#[pymethods]
impl ProjectMemory {
    #[new]
    fn new(project_id: String) -> Self {
        ProjectMemory { project_id }
    }

    /// Store information in project memory
    fn store(&self, key: &str, value: &str) -> PyResult<bool> {
        // In a real implementation, this would store in the Rust memory system
        println!("Storing {} -> {} in project memory", key, value);
        Ok(true)
    }

    /// Retrieve information from project memory
    fn retrieve(&self, key: &str) -> PyResult<Option<String>> {
        // In a real implementation, this would retrieve from the Rust memory system
        println!("Retrieving {} from project memory", key);
        Ok(Some(format!("Value for {}", key)))
    }

    /// Search project memory
    fn search(&self, query: &str) -> PyResult<Vec<String>> {
        // In a real implementation, this would search the Rust memory system
        println!("Searching for '{}' in project memory", query);
        Ok(vec![
            format!("Result 1 for {}", query),
            format!("Result 2 for {}", query),
        ])
    }
}

/// Intelligent Agent for task execution
#[pyclass]
struct Agent {
    name: String,
    capabilities: Vec<String>,
}

#[pymethods]
impl Agent {
    #[new]
    fn new(name: String, capabilities: Vec<String>) -> Self {
        Agent { name, capabilities }
    }

    /// Execute a task with this agent
    fn execute_task(&self, task: &str) -> PyResult<String> {
        // In a real implementation, this would call the Rust agent framework
        Ok(format!("Agent {} executed task: {}", self.name, task))
    }

    /// Get agent information
    fn get_info(&self) -> PyResult<HashMap<String, PyObject>> {
        Python::with_gil(|py| {
            let mut info = HashMap::new();
            info.insert("name".to_string(), self.name.clone().into_py(py));
            
            let caps: Vec<PyObject> = self.capabilities
                .iter()
                .map(|c| c.clone().into_py(py))
                .collect();
            info.insert("capabilities".to_string(), caps.into_py(py));
            
            Ok(info)
        })
    }
}

/// Initialize the AIrchitect system
#[pyfunction]
fn initialize_system(config: &PyDict) -> PyResult<bool> {
    // Extract configuration values
    let debug_mode = config.get_item("debug")?.map_or(false, |v| v.is_true().unwrap_or(false));
    
    println!("Initializing AIrchitect system with debug={}", debug_mode);
    
    // In a real implementation, this would initialize the Rust core components
    Ok(true)
}

/// Convert Python dictionary to JSON value
fn py_dict_to_json(dict: &PyDict) -> PyResult<JsonValue> {
    let mut map = serde_json::Map::new();
    
    for (key, value) in dict.iter() {
        let key_str = key.downcast::<pyo3::types::PyString>()?.to_str()?;
        let json_value = py_to_json(value)?;
        map.insert(key_str.to_string(), json_value);
    }
    
    Ok(JsonValue::Object(map))
}

/// Convert Python object to JSON value
fn py_to_json(obj: &PyAny) -> PyResult<JsonValue> {
    if let Ok(s) = obj.downcast::<pyo3::types::PyString>() {
        Ok(JsonValue::String(s.to_str()?.to_string()))
    } else if let Ok(n) = obj.downcast::<pyo3::types::PyFloat>() {
        Ok(JsonValue::Number(serde_json::Number::from_f64(n.value()).unwrap()))
    } else if let Ok(n) = obj.downcast::<pyo3::types::PyInt>() {
        Ok(JsonValue::Number(serde_json::Number::from(n.extract::<i64>()?)))
    } else if let Ok(b) = obj.downcast::<pyo3::types::PyBool>() {
        Ok(JsonValue::Bool(b.is_true()))
    } else if let Ok(d) = obj.downcast::<pyo3::types::PyDict>() {
        py_dict_to_json(d)
    } else if let Ok(l) = obj.downcast::<pyo3::types::PyList>() {
        let mut arr = Vec::new();
        for item in l.iter() {
            arr.push(py_to_json(item)?);
        }
        Ok(JsonValue::Array(arr))
    } else {
        Ok(JsonValue::Null)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pyo3::types::PyDict;

    #[test]
    fn test_ai_client() {
        Python::with_gil(|py| {
            let client = AIClient::new("test".to_string(), "model".to_string());
            assert_eq!(client.provider, "test");
            assert_eq!(client.model, "model");
        });
    }

    #[test]
    fn test_project_memory() {
        Python::with_gil(|py| {
            let memory = ProjectMemory::new("test-project".to_string());
            assert_eq!(memory.project_id, "test-project");
        });
    }

    #[test]
    fn test_agent() {
        Python::with_gil(|py| {
            let capabilities = vec!["planning".to_string(), "coding".to_string()];
            let agent = Agent::new("test-agent".to_string(), capabilities.clone());
            assert_eq!(agent.name, "test-agent");
            assert_eq!(agent.capabilities, capabilities);
        });
    }
}