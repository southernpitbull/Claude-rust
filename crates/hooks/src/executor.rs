//! Hook Executor

use anyhow::{bail, Result};
use async_trait::async_trait;
use std::collections::HashMap;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tracing::{debug, error, info, warn};

use crate::config::{HookConfig, HooksConfig};
use crate::types::{HookContext, HookPoint, HookResult, HookType};

/// Hook executor trait
#[async_trait]
pub trait Hook: Send + Sync {
    /// Execute the hook
    async fn execute(&self, context: &HookContext) -> Result<HookResult>;
}

/// Shell command hook
pub struct ShellHook {
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: HashMap<String, String>,
    timeout: Duration,
}

impl ShellHook {
    /// Create a new shell hook
    pub fn new(
        command: String,
        args: Vec<String>,
        cwd: Option<String>,
        env: HashMap<String, String>,
        timeout: Duration,
    ) -> Self {
        Self {
            command,
            args,
            cwd,
            env,
            timeout,
        }
    }
}

#[async_trait]
impl Hook for ShellHook {
    async fn execute(&self, context: &HookContext) -> Result<HookResult> {
        debug!("Executing shell hook: {} {:?}", self.command, self.args);

        // Build command
        let mut cmd = Command::new(&self.command);
        cmd.args(&self.args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set working directory
        if let Some(ref cwd) = self.cwd {
            cmd.current_dir(cwd);
        }

        // Add environment variables
        for (key, value) in &self.env {
            cmd.env(key, value);
        }

        // Add context as environment variables
        cmd.env("HOOK_POINT", context.point.name());
        if let Ok(context_json) = serde_json::to_string(&context.data) {
            cmd.env("HOOK_CONTEXT", context_json);
        }

        // Execute with timeout
        let output = tokio::time::timeout(self.timeout, cmd.output()).await;

        match output {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);

                Ok(HookResult {
                    success: output.status.success(),
                    output: if !stdout.is_empty() {
                        Some(stdout)
                    } else {
                        None
                    },
                    error: if !stderr.is_empty() {
                        Some(stderr)
                    } else {
                        None
                    },
                    exit_code: Some(exit_code),
                    block: false,
                    message: None,
                })
            }
            Ok(Err(e)) => {
                error!("Failed to execute shell hook: {}", e);
                Ok(HookResult::failure(format!("Failed to execute: {}", e)))
            }
            Err(_) => {
                warn!("Shell hook timed out after {:?}", self.timeout);
                Ok(HookResult::failure("Hook execution timed out"))
            }
        }
    }
}

/// JavaScript hook (using Node.js)
pub struct JavaScriptHook {
    script: String,
    is_file: bool,
    timeout: Duration,
}

impl JavaScriptHook {
    /// Create a new JavaScript hook
    pub fn new(script: String, is_file: bool, timeout: Duration) -> Self {
        Self {
            script,
            is_file,
            timeout,
        }
    }
}

#[async_trait]
impl Hook for JavaScriptHook {
    async fn execute(&self, context: &HookContext) -> Result<HookResult> {
        debug!("Executing JavaScript hook");

        // Check if Node.js is available
        let node_check = Command::new("node")
            .arg("--version")
            .output()
            .await;

        if node_check.is_err() {
            return Ok(HookResult::failure(
                "Node.js not found. Please install Node.js to use JavaScript hooks.",
            ));
        }

        // Prepare script
        let script_content = if self.is_file {
            // Load script from file
            match tokio::fs::read_to_string(&self.script).await {
                Ok(content) => content,
                Err(e) => {
                    return Ok(HookResult::failure(format!(
                        "Failed to read script file: {}",
                        e
                    )));
                }
            }
        } else {
            self.script.clone()
        };

        // Inject context access via process.env.HOOK_CONTEXT
        let context_json = serde_json::to_string(&context.data)
            .unwrap_or_else(|_| "{}".to_string());

        // Build Node.js command
        let mut cmd = Command::new("node");
        cmd.arg("--eval")
            .arg(&script_content)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("HOOK_POINT", context.point.name())
            .env("HOOK_CONTEXT", context_json);

        // Execute with timeout
        let output = tokio::time::timeout(self.timeout, cmd.output()).await;

        match output {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);

                Ok(HookResult {
                    success: output.status.success(),
                    output: if !stdout.is_empty() {
                        Some(stdout)
                    } else {
                        None
                    },
                    error: if !stderr.is_empty() {
                        Some(stderr)
                    } else {
                        None
                    },
                    exit_code: Some(exit_code),
                    block: false,
                    message: None,
                })
            }
            Ok(Err(e)) => {
                error!("Failed to execute JavaScript hook: {}", e);
                Ok(HookResult::failure(format!("Failed to execute: {}", e)))
            }
            Err(_) => {
                warn!("JavaScript hook timed out after {:?}", self.timeout);
                Ok(HookResult::failure("Hook execution timed out"))
            }
        }
    }
}

