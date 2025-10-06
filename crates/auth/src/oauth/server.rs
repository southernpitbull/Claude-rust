//! Local HTTP Callback Server for OAuth
//!
//! Implements a lightweight HTTP server to handle OAuth callback redirects.
//! The server automatically shuts down after receiving the authorization code.

use crate::error::{AuthError, AuthResult};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tracing::{debug, error, info, warn};
use url::Url;

/// OAuth callback result containing authorization code and state
#[derive(Debug, Clone)]
pub struct CallbackResult {
    /// Authorization code received from OAuth provider
    pub code: String,
    /// State parameter for CSRF protection
    pub state: Option<String>,
    /// Error code if authorization failed
    pub error: Option<String>,
    /// Error description if authorization failed
    pub error_description: Option<String>,
}

impl CallbackResult {
    /// Checks if the callback represents an error
    pub fn is_error(&self) -> bool {
        self.error.is_some()
    }

    /// Gets the error message if present
    pub fn error_message(&self) -> Option<String> {
        self.error.as_ref().map(|err| {
            if let Some(desc) = &self.error_description {
                format!("{}: {}", err, desc)
            } else {
                err.clone()
            }
        })
    }
}

/// Configuration for the OAuth callback server
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Port to bind the server to (0 for random port)
    pub port: u16,
    /// Host to bind to (usually "127.0.0.1")
    pub host: String,
    /// Timeout for waiting for callback in seconds
    pub timeout: Duration,
    /// Success HTML page to display
    pub success_html: String,
    /// Error HTML page to display
    pub error_html: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 0, // Random available port
            host: "127.0.0.1".to_string(),
            timeout: Duration::from_secs(300), // 5 minutes
            success_html: DEFAULT_SUCCESS_HTML.to_string(),
            error_html: DEFAULT_ERROR_HTML.to_string(),
        }
    }
}

impl ServerConfig {
    /// Creates a new server configuration with specified port
    pub fn new(port: u16) -> Self {
        Self {
            port,
            ..Default::default()
        }
    }

    /// Sets the timeout duration
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Sets custom success HTML
    pub fn with_success_html(mut self, html: String) -> Self {
        self.success_html = html;
        self
    }

    /// Sets custom error HTML
    pub fn with_error_html(mut self, html: String) -> Self {
        self.error_html = html;
        self
    }
}

/// Local HTTP server for OAuth callbacks
pub struct CallbackServer {
    config: ServerConfig,
    listener: Option<TcpListener>,
    actual_port: Option<u16>,
}

impl CallbackServer {
    /// Creates a new callback server with the given configuration
    pub fn new(config: ServerConfig) -> AuthResult<Self> {
        Ok(Self {
            config,
            listener: None,
            actual_port: None,
        })
    }

    /// Starts the server and binds to the configured port
    ///
    /// # Returns
    ///
    /// Returns the actual port the server is bound to
    pub fn start(&mut self) -> AuthResult<u16> {
        let addr = format!("{}:{}", self.config.host, self.config.port);
        let listener = TcpListener::bind(&addr).map_err(|e| {
            AuthError::OAuthFailed(format!("Failed to bind to {}: {}", addr, e))
        })?;

        let actual_port = listener.local_addr().map_err(|e| {
            AuthError::OAuthFailed(format!("Failed to get local address: {}", e))
        })?.port();

        info!("OAuth callback server listening on {}:{}", self.config.host, actual_port);

        self.actual_port = Some(actual_port);
        self.listener = Some(listener);

        Ok(actual_port)
    }

    /// Gets the redirect URI for this server
    pub fn redirect_uri(&self) -> AuthResult<String> {
        let port = self.actual_port.ok_or_else(|| {
            AuthError::OAuthFailed("Server not started".to_string())
        })?;

        Ok(format!("http://{}:{}/callback", self.config.host, port))
    }

