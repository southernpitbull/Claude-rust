# OAuth Provider Status and Implementation Guide

## Overview

This document provides the current status of OAuth 2.0 support for all AI providers in Claude-Rust, along with implementation details and setup instructions.

## Provider OAuth Support Status (2025)

### ✅ Google Gemini - **OAUTH SUPPORTED**

**Status**: OAuth 2.0 is fully supported and recommended for production use.

**Setup Instructions**:

1. **Enable the API**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Generative Language API"
   - Click "Enable"

2. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Select "External" user type (or "Internal" if using Google Workspace)
   - Fill in the required fields:
     - App name: "Claude-Rust"
     - User support email: your email
     - Developer contact email: your email
   - Add test users (add your own email address)
   - Save and continue

3. **Create OAuth 2.0 Client ID**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Desktop app**
   - Name: "Claude-Rust Desktop"
   - Click "Create"

4. **Download Credentials**
   - Click the download button (⬇️) next to your newly created OAuth 2.0 Client ID
   - This downloads a JSON file named `client_secret_*.json`
   - Open the file and note the `client_id` and `client_secret` values

5. **Use in Claude-Rust**
   ```bash
   # During first-time setup, select OAuth when prompted for Gemini
   claude-rust auth login gemini

   # Choose option "2. OAuth (browser-based login)"
   # Enter your client_id when prompted
   # Enter your client_secret when prompted
   # Follow the browser prompts to authorize
   ```

**OAuth Endpoints**:
- Authorization: `https://accounts.google.com/o/oauth2/v2/auth`
- Token: `https://oauth2.googleapis.com/token`
- Revoke: `https://oauth2.googleapis.com/revoke`

**Scopes**:
- `https://www.googleapis.com/auth/generative-language.retriever`

**Documentation**: https://ai.google.dev/gemini-api/docs/oauth

---

### ❌ Anthropic Claude - **OAUTH NOT SUPPORTED**

**Status**: OAuth 2.0 is NOT supported. Claude API uses API key authentication only.

**Current Authentication Method**:
- API Key authentication via `ANTHROPIC_API_KEY` environment variable
- Get your API key: https://console.anthropic.com/settings/keys

**Implementation Notes**:
- OAuth endpoints in the codebase are **placeholders** for future support
- If Anthropic adds OAuth support in the future, the infrastructure is ready

**Alternative**:
```bash
# Set environment variable
export ANTHROPIC_API_KEY="sk-ant-..."

# Or enter during setup
claude-rust auth login claude
# Choose option "1. API Key"
```

---

### ❌ OpenAI - **OAUTH NOT SUPPORTED FOR API**

**Status**: OAuth 2.0 is NOT supported for direct API access. OAuth is only available for Actions/Plugins, not for API calls.

**Current Authentication Method**:
- API Key authentication via `OPENAI_API_KEY` environment variable
- Get your API key: https://platform.openai.com/api-keys

**Implementation Notes**:
- OAuth endpoints in the codebase are **placeholders** for future support
- OpenAI uses project-scoped API keys and service accounts as of 2025
- For Realtime API in browsers, use ephemeral tokens (not OAuth)

**Alternative**:
```bash
# Set environment variable
export OPENAI_API_KEY="sk-..."

# Or enter during setup
claude-rust auth login openai
# Choose option "1. API Key"
```

---

### ❌ Alibaba Qwen - **OAUTH NOT SUPPORTED**

**Status**: OAuth 2.0 is NOT supported. DashScope API uses API key authentication only.

**Current Authentication Method**:
- API Key authentication via `QWEN_API_KEY` environment variable
- Get your API key: https://dashscope.console.aliyun.com/apiKey

**Implementation Notes**:
- OAuth endpoints in the codebase are **placeholders** for future support
- API keys are permanently valid until manually deleted
- Temporary API keys (60-second validity) are available for high-risk operations

**Alternative**:
```bash
# Set environment variable
export QWEN_API_KEY="sk-..."

# Or enter during setup
claude-rust auth login qwen
# Choose option "1. API Key"
```

---

### 🏠 Ollama - **LOCAL PROVIDER** (No Auth Required)

**Status**: Local provider, no authentication required.

**Connection**: Default `http://localhost:11434`

---

### 🏠 LM Studio - **LOCAL PROVIDER** (No Auth Required)

**Status**: Local provider, no authentication required.

**Connection**: Default `http://localhost:1234`

---

## Technical Implementation Details

### OAuth Flow Architecture

Claude-Rust implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) for maximum security:

1. **Authorization Request**
   - Generates code verifier and challenge
   - Opens browser to provider's authorization URL
   - Includes state parameter for CSRF protection

2. **Local Callback Server**
   - Starts temporary HTTP server on `localhost:8080`
   - Receives authorization code from provider
   - Validates state parameter

