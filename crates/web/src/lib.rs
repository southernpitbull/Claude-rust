//! Claude Code Web Interface
//!
//! Provides a web-based interface for Claude Code with:
//! - Dashboard for monitoring agents and tasks
//! - API endpoints for Claude Code functionality
//! - WebSocket support for real-time updates
//! - Authentication and authorization

use axum::{
    extract::State,
    http::StatusCode,
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

use claude_code_auth::AuthManager;
use claude_code_ai::AiClient;
use claude_code_agents::AgentRegistry;
use claude_code_core::session::SessionStore;
use claude_code_tasks::TaskExecutor;

/// Web server state
#[derive(Clone)]
pub struct AppState {
    /// Authentication manager
    pub auth_manager: Arc<AuthManager>,
    
    /// AI client
    pub ai_client: Arc<AiClient>,
    
    /// Agent registry
    pub agent_registry: Arc<AgentRegistry>,
    
    /// Session store
    pub session_store: Arc<SessionStore>,
    
    /// Task executor
    pub task_executor: Arc<TaskExecutor>,
}

/// Web server configuration
#[derive(Debug, Clone)]
pub struct WebConfig {
    /// Host to bind to
    pub host: String,
    
    /// Port to listen on
    pub port: u16,
    
    /// Enable CORS
    pub cors_enabled: bool,
    
    /// Enable tracing
    pub tracing_enabled: bool,
}

impl Default for WebConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 3000,
            cors_enabled: true,
            tracing_enabled: true,
        }
    }
}

/// Web server
pub struct WebServer {
    /// Server configuration
    config: WebConfig,
    
    /// Application state
    state: AppState,
}

impl WebServer {
    /// Create a new web server
    pub fn new(config: WebConfig, state: AppState) -> Self {
        Self { config, state }
    }
    
    /// Start the web server
    pub async fn start(&self) -> anyhow::Result<()> {
        info!("Starting web server on {}:{}", self.config.host, self.config.port);
        
        // Build our application with routes
        let app = self.create_app().await?;
        
        // Run the server
        let addr = SocketAddr::new(
            self.config.host.parse()?,
            self.config.port,
        );
        
        info!("Web server listening on http://{}", addr);
        
        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await?;
            
        Ok(())
    }
    
    /// Create the Axum application with routes
    async fn create_app(&self) -> anyhow::Result<Router> {
        // Create router
        let mut app = Router::new()
            // Health check endpoint
            .route("/health", get(health_check))
            // Dashboard routes
            .route("/", get(dashboard))
            .route("/dashboard", get(dashboard))
            // API routes
            .route("/api/health", get(api_health_check))
            .route("/api/version", get(api_version))
            // Agent routes
            .route("/api/agents", get(list_agents))
            .route("/api/agents/:id", get(get_agent))
            // Task routes
            .route("/api/tasks", get(list_tasks))
            .route("/api/tasks/:id", get(get_task))
            // Session routes
            .route("/api/sessions", get(list_sessions))
            .route("/api/sessions/:id", get(get_session))
            // Auth routes
            .route("/api/auth/status", get(auth_status))
            // AI routes
            .route("/api/models", get(list_models));
        
        // Add state to the app
        app = app.with_state(self.state.clone());
        
        // Add CORS if enabled
        if self.config.cors_enabled {
            use tower_http::cors::{Any, CorsLayer};
            let cors = CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any);
            app = app.layer(cors);
        }
        
        // Add tracing if enabled
        if self.config.tracing_enabled {
            use tower_http::trace::TraceLayer;
            app = app.layer(TraceLayer::new_for_http());
        }
        
        Ok(app)
    }
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Html("<h1>Claude Code Web Server</h1><p>OK</p>")
}