    /// Waits for the OAuth callback and returns the result
    ///
    /// This method blocks until either:
    /// - A callback is received
    /// - The timeout expires
    /// - An error occurs
    pub fn wait_for_callback(&self) -> AuthResult<CallbackResult> {
        let listener = self.listener.as_ref().ok_or_else(|| {
            AuthError::OAuthFailed("Server not started".to_string())
        })?;

        // Set read timeout on the listener
        listener.set_nonblocking(false).map_err(|e| {
            AuthError::OAuthFailed(format!("Failed to set blocking mode: {}", e))
        })?;

        let (tx, rx) = channel();
        let tx = Arc::new(Mutex::new(tx));
        let config = self.config.clone();

        // Clone the listener for the thread
        let listener_clone = listener.try_clone().map_err(|e| {
            AuthError::OAuthFailed(format!("Failed to clone listener: {}", e))
        })?;

        // Spawn a thread to handle connections
        thread::spawn(move || {
            handle_connections(listener_clone, tx, config);
        });

        // Wait for callback with timeout
        rx.recv_timeout(self.config.timeout).map_err(|e| match e {
            std::sync::mpsc::RecvTimeoutError::Timeout => {
                AuthError::OAuthFailed("Callback timeout expired".to_string())
            }
            std::sync::mpsc::RecvTimeoutError::Disconnected => {
                AuthError::OAuthFailed("Callback channel disconnected".to_string())
            }
        })
    }

    /// Starts the server and waits for a callback
    ///
    /// This is a convenience method that combines `start()` and `wait_for_callback()`
    pub fn run(&mut self) -> AuthResult<(u16, CallbackResult)> {
        let port = self.start()?;
        let result = self.wait_for_callback()?;
        Ok((port, result))
    }
}

/// Handles incoming HTTP connections
fn handle_connections(
    listener: TcpListener,
    sender: Arc<Mutex<Sender<CallbackResult>>>,
    config: ServerConfig,
) {
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                debug!("Received connection from {:?}", stream.peer_addr());

                match handle_request(stream, &config) {
                    Ok(Some(result)) => {
                        info!("Callback received successfully");

                        // Send result and break
                        if let Ok(sender) = sender.lock() {
                            if sender.send(result).is_err() {
                                error!("Failed to send callback result");
                            }
                        }
                        break;
                    }
                    Ok(None) => {
                        debug!("Request handled but no callback result");
                    }
                    Err(e) => {
                        warn!("Error handling request: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Failed to accept connection: {}", e);
            }
        }
    }
}

/// Handles a single HTTP request
fn handle_request(
    mut stream: TcpStream,
    config: &ServerConfig,
) -> AuthResult<Option<CallbackResult>> {
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| {
        AuthError::OAuthFailed(format!("Failed to clone stream: {}", e))
    })?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line).map_err(|e| {
        AuthError::OAuthFailed(format!("Failed to read request: {}", e))
    })?;

    debug!("Request: {}", request_line.trim());

    // Parse request line: "GET /callback?code=... HTTP/1.1"
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        send_response(&mut stream, 400, "Bad Request", &config.error_html)?;
        return Ok(None);
    }

    let path = parts[1];

    // Parse the callback URL
    let full_url = format!("http://localhost{}", path);
    let url = Url::parse(&full_url).map_err(|e| {
        AuthError::OAuthFailed(format!("Failed to parse URL: {}", e))
    })?;

    // Check if this is a callback request
    if !url.path().starts_with("/callback") {
        send_response(&mut stream, 404, "Not Found", &config.error_html)?;
        return Ok(None);
    }

    // Extract query parameters
    let params: std::collections::HashMap<String, String> = url
        .query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    debug!("Callback parameters: {:?}", params);

    // Check for error in callback
    if let Some(error) = params.get("error") {
        let error_description = params.get("error_description").cloned();
        let result = CallbackResult {
            code: String::new(),
            state: params.get("state").cloned(),
            error: Some(error.clone()),
            error_description,
        };

        let error_html = config.error_html.replace(
            "{{error}}",
            &result.error_message().unwrap_or_else(|| "Unknown error".to_string())
        );
        send_response(&mut stream, 200, "OK", &error_html)?;

        return Ok(Some(result));
    }

    // Extract authorization code
    let code = params.get("code").ok_or_else(|| {
        AuthError::OAuthFailed("No authorization code in callback".to_string())
    })?;

    let result = CallbackResult {
        code: code.clone(),
        state: params.get("state").cloned(),
        error: None,
        error_description: None,
    };

    send_response(&mut stream, 200, "OK", &config.success_html)?;

    Ok(Some(result))
}

/// Sends an HTTP response
fn send_response(
    stream: &mut TcpStream,
    status_code: u16,
    status_text: &str,
    body: &str,
) -> AuthResult<()> {
    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        status_code,
        status_text,
        body.len(),
        body
    );

    stream.write_all(response.as_bytes()).map_err(|e| {
        AuthError::OAuthFailed(format!("Failed to send response: {}", e))
    })?;

    stream.flush().map_err(|e| {
        AuthError::OAuthFailed(format!("Failed to flush stream: {}", e))
    })?;

    Ok(())
}

