//! Hooks System for Claude-Rust
//!
//! This module provides a flexible hooks system that allows executing
//! custom code at specific points in the application lifecycle.

pub mod config;
pub mod executor;
pub mod types;

pub use config::{HookConfig, HooksConfig};
pub use executor::HookExecutor;
pub use types::{HookPoint, HookType, HookContext, HookResult};

use anyhow::Result;

/// Initialize hooks subsystem
pub fn init() -> Result<()> {
    tracing::debug!("Initializing hooks subsystem");
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
