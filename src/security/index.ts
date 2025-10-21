/**
 * Security System - Main Export
 * AIrchitect Security System
 *
 * Comprehensive authentication, authorization, and audit logging system.
 * SECURITY: Production-ready security implementation with OWASP compliance.
 */

// Type Definitions
export * from './types';

// JWT Token Management
export { JWTManager, getJWTManager, resetJWTManager } from './jwt-manager';

// RBAC - Role-Based Access Control
export {
  RBACManager,
  getRBACManager,
  resetRBACManager,
  PERMISSIONS,
  ROLE_DEFINITIONS,
} from './rbac';

// Authentication
export { AuthenticationManager, getAuthManager, resetAuthManager, authenticate } from './auth';

// Authorization
export { AuthorizationManager, getAuthzManager, resetAuthzManager, authorize } from './authz';

// Audit Logging
export { AuditLogger, AuditLoggerConfig, getAuditLogger, resetAuditLogger } from './audit-logger';

/**
 * Initialize security system
 * SECURITY: Sets up all security components with proper configuration
 */
export function initializeSecurity(config?: {
  jwtIssuer?: string;
  jwtAudience?: string;
  auditLogConfig?: Partial<import('./audit-logger').AuditLoggerConfig>;
}): void {
  // Initialize JWT manager
  getJWTManager(config?.jwtIssuer, config?.jwtAudience);

  // Initialize RBAC manager
  getRBACManager();

  // Initialize authentication manager
  getAuthManager();

  // Initialize authorization manager
  getAuthzManager();

  // Initialize audit logger
  getAuditLogger(config?.auditLogConfig);
}

/**
 * Reset all security components (for testing)
 */
export function resetSecurity(): void {
  resetJWTManager();
  resetRBACManager();
  resetAuthManager();
  resetAuthzManager();
  resetAuditLogger();
}