/// Default success HTML page
const DEFAULT_SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .success-icon {
            width: 80px;
            height: 80px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 1.5rem;
        }
        .checkmark {
            width: 40px;
            height: 40px;
            border: 4px solid white;
            border-top: none;
            border-right: none;
            transform: rotate(-45deg);
            margin-top: 10px;
        }
        h1 {
            color: #1f2937;
            margin: 0 0 1rem;
            font-size: 1.8rem;
        }
        p {
            color: #6b7280;
            line-height: 1.6;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">
            <div class="checkmark"></div>
        </div>
        <h1>Authentication Successful!</h1>
        <p>You have been successfully authenticated. You can close this window and return to the CLI.</p>
    </div>
</body>
</html>"#;

/// Default error HTML page
const DEFAULT_ERROR_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Failed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .error-icon {
            width: 80px;
            height: 80px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 1.5rem;
            position: relative;
        }
        .cross {
            width: 50px;
            height: 4px;
            background: white;
            position: absolute;
        }
        .cross:first-child {
            transform: rotate(45deg);
        }
        .cross:last-child {
            transform: rotate(-45deg);
        }
        h1 {
            color: #1f2937;
            margin: 0 0 1rem;
            font-size: 1.8rem;
        }
        p {
            color: #6b7280;
            line-height: 1.6;
            margin: 0;
        }
        .error-details {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 1rem;
            margin-top: 1.5rem;
            text-align: left;
            border-radius: 0.25rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">
            <div class="cross"></div>
            <div class="cross"></div>
        </div>
        <h1>Authentication Failed</h1>
        <p>There was an error during authentication. Please try again.</p>
        <div class="error-details">
            <strong>Error:</strong> {{error}}
        </div>
    </div>
</body>
</html>"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_config_default() {
        let config = ServerConfig::default();
        assert_eq!(config.port, 0);
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.timeout, Duration::from_secs(300));
    }

    #[test]
    fn test_server_config_new() {
        let config = ServerConfig::new(8080);
        assert_eq!(config.port, 8080);
    }

    #[test]
    fn test_server_config_builder() {
        let config = ServerConfig::new(8080)
            .with_timeout(Duration::from_secs(60))
            .with_success_html("Success".to_string())
            .with_error_html("Error".to_string());

        assert_eq!(config.port, 8080);
        assert_eq!(config.timeout, Duration::from_secs(60));
        assert_eq!(config.success_html, "Success");
        assert_eq!(config.error_html, "Error");
    }

    #[test]
    fn test_callback_result_is_error() {
        let result = CallbackResult {
            code: String::new(),
            state: None,
            error: Some("access_denied".to_string()),
            error_description: None,
        };
        assert!(result.is_error());
    }

    #[test]
    fn test_callback_result_error_message() {
        let result = CallbackResult {
            code: String::new(),
            state: None,
            error: Some("access_denied".to_string()),
            error_description: Some("User denied access".to_string()),
        };
        assert_eq!(
            result.error_message(),
            Some("access_denied: User denied access".to_string())
        );
    }

    #[test]
    fn test_callback_result_no_error() {
        let result = CallbackResult {
            code: "auth_code_123".to_string(),
            state: Some("state_xyz".to_string()),
            error: None,
            error_description: None,
        };
        assert!(!result.is_error());
        assert_eq!(result.error_message(), None);
    }

    #[test]
    fn test_callback_server_creation() {
        let config = ServerConfig::default();
        let server = CallbackServer::new(config);
        assert!(server.is_ok());
    }

    #[test]
    fn test_callback_server_start() {
        let config = ServerConfig::new(0); // Random port
        let mut server = CallbackServer::new(config).unwrap();
        let port = server.start();
        assert!(port.is_ok());
        assert!(port.unwrap() > 0);
    }

    #[test]
    fn test_callback_server_redirect_uri() {
        let config = ServerConfig::new(0);
        let mut server = CallbackServer::new(config).unwrap();
        server.start().unwrap();
        let uri = server.redirect_uri();
        assert!(uri.is_ok());
        assert!(uri.unwrap().starts_with("http://127.0.0.1:"));
        assert!(uri.unwrap().ends_with("/callback"));
    }

    #[test]
    fn test_callback_server_redirect_uri_before_start() {
        let config = ServerConfig::new(0);
        let server = CallbackServer::new(config).unwrap();
        let uri = server.redirect_uri();
        assert!(uri.is_err());
    }
}
