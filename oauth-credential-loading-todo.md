# OAuth Credential File Loading Implementation Plan

## Overview
Implement OAuth token loading from files in user directories:
- C:\Users\%username%\.claude
- C:\Users\%username%\.gemini  
- C:\Users\%username%\.qwen

Support files:
- .credentials.json
- oauth_creds.json

## Priority Breakdown
- 🟢 High Priority: Core file loading functionality
- 🟡 Medium Priority: Integration and error handling
- 🟣 Low Priority: Edge cases and enhancements

## Implementation Tasks

### 🟢 1. File Path Resolution (High Priority)
- [ ] Implement Windows-specific path resolution for .claude directory
- [ ] Implement Windows-specific path resolution for .gemini directory
- [ ] Implement Windows-specific path resolution for .qwen directory
- [ ] Add cross-platform compatibility (macOS/Linux support)
- [ ] Create utility functions for resolving user directory paths

### 🟢 2. File Discovery (High Priority)
- [ ] Implement file discovery in .claude directory
- [ ] Implement file discovery in .gemini directory
- [ ] Implement file discovery in .qwen directory
- [ ] Add support for .credentials.json files
- [ ] Add support for oauth_creds.json files
- [ ] Implement recursive directory scanning (subdirectories)

### 🟢 3. JSON Schema Definition (High Priority)
- [ ] Define schema for .credentials.json files
- [ ] Define schema for oauth_creds.json files
- [ ] Create Rust structs for credential data
- [ ] Add serde serialization/deserialization

### 🟢 4. File Loading & Parsing (High Priority)
- [ ] Implement .credentials.json file loading
- [ ] Implement oauth_creds.json file loading
- [ ] Add JSON parsing with error handling
- [ ] Validate parsed data against schemas
- [ ] Handle malformed JSON files gracefully

### 🟡 5. OAuthCredentialFileLoader Implementation (Medium Priority)
- [ ] Create OAuthCredentialFileLoader struct
- [ ] Implement load_credentials method
- [ ] Add support for multiple file formats
- [ ] Implement credential merging logic
- [ ] Add caching for loaded credentials

### 🟡 6. Integration with AuthManager (Medium Priority)
- [ ] Integrate file loading with existing AuthManager
- [ ] Implement fallback mechanism from files to keyring
- [ ] Add priority system (files vs keyring)
- [ ] Update credential retrieval logic

### 🟡 7. Security Validation (Medium Priority)
- [ ] Implement file permission validation
- [ ] Add file ownership checks
- [ ] Validate file integrity
- [ ] Add encryption support for credential files

### 🟡 8. Error Handling (Medium Priority)
- [ ] Handle missing credential files
- [ ] Handle malformed credential files
- [ ] Handle permission denied errors
- [ ] Handle file read errors
- [ ] Add detailed error messages

### 🟣 9. Cross-Platform Support (Low Priority)
- [ ] Test on Windows
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Handle platform-specific path differences
- [ ] Add platform-specific file permission handling

### 🟣 10. Testing (Low Priority)
- [ ] Add unit tests for file path resolution
- [ ] Add unit tests for file discovery
- [ ] Add unit tests for JSON parsing
- [ ] Add integration tests with AuthManager
- [ ] Add cross-platform compatibility tests

### 🟣 11. Documentation (Low Priority)
- [ ] Document credential file formats
- [ ] Document file loading behavior
- [ ] Add examples of credential files
- [ ] Update user guide with file loading instructions
- [ ] Add security best practices

## File Structures

### .credentials.json Format
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_at": "ISO8601 timestamp",
  "token_type": "string",
  "scope": "string"
}
```

### oauth_creds.json Format
```json
{
  "provider": "string",
  "account": "string",
  "credentials": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_at": "ISO8601 timestamp",
    "token_type": "string",
    "scope": "string"
  }
}
```

## Implementation Steps

1. **Create OAuthCredentialFileLoader struct** with methods to load credentials from files
2. **Implement file path resolution** for Windows user directories
3. **Add file discovery logic** to find .credentials.json and oauth_creds.json files
4. **Define JSON schemas** and create Rust structs for credential data
5. **Implement file loading and parsing** with proper error handling
6. **Integrate with AuthManager** to use file-loaded credentials as fallback
7. **Add security validation** for credential files
8. **Implement comprehensive error handling**
9. **Add cross-platform support**
10. **Write tests and documentation**

## Dependencies
- dirs crate for cross-platform directory resolution
- serde for JSON serialization/deserialization
- tokio for async file operations
- tracing for logging

## Timeline
- Phase 1 (Days 1-2): File path resolution and discovery
- Phase 2 (Days 3-4): JSON parsing and struct definitions
- Phase 3 (Days 5-6): OAuthCredentialFileLoader implementation
- Phase 4 (Days 7-8): AuthManager integration
- Phase 5 (Days 9-10): Security, error handling, and testing