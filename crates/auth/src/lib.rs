pub mod account;
pub mod audit;
pub mod auth_wizard;
pub mod error;
pub mod manager;
pub mod multi_provider_manager;
pub mod oauth;
pub mod oauth_credential_loader;
pub mod oauth_manager;
pub mod provider;
pub mod storage;
pub mod tokens;
pub mod types;

pub use account::{Account, AccountInfo, AccountPool, RotationStrategy};
pub use audit::{AuditConfig, AuditEvent, AuditEventType, AuditLogger};
pub use auth_wizard::{AuthWizard, ProviderConfig};
pub use error::{AuthError, AuthResult};
pub use manager::AuthManager;
pub use multi_provider_manager::{MultiProviderManager, RotationStrategy as AccountRotationStrategy};
pub use oauth::{
    claude_endpoints, gemini_endpoints, openai_endpoints, qwen_endpoints, CallbackResult,
    CallbackServer, ChallengeMethod, ClaudeOAuth, GeminiOAuth, OAuthConfig, OAuthFlow,
    OpenAIOAuth, PkceParams, QwenOAuth, ServerConfig, TokenResponse,
};
pub use oauth_credential_loader::{OAuthCredentialFileLoader, CredentialsFileSchema, OauthCredsFileSchema};
pub use oauth_manager::OAuthManager;
pub use provider::{ProviderAuthConfig, ProviderRegistry};
pub use storage::{CredentialStore, TokenInfo};
pub use tokens::AuthToken;
pub use types::{AuthMethod, AuthState};