/// Python hook
pub struct PythonHook {
    script: String,
    is_file: bool,
    timeout: Duration,
}

impl PythonHook {
    /// Create a new Python hook
    pub fn new(script: String, is_file: bool, timeout: Duration) -> Self {
        Self {
            script,
            is_file,
            timeout,
        }
    }

    /// Find Python executable (tries python3, python, py in order)
    async fn find_python() -> Option<String> {
        for python_cmd in &["python3", "python", "py"] {
            let check = Command::new(python_cmd)
                .arg("--version")
                .output()
                .await;

            if check.is_ok() {
                return Some(python_cmd.to_string());
            }
        }
        None
    }
}

#[async_trait]
impl Hook for PythonHook {
    async fn execute(&self, context: &HookContext) -> Result<HookResult> {
        debug!("Executing Python hook");

        // Find Python executable
        let python_cmd = match Self::find_python().await {
            Some(cmd) => cmd,
            None => {
                return Ok(HookResult::failure(
                    "Python not found. Please install Python to use Python hooks.",
                ));
            }
        };

        // Prepare script
        let script_content = if self.is_file {
            // Load script from file
            match tokio::fs::read_to_string(&self.script).await {
                Ok(content) => content,
                Err(e) => {
                    return Ok(HookResult::failure(format!(
                        "Failed to read script file: {}",
                        e
                    )));
                }
            }
        } else {
            // Inline script - add context access helper
            format!(
                r#"import os
import json
import sys

# Hook context helper
HOOK_POINT = os.environ.get('HOOK_POINT', '')
try:
    HOOK_CONTEXT = json.loads(os.environ.get('HOOK_CONTEXT', '{{}}'))
except:
    HOOK_CONTEXT = {{}}

# User script
{}
"#,
                self.script
            )
        };

        // Build Python command
        let context_json = serde_json::to_string(&context.data)
            .unwrap_or_else(|_| "{}".to_string());

        let mut cmd = Command::new(&python_cmd);
        cmd.arg("-c")
            .arg(&script_content)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("HOOK_POINT", context.point.name())
            .env("HOOK_CONTEXT", context_json);

        // Execute with timeout
        let output = tokio::time::timeout(self.timeout, cmd.output()).await;

        match output {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);

                Ok(HookResult {
                    success: output.status.success(),
                    output: if !stdout.is_empty() {
                        Some(stdout)
                    } else {
                        None
                    },
                    error: if !stderr.is_empty() {
                        Some(stderr)
                    } else {
                        None
                    },
                    exit_code: Some(exit_code),
                    block: false,
                    message: None,
                })
            }
            Ok(Err(e)) => {
                error!("Failed to execute Python hook: {}", e);
                Ok(HookResult::failure(format!("Failed to execute: {}", e)))
            }
            Err(_) => {
                warn!("Python hook timed out after {:?}", self.timeout);
                Ok(HookResult::failure("Hook execution timed out"))
            }
        }
    }
}

/// Hook executor
pub struct HookExecutor {
    config: HooksConfig,
}

impl HookExecutor {
    /// Create a new hook executor
    pub fn new(config: HooksConfig) -> Self {
        Self { config }
    }

