//! Agent System for Task Delegation
//!
//! This crate provides a comprehensive agent system for delegating and managing
//! background tasks with specialized agents.

pub mod background_processor;
pub mod delegation;
pub mod handler;
pub mod registry;
pub mod types;

pub use background_processor::BackgroundTaskProcessor;
pub use delegation::TaskDelegator;
pub use handler::AgentTaskHandler;
pub use registry::{AgentRegistry, RegistryStats};
pub use types::{Agent, AgentId, AgentRequest, AgentResult, AgentStatus, AgentType};