3. **Token Exchange**
   - Exchanges authorization code for access token
   - Includes code verifier for PKCE validation
   - Receives access token and optional refresh token

4. **Token Storage**
   - Stores tokens in platform-specific secure storage (keyring)
   - Encrypts sensitive data
   - Separates access and refresh tokens

5. **Token Refresh**
   - Automatically refreshes expired access tokens
   - Uses refresh token when available
   - Falls back to re-authentication if refresh fails

### Security Features

- **PKCE (RFC 7636)**: All OAuth flows use SHA-256 code challenge
- **State Parameter**: CSRF protection with cryptographically random state
- **Secure Storage**: Platform keyring integration (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- **Token Encryption**: Sensitive tokens encrypted at rest
- **Minimal Scopes**: Request only necessary permissions
- **Automatic Cleanup**: Tokens revoked on logout

### Code Structure

```
crates/auth/src/oauth/
├── mod.rs                  # OAuth flow orchestration
├── oauth.rs                # Core OAuth implementation
├── pkce.rs                 # PKCE code generation
├── providers.rs            # Provider-specific implementations
└── server.rs               # Local callback server
```

### Adding New OAuth Providers

When a provider adds OAuth support:

1. Update the `OAUTH_SUPPORTED` constant in `providers.rs`
2. Update endpoint URLs if needed
3. Add provider-specific parameters (scopes, extra params)
4. Implement any provider-specific token exchange logic
5. Test the flow end-to-end
6. Update this documentation

### Example: Gemini OAuth Implementation

```rust
use claude_rust_auth::oauth::providers::{GeminiOAuth, OAuthProvider};

// Create OAuth client
let mut oauth = GeminiOAuth::new(client_id)
    .with_client_secret(client_secret)
    .with_redirect_uri("http://localhost:8080/callback".to_string());

// Run OAuth flow (opens browser, starts callback server)
let token_response = oauth.authenticate().await?;

// Store tokens
store_access_token(&token_response.access_token).await?;
if let Some(refresh_token) = &token_response.refresh_token {
    store_refresh_token(refresh_token).await?;
}

// Later: Refresh expired token
let new_token = oauth.refresh(&refresh_token).await?;
```

## Testing OAuth Flows

### Testing Gemini OAuth

1. Obtain Google OAuth credentials (see setup instructions above)
2. Run first-time setup:
   ```bash
   claude-rust
   ```
3. Select "Google Gemini" when prompted for providers
4. Choose "OAuth (browser-based login)"
5. Enter client ID and secret
6. Complete browser authorization
7. Verify tokens are stored:
   ```bash
   claude-rust auth status gemini
   ```

### Testing OAuth Fallbacks

Test what happens when OAuth fails:

```bash
# Enter invalid credentials
# System should offer API key fallback

# Cancel OAuth in browser
# System should handle gracefully
```

### Testing Token Refresh

Tokens can be manually expired for testing:

```rust
// In test code
let expired_token = AuthToken {
    expires_at: Utc::now().timestamp() - 3600, // Expired 1 hour ago
    // ... other fields
};
```

## Future Considerations

### When Providers Add OAuth

Monitor provider announcements for OAuth support:

- **Claude**: Check Anthropic developer blog and API docs
- **OpenAI**: Check OpenAI platform changelog
- **Qwen**: Check Alibaba Cloud announcements

### OAuth Enhancements

Potential future improvements:

1. **Device Flow (RFC 8628)**: For devices without browsers
2. **Client Credentials Flow**: For server-to-server auth
3. **Token Caching**: Reduce token refresh requests
4. **Multi-Account**: Support multiple authenticated accounts per provider
5. **SSO Integration**: Enterprise SSO support

## Troubleshooting

### Common OAuth Issues

**"OAuth not yet available"**
- Provider doesn't support OAuth yet
- Use API key authentication instead

**"Token revocation failed"**
- Network connectivity issue
- Token already revoked
- Provider endpoint temporarily unavailable

**"Browser didn't open"**
- Install default browser
- Manually open URL shown in terminal
- Check firewall blocking localhost:8080

**"OAuth flow timed out"**
- Complete authorization within 2 minutes
- Restart the flow if needed

**"Invalid client credentials"**
- Verify client ID and secret are correct
- Ensure OAuth client is configured for "Desktop app"
- Check that API is enabled in Google Cloud Console

### Debug Mode

Enable verbose logging:

```bash
export RUST_LOG=claude_rust_auth=debug
claude-rust auth login gemini
```

## References

- [RFC 6749: OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [RFC 7636: PKCE](https://tools.ietf.org/html/rfc7636)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gemini API OAuth Guide](https://ai.google.dev/gemini-api/docs/oauth)

---

**Last Updated**: October 2025
**Version**: 1.0.0
