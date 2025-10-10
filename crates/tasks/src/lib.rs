//! Background Tasks and Subagent System
//!
//! This module provides a task execution system for running background
//! operations and managing concurrent work.

pub mod executor;
pub mod queue;
pub mod types;

pub use executor::TaskExecutor;
pub use queue::TaskQueue;
pub use types::{Task, TaskId, TaskStatus, TaskResult, TaskPriority};

use anyhow::Result;

/// Initialize tasks subsystem
pub fn init() -> Result<()> {
    tracing::debug!("Initializing tasks subsystem");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        assert!(init().is_ok());
    }
}
