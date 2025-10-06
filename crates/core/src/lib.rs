pub mod circuit_breaker;
pub mod codebase;
pub mod checkpoint;
pub mod commands;
pub mod config;
pub mod error;
pub mod execution;
pub mod fileops;
pub mod git_conventional;
pub mod retry;
pub mod session;
pub mod types;
pub mod version;

// Re-export primary error types for convenience
pub use error::{AppError, AppResult, ErrorCategory, ErrorContext};

// Re-export circuit breaker types
pub use circuit_breaker::{CircuitBreaker, CircuitBreakerConfig, CircuitState};

// Re-export codebase analysis types
pub use codebase::{AnalysisResult, CodeAnalyzer, CodeFile, CodebaseError, CodebaseResult,
                   CodebaseScanner, CodebaseStatistics, Dependency, DependencyKind, Function,
                   ScannerConfig, Symbol, SymbolKind, Class, CodeMetrics, CodebaseIndex, IndexEntry};

// Re-export command execution types
pub use execution::{CommandError, CommandExecutor, CommandOptions, CommandOutput};

// Re-export file operations
pub use fileops::{FileError, FileOps, FileOptions, FileResult};

// Re-export retry utilities
pub use retry::{retry, retry_exponential, retry_fixed, retry_with_policy, RetryPolicy};

// Re-export session management types
pub use session::{Session, SessionConfig, SessionMetadata, SessionStore};

// Re-export checkpoint types
pub use checkpoint::{Checkpoint, CheckpointInfo, CheckpointStore, RestoredCheckpoint};

// Re-export git conventional commits types
pub use git_conventional::{CommitType, ConventionalCommit, validate_commit_message};

// Re-export version management
pub use version::{VersionInfo, VersionCheckCache, fetch_latest_version, is_newer_version, VERSION};
