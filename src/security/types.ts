/**
 * Security Type Definitions
 * AIrchitect Security System
 *
 * Comprehensive type definitions for authentication, authorization, and audit logging.
 */

/**
 * User roles with hierarchical permissions
 */
export enum Role {
  ADMIN = 'admin', // Full system access
  DEVELOPER = 'developer', // Code generation, project management
  ANALYST = 'analyst', // Memory search, analysis only
  READONLY = 'readonly', // Read-only access only
}

/**
 * Authentication credentials
 */
export interface Credentials {
  username: string;
  password: string;
  mfa_code?: string;
}

/**
 * User entity with roles and permissions
 */
export interface User {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  permissions: string[];
  created_at: Date;
  last_login?: Date;
  mfa_enabled: boolean;
  password_hash?: string; // Only used internally, never exposed
  mfa_secret?: string; // Only used internally, never exposed
}

/**
 * Authentication token response
 */
export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

/**
 * JWT token payload
 */
export interface TokenPayload {
  sub: string; // User ID
  username: string;
  email: string;
  roles: Role[];
  permissions: string[];
  iat: number; // Issued at
  exp: number; // Expiration
  jti?: string; // JWT ID for revocation
  type: 'access' | 'refresh';
}

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  user: User;
  resource: string;
  action: string;
  context: Record<string, any>;
}

/**
 * Authorization policy
 */
export interface Policy {
  id: string;
  name: string;
  effect: 'allow' | 'deny';
  actions: string[];
  resources: string[];
  conditions?: PolicyCondition[];
}

/**
 * Policy condition for ABAC
 */
export interface PolicyCondition {
  attribute: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'in';
  value: any;
}

/**
 * Audit log event types
 */
export enum AuditEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_LOGOUT = 'auth_logout',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REVOKED = 'token_revoked',
  AUTHZ_ALLOWED = 'authz_allowed',
  AUTHZ_DENIED = 'authz_denied',
  CONFIG_CHANGE = 'config_change',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_VERIFIED = 'mfa_verified',
  MFA_FAILED = 'mfa_failed',
  PASSWORD_CHANGED = 'password_changed',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  event: AuditEventType;
  user_id?: string;
  username?: string;
  ip_address?: string;
  user_agent?: string;
  resource?: string;
  action?: string;
  result: 'success' | 'failure';
  details?: Record<string, any>;
  error_message?: string;
}

/**
 * JWT signing options
 */
export interface JWTSignOptions {
  expiresIn: string | number;
  algorithm: 'RS256';
  issuer?: string;
  audience?: string;
  jwtid?: string;
}

/**
 * JWT verification options
 */
export interface JWTVerifyOptions {
  algorithms: ['RS256'];
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
  ignoreExpiration?: boolean;
}

/**
 * Key pair for JWT signing
 */
export interface KeyPair {
  privateKey: string;
  publicKey: string;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Permission definition
 */
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: string[];
}

/**
 * Role definition with permissions
 */
export interface RoleDefinition {
  role: Role;
  permissions: string[];
  inherits?: Role[];
}

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * OAuth2 token response
 */
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * MFA setup response
 */
export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  jwt: {
    issuer: string;
    audience: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    saltRounds: number;
  };
  mfa: {
    enabled: boolean;
    issuer: string;
    window: number;
  };
  rateLimit: RateLimitConfig;
  oauth2?: OAuth2Config;
}

/**
 * Authentication error types
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error types
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Token error types
 */
export class TokenError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'TokenError';
  }
}