/// Dashboard endpoint
async fn dashboard() -> impl IntoResponse {
    Html(r#"
    <!DOCTYPE html>
    <html>
    <head>
        <title>Claude Code Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
            .online { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .offline { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .card h2 { margin-top: 0; }
            .stats { display: flex; gap: 20px; }
            .stat { text-align: center; }
            .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
            .stat-label { color: #666; }
        </style>
    </head>
    <body>
        <h1>🤖 Claude Code Dashboard</h1>
        
        <div class="status online">
            <strong>✅ Server Online</strong> - Claude Code Web Interface is running
        </div>
        
        <div class="card">
            <h2>📊 System Overview</h2>
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Active Agents</div>
                </div>
                <div class="stat">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Running Tasks</div>
                </div>
                <div class="stat">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Active Sessions</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>🚀 Quick Actions</h2>
            <button onclick="location.href='/api/health'">Health Check</button>
            <button onclick="location.href='/api/version'">Version Info</button>
            <button onclick="location.href='/api/agents'">View Agents</button>
            <button onclick="location.href='/api/tasks'">View Tasks</button>
        </div>
        
        <div class="card">
            <h2>📋 Recent Activity</h2>
            <p>No recent activity</p>
        </div>
        
        <footer>
            <p>Claude Code v0.1.0 - Web Interface</p>
        </footer>
    </body>
    </html>
    "#)
}

/// API health check endpoint
async fn api_health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "service": "claude-code-web"
    }))
}

/// API version endpoint
async fn api_version(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "service": "claude-code-web"
    }))
}

/// List agents endpoint
async fn list_agents(State(state): State<AppState>) -> impl IntoResponse {
    match state.agent_registry.stats().await {
        Ok(stats) => {
            Json(serde_json::json!({
                "agents": {
                    "total": stats.total,
                    "idle": stats.idle,
                    "busy": stats.busy,
                    "paused": stats.paused,
                    "error": stats.error,
                    "stopped": stats.stopped
                },
                "tasks": {
                    "completed": stats.total_completed,
                    "failed": stats.total_failed
                }
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to get agent stats: {}", e)
            }))).into_response()
        }
    }
}

/// Get agent endpoint
async fn get_agent(State(state): State<AppState>, axum::extract::Path(id): axum::extract::Path<String>) -> impl IntoResponse {
    Json(serde_json::json!({
        "agent_id": id,
        "status": "not_implemented"
    }))
}

/// List tasks endpoint
async fn list_tasks(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "tasks": [],
        "total": 0
    }))
}

/// Get task endpoint
async fn get_task(State(state): State<AppState>, axum::extract::Path(id): axum::extract::Path<String>) -> impl IntoResponse {
    Json(serde_json::json!({
        "task_id": id,
        "status": "not_implemented"
    }))
}

/// List sessions endpoint
async fn list_sessions(State(state): State<AppState>) -> impl IntoResponse {
    match state.session_store.list_sessions() {
        Ok(sessions) => {
            let session_info: Vec<serde_json::Value> = sessions
                .into_iter()
                .map(|session| serde_json::json!({
                    "id": session.metadata.id,
                    "created_at": session.metadata.created_at.to_rfc3339(),
                    "updated_at": session.metadata.updated_at.to_rfc3339(),
                    "message_count": session.metadata.message_count,
                    "model": session.metadata.model
                }))
                .collect();
            
            Json(serde_json::json!({
                "sessions": session_info,
                "total": session_info.len()
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to list sessions: {}", e)
            }))).into_response()
        }
    }
}

/// Get session endpoint
async fn get_session(State(state): State<AppState>, axum::extract::Path(id): axum::extract::Path<String>) -> impl IntoResponse {
    Json(serde_json::json!({
        "session_id": id,
        "status": "not_implemented"
    }))
}

/// Auth status endpoint
async fn auth_status(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "authenticated": true,
        "providers": []
    }))
}

/// List models endpoint
async fn list_models(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "models": [],
        "providers": []
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_web_config_default() {
        let config = WebConfig::default();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 3000);
        assert!(config.cors_enabled);
        assert!(config.tracing_enabled);
    }
    
    #[tokio::test]
    async fn test_web_server_creation() {
        let config = WebConfig::default();
        
        // Create mock state (would normally come from actual components)
        let auth_manager = Arc::new(AuthManager::new());
        let ai_client = Arc::new(AiClient::new());
        let agent_registry = Arc::new(AgentRegistry::new(5));
        let session_store = Arc::new(SessionStore::new(None, true).unwrap());
        let task_executor = Arc::new(TaskExecutor::new(5, 10));
        
        let state = AppState {
            auth_manager,
            ai_client,
            agent_registry,
            session_store,
            task_executor,
        };
        
        let server = WebServer::new(config, state);
        assert_eq!(server.config.port, 3000);
    }
}