    /// Load executor from config file
    pub fn from_file(path: &std::path::PathBuf) -> Result<Self> {
        let config = HooksConfig::load(path)?;
        Ok(Self::new(config))
    }

    /// Execute hooks for a specific point
    pub async fn execute_hooks(
        &self,
        point: HookPoint,
        context: HookContext,
    ) -> Result<Vec<HookResult>> {
        if !self.config.settings.enabled {
            debug!("Hooks globally disabled, skipping");
            return Ok(vec![]);
        }

        let hooks = self.config.hooks_for_point(point);
        if hooks.is_empty() {
            debug!("No hooks configured for point: {:?}", point);
            return Ok(vec![]);
        }

        info!(
            "Executing {} hook(s) for point: {:?}",
            hooks.len(),
            point
        );

        let mut results = Vec::new();

        for hook_config in hooks {
            debug!("Executing hook: {}", hook_config.name);

            let result = self.execute_single_hook(hook_config, &context).await;

            match result {
                Ok(hook_result) => {
                    if !hook_result.success {
                        warn!("Hook '{}' failed: {:?}", hook_config.name, hook_result.error);

                        if hook_config.blocking {
                            error!("Blocking hook '{}' failed, operation blocked", hook_config.name);
                            results.push(hook_result);
                            return Ok(results);
                        }

                        if !self.config.settings.continue_on_failure {
                            error!("Hook '{}' failed and continue_on_failure is false", hook_config.name);
                            results.push(hook_result);
                            return Ok(results);
                        }
                    } else {
                        debug!("Hook '{}' succeeded", hook_config.name);
                    }

                    results.push(hook_result);
                }
                Err(e) => {
                    error!("Error executing hook '{}': {}", hook_config.name, e);

                    if hook_config.blocking || !self.config.settings.continue_on_failure {
                        bail!("Hook '{}' failed: {}", hook_config.name, e);
                    }

                    results.push(HookResult::failure(format!("Hook error: {}", e)));
                }
            }
        }

        Ok(results)
    }

    /// Execute a single hook
    async fn execute_single_hook(
        &self,
        hook_config: &HookConfig,
        context: &HookContext,
    ) -> Result<HookResult> {
        let timeout = Duration::from_secs(hook_config.timeout);

        match &hook_config.hook_type {
            HookType::Shell {
                command,
                args,
                cwd,
                env,
            } => {
                let hook = ShellHook::new(
                    command.clone(),
                    args.clone(),
                    cwd.clone(),
                    env.clone(),
                    timeout,
                );
                hook.execute(context).await
            }
            HookType::JavaScript { script, is_file } => {
                let hook = JavaScriptHook::new(
                    script.clone(),
                    *is_file,
                    timeout,
                );
                hook.execute(context).await
            }
            HookType::Python { script, is_file } => {
                let hook = PythonHook::new(
                    script.clone(),
                    *is_file,
                    timeout,
                );
                hook.execute(context).await
            }
        }
    }

    /// Check if any hooks would block an operation
    pub fn would_block(&self, point: HookPoint) -> bool {
        self.config
            .hooks_for_point(point)
            .iter()
            .any(|h| h.blocking)
    }

    /// Get hook configuration
    pub fn config(&self) -> &HooksConfig {
        &self.config
    }

    /// Get mutable hook configuration
    pub fn config_mut(&mut self) -> &mut HooksConfig {
        &mut self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shell_hook_success() {
        let hook = ShellHook::new(
            "echo".to_string(),
            vec!["test".to_string()],
            None,
            HashMap::new(),
            Duration::from_secs(5),
        );

        let context = HookContext::new(HookPoint::SessionStart);
        let result = hook.execute(&context).await.unwrap();

        assert!(result.success);
        assert!(result.output.is_some());
    }

    #[tokio::test]
    async fn test_shell_hook_failure() {
        let hook = ShellHook::new(
            "false".to_string(),
            vec![],
            None,
            HashMap::new(),
            Duration::from_secs(5),
        );

        let context = HookContext::new(HookPoint::SessionStart);
        let result = hook.execute(&context).await.unwrap();

        assert!(!result.success);
    }
}
