/**
 * Audit Logger
 * AIrchitect Security System
 *
 * Comprehensive audit logging for security events, authentication, and authorization.
 * SECURITY: Maintains complete audit trail for compliance and security monitoring.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AuditEventType, AuditLogEntry, User } from './types';

/**
 * Audit Logger Configuration
 */
export interface AuditLoggerConfig {
  logDirectory: string;
  logToConsole: boolean;
  logToFile: boolean;
  maxFileSize: number; // in bytes
  retentionDays: number;
}

/**
 * Default audit logger configuration
 */
const DEFAULT_CONFIG: AuditLoggerConfig = {
  logDirectory: path.join(process.cwd(), 'logs', 'audit'),
  logToConsole: process.env.NODE_ENV === 'development',
  logToFile: true,
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  retentionDays: 90,
};

/**
 * Audit Logger - Logs all security-relevant events
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private currentLogFile: string | null = null;
  private writeStream: fs.WriteStream | null = null;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeLogDirectory();
  }

  /**
   * Initialize log directory
   * SECURITY: Ensures audit logs are stored securely
   */
  private initializeLogDirectory(): void {
    if (this.config.logToFile) {
      try {
        if (!fs.existsSync(this.config.logDirectory)) {
          fs.mkdirSync(this.config.logDirectory, { recursive: true, mode: 0o750 });
        }
      } catch (error) {
        console.error('Failed to create audit log directory:', error);
        this.config.logToFile = false;
      }
    }
  }

  /**
   * Get current log file path
   */
  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.config.logDirectory, `audit-${date}.log`);
  }

  /**
   * Initialize or rotate log file
   */
  private initializeLogFile(): void {
    const logFilePath = this.getLogFilePath();

    // Check if we need to rotate to a new file
    if (this.currentLogFile !== logFilePath) {
      if (this.writeStream) {
        this.writeStream.end();
      }
      this.currentLogFile = logFilePath;
      this.writeStream = fs.createWriteStream(logFilePath, {
        flags: 'a',
        mode: 0o640,
      });
    }

    // Check file size for rotation
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size > this.config.maxFileSize) {
        this.rotateLogFile(logFilePath);
      }
    }
  }

  /**
   * Rotate log file when it exceeds max size
   */
  private rotateLogFile(logFilePath: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = logFilePath.replace('.log', `-${timestamp}.log`);

    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }

    fs.renameSync(logFilePath, rotatedPath);
    this.currentLogFile = null;
  }

  /**
   * Create audit log entry
   */
  private createLogEntry(
    event: AuditEventType,
    userId?: string,
    username?: string,
    result: 'success' | 'failure' = 'success',
    details?: Record<string, any>,
    errorMessage?: string
  ): AuditLogEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      event,
      user_id: userId,
      username,
      ip_address: details?.ip_address,
      user_agent: details?.user_agent,
      resource: details?.resource,
      action: details?.action,
      result,
      details: this.sanitizeDetails(details),
      error_message: errorMessage,
    };
  }

  /**
   * Sanitize log details to prevent sensitive data leakage
   * SECURITY: Never log passwords, tokens, or other secrets
   */
  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) {
      return undefined;
    }

    const sanitized = { ...details };
    const sensitiveFields = [
      'password',
      'token',
      'access_token',
      'refresh_token',
      'secret',
      'api_key',
      'private_key',
      'mfa_code',
      'mfa_secret',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Write log entry to file and/or console
   */
  private writeLog(entry: AuditLogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';

    // Write to console
    if (this.config.logToConsole) {
      const color = entry.result === 'success' ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(
        `${color}[AUDIT]${reset} ${entry.event} - ${entry.result} - User: ${entry.username || 'N/A'}`
      );
    }

    // Write to file
    if (this.config.logToFile) {
      try {
        this.initializeLogFile();
        if (this.writeStream) {
          this.writeStream.write(logLine);
        }
      } catch (error) {
        console.error('Failed to write audit log:', error);
      }
    }
  }

  /**
   * Log authentication attempt
   * SECURITY: Tracks all login attempts for security monitoring
   */
  logAuthAttempt(
    username: string,
    success: boolean,
    userId?: string,
    reason?: string,
    details?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(
      success ? AuditEventType.AUTH_SUCCESS : AuditEventType.AUTH_FAILURE,
      userId,
      username,
      success ? 'success' : 'failure',
      details,
      reason
    );
    this.writeLog(entry);
  }

  /**
   * Log logout event
   */
  logLogout(userId: string, username: string, details?: Record<string, any>): void {
    const entry = this.createLogEntry(
      AuditEventType.AUTH_LOGOUT,
      userId,
      username,
      'success',
      details
    );
    this.writeLog(entry);
  }

  /**
   * Log token refresh
   */
  logTokenRefresh(userId: string, username: string, success: boolean, reason?: string): void {
    const entry = this.createLogEntry(
      AuditEventType.TOKEN_REFRESH,
      userId,
      username,
      success ? 'success' : 'failure',
      undefined,
      reason
    );
    this.writeLog(entry);
  }

  /**
   * Log token revocation
   */
  logTokenRevoked(userId: string, username: string, details?: Record<string, any>): void {
    const entry = this.createLogEntry(
      AuditEventType.TOKEN_REVOKED,
      userId,
      username,
      'success',
      details
    );
    this.writeLog(entry);
  }

  /**
   * Log authorization check
   * SECURITY: Tracks all permission checks and denials
   */
  logAuthorizationCheck(
    userId: string,
    username: string,
    resource: string,
    action: string,
    allowed: boolean,
    reason?: string
  ): void {
    const entry = this.createLogEntry(
      allowed ? AuditEventType.AUTHZ_ALLOWED : AuditEventType.AUTHZ_DENIED,
      userId,
      username,
      allowed ? 'success' : 'failure',
      { resource, action },
      reason
    );
    this.writeLog(entry);
  }

  /**
   * Log configuration change
   * SECURITY: Tracks all configuration modifications
   */
  logConfigChange(
    userId: string,
    username: string,
    changes: Record<string, any>,
    details?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(AuditEventType.CONFIG_CHANGE, userId, username, 'success', {
      ...details,
      changes: this.sanitizeDetails(changes),
    });
    this.writeLog(entry);
  }

  /**
   * Log user creation
   */
  logUserCreated(
    adminUserId: string,
    adminUsername: string,
    newUserId: string,
    newUsername: string,
    details?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(
      AuditEventType.USER_CREATED,
      adminUserId,
      adminUsername,
      'success',
      { ...details, new_user_id: newUserId, new_username: newUsername }
    );
    this.writeLog(entry);
  }

  /**
   * Log user update
   */
  logUserUpdated(
    adminUserId: string,
    adminUsername: string,
    targetUserId: string,
    targetUsername: string,
    changes: Record<string, any>
  ): void {
    const entry = this.createLogEntry(
      AuditEventType.USER_UPDATED,
      adminUserId,
      adminUsername,
      'success',
      {
        target_user_id: targetUserId,
        target_username: targetUsername,
        changes: this.sanitizeDetails(changes),
      }
    );
    this.writeLog(entry);
  }

  /**
   * Log user deletion
   */
  logUserDeleted(
    adminUserId: string,
    adminUsername: string,
    deletedUserId: string,
    deletedUsername: string
  ): void {
    const entry = this.createLogEntry(
      AuditEventType.USER_DELETED,
      adminUserId,
      adminUsername,
      'success',
      { deleted_user_id: deletedUserId, deleted_username: deletedUsername }
    );
    this.writeLog(entry);
  }

  /**
   * Log MFA events
   */
  logMFAEvent(
    event: AuditEventType,
    userId: string,
    username: string,
    success: boolean,
    reason?: string
  ): void {
    const entry = this.createLogEntry(
      event,
      userId,
      username,
      success ? 'success' : 'failure',
      undefined,
      reason
    );
    this.writeLog(entry);
  }

  /**
   * Log password change
   */
  logPasswordChanged(userId: string, username: string, forced: boolean = false): void {
    const entry = this.createLogEntry(
      AuditEventType.PASSWORD_CHANGED,
      userId,
      username,
      'success',
      { forced }
    );
    this.writeLog(entry);
  }

  /**
   * Log permission grant
   */
  logPermissionGranted(
    adminUserId: string,
    adminUsername: string,
    targetUserId: string,
    targetUsername: string,
    permission: string
  ): void {
    const entry = this.createLogEntry(
      AuditEventType.PERMISSION_GRANTED,
      adminUserId,
      adminUsername,
      'success',
      { target_user_id: targetUserId, target_username: targetUsername, permission }
    );
    this.writeLog(entry);
  }

  /**
   * Log permission revocation
   */
  logPermissionRevoked(
    adminUserId: string,
    adminUsername: string,
    targetUserId: string,
    targetUsername: string,
    permission: string
  ): void {
    const entry = this.createLogEntry(
      AuditEventType.PERMISSION_REVOKED,
      adminUserId,
      adminUsername,
      'success',
      { target_user_id: targetUserId, target_username: targetUsername, permission }
    );
    this.writeLog(entry);
  }

  /**
   * Query audit logs
   * SECURITY: Allows searching audit trail for security analysis
   */
  queryLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    event?: AuditEventType;
    result?: 'success' | 'failure';
  }): AuditLogEntry[] {
    const logs: AuditLogEntry[] = [];

    if (!this.config.logToFile) {
      return logs;
    }

    try {
      const files = fs.readdirSync(this.config.logDirectory);
      const logFiles = files.filter((f) => f.startsWith('audit-') && f.endsWith('.log'));

      for (const file of logFiles) {
        const filePath = path.join(this.config.logDirectory, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const entry: AuditLogEntry = JSON.parse(line);
            entry.timestamp = new Date(entry.timestamp); // Convert string to Date

            // Apply filters
            if (filters.startDate && entry.timestamp < filters.startDate) {continue;}
            if (filters.endDate && entry.timestamp > filters.endDate) {continue;}
            if (filters.userId && entry.user_id !== filters.userId) {continue;}
            if ((filters.event != null) && entry.event !== filters.event) {continue;}
            if (filters.result && entry.result !== filters.result) {continue;}

            logs.push(entry);
          } catch (error) {
            // Skip malformed log lines
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Failed to query audit logs:', error);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clean up old audit logs
   */
  cleanupOldLogs(): void {
    if (!this.config.logToFile) {
      return;
    }

    try {
      const files = fs.readdirSync(this.config.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      for (const file of files) {
        if (!file.startsWith('audit-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.config.logDirectory, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
  }

  /**
   * Close audit logger and cleanup resources
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }
}

/**
 * Singleton instance for global use
 */
let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get or create audit logger instance
 */
export function getAuditLogger(config?: Partial<AuditLoggerConfig>): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(config);
  }
  return auditLoggerInstance;
}

/**
 * Reset audit logger instance (for testing)
 */
export function resetAuditLogger(): void {
  if (auditLoggerInstance) {
    auditLoggerInstance.close();
    auditLoggerInstance = null;
  }
}
