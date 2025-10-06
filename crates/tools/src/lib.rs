//! Tool System
//!
//! Provides tool registry and execution system for Claude Code

pub mod registry;
pub mod tool;
pub mod executor;
pub mod builtin;

pub use registry::{ToolRegistry, ToolRegistryError};
pub use tool::{Tool, ToolDefinition, ToolParameter, ToolParameterType, ToolCategory};
pub use executor::{ToolExecutor, ToolExecutionResult, ToolPermissions};
pub use builtin::{register_builtin_tools, FileReadTool, FileWriteTool, FileEditTool, BashTool, WebSearchTool};
