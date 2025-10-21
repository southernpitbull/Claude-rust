/**
 * Audit Logger for compliance and security audit trails
 * Provides tamper-evident logging, actor tracking, and compliance reporting
 */

import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type { StructuredLogger } from './StructuredLogger.js';
import type { IAuditLogEntry, LogCategory } from './types.js';

/**
 * Actor type enumeration
 */
export type ActorType = 'user' | 'system' | 'agent' | 'api' | 'service';

/**
 * Audit action type
 */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'access'
  | 'authenticate'
  | 'authorize'
  | 'configure'
  | 'export'
  | 'import';

/**
 * Audit result type
 */
export type AuditResult = 'success' | 'failure' | 'partial' | 'denied';

/**
 * Actor information
 */
export interface IActor {
  /** Actor ID */
  id: string;

  /** Actor type */
  type: ActorType;

  /** Actor name */
  name?: string;

  /** Actor email */
  email?: string;

  /** Actor roles */
  roles?: string[];

  /** Actor IP address */
  ipAddress?: string;

  /** User agent */
  userAgent?: string;

  /** Session ID */
  sessionId?: string;
}

/**
 * Resource information
 */
export interface IResource {
  /** Resource type */
  type: string;

  /** Resource ID */
  id: string;

  /** Resource name */
  name?: string;

  /** Resource owner */
  owner?: string;

  /** Resource metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Audit event
 */
export interface IAuditEvent {
  /** Event ID */
  id: string;

  /** Timestamp */
  timestamp: Date;

  /** Actor who performed the action */
  actor: IActor;

  /** Action performed */
  action: AuditAction;

  /** Resource affected */
  resource: IResource;

  /** Result of the action */
  result: AuditResult;

  /** Reason for the result */
  reason?: string;

  /** Changes made (for update actions) */
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };

  /** Additional context */
  context?: Record<string, unknown>;

  /** Compliance tags */
  complianceTags?: string[];

  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';

  /** Hash of previous event (for chain integrity) */
  previousHash?: string;

  /** Hash of this event */
  hash?: string;
}

/**
 * Audit configuration
 */
export interface IAuditConfig {
  /** Enable tamper-evident logging */
  tamperEvident: boolean;

  /** Include sensitive data */
  includeSensitiveData: boolean;

  /** Compliance standards to follow */
  complianceStandards?: ('GDPR' | 'HIPAA' | 'SOC2' | 'PCI-DSS')[];

  /** Retention period in days */
  retentionDays?: number;

  /** Enable encryption */
  encrypted?: boolean;

  /** Required fields */
  requiredFields?: (keyof IAuditEvent)[];
}

/**
 * Audit Logger implementation
 */
export class AuditLogger {
  private readonly logger: StructuredLogger;
  private readonly config: IAuditConfig;
  private lastEventHash?: string;
  private eventCount = 0;

  constructor(logger: StructuredLogger, config?: Partial<IAuditConfig>) {
    this.logger = logger;
    this.config = {
      tamperEvident: config?.tamperEvident ?? true,
      includeSensitiveData: config?.includeSensitiveData ?? false,
      complianceStandards: config?.complianceStandards,
      retentionDays: config?.retentionDays,
      encrypted: config?.encrypted ?? false,
      requiredFields: config?.requiredFields,
    };
  }

  /**
   * Log an audit event
   */
  public logEvent(
    actor: IActor,
    action: AuditAction,
    resource: IResource,
    result: AuditResult,
    options?: {
      reason?: string;
      changes?: IAuditEvent['changes'];
      context?: Record<string, unknown>;
      complianceTags?: string[];
      severity?: IAuditEvent['severity'];
    }
  ): IAuditEvent {
    const event: IAuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      actor: this.sanitizeActor(actor),
      action,
      resource: this.sanitizeResource(resource),
      result,
      reason: options?.reason,
      changes: options?.changes,
      context: options?.context,
      complianceTags: options?.complianceTags,
      severity: options?.severity || this.calculateSeverity(action, result),
    };

    // Add chain integrity
    if (this.config.tamperEvident) {
      event.previousHash = this.lastEventHash;
      event.hash = this.computeEventHash(event);
      this.lastEventHash = event.hash;
    }

    // Validate required fields
    this.validateEvent(event);

    // Log the event
    this.logAuditEvent(event);

    this.eventCount++;
    return event;
  }

  /**
   * Log a create action
   */
  public logCreate(
    actor: IActor,
    resource: IResource,
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'create', resource, result, { context });
  }

  /**
   * Log a read action
   */
  public logRead(
    actor: IActor,
    resource: IResource,
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'read', resource, result, { context });
  }

  /**
   * Log an update action
   */
  public logUpdate(
    actor: IActor,
    resource: IResource,
    changes: IAuditEvent['changes'],
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'update', resource, result, { changes, context });
  }

  /**
   * Log a delete action
   */
  public logDelete(
    actor: IActor,
    resource: IResource,
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'delete', resource, result, { context });
  }

  /**
   * Log an access attempt
   */
  public logAccess(
    actor: IActor,
    resource: IResource,
    result: AuditResult,
    reason?: string,
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'access', resource, result, { reason, context });
  }

  /**
   * Log an authentication attempt
   */
  public logAuthentication(
    actor: IActor,
    result: AuditResult,
    reason?: string,
    context?: Record<string, unknown>
  ): IAuditEvent {
    const resource: IResource = {
      type: 'authentication',
      id: 'auth-system',
      name: 'Authentication System',
    };
    return this.logEvent(actor, 'authenticate', resource, result, {
      reason,
      context,
      severity: result === 'failure' ? 'high' : 'low',
    });
  }

  /**
   * Log an authorization attempt
   */
  public logAuthorization(
    actor: IActor,
    resource: IResource,
    result: AuditResult,
    reason?: string,
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'authorize', resource, result, {
      reason,
      context,
      severity: result === 'denied' ? 'medium' : 'low',
    });
  }

  /**
   * Log a configuration change
   */
  public logConfiguration(
    actor: IActor,
    resource: IResource,
    changes: IAuditEvent['changes'],
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'configure', resource, result, {
      changes,
      context,
      severity: 'high',
      complianceTags: ['configuration-change'],
    });
  }

  /**
   * Log a data export
   */
  public logExport(
    actor: IActor,
    resource: IResource,
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'export', resource, result, {
      context,
      severity: 'medium',
      complianceTags: ['data-export'],
    });
  }

  /**
   * Log a data import
   */
  public logImport(
    actor: IActor,
    resource: IResource,
    result: AuditResult = 'success',
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, 'import', resource, result, {
      context,
      severity: 'medium',
      complianceTags: ['data-import'],
    });
  }

  /**
   * Log a security event
   */
  public logSecurityEvent(
    actor: IActor,
    action: AuditAction,
    resource: IResource,
    result: AuditResult,
    reason?: string,
    context?: Record<string, unknown>
  ): IAuditEvent {
    return this.logEvent(actor, action, resource, result, {
      reason,
      context,
      severity: 'critical',
      complianceTags: ['security-event'],
    });
  }

  /**
   * Verify audit trail integrity
   */
  public verifyIntegrity(events: IAuditEvent[]): {
    valid: boolean;
    errors: string[];
  } {
    if (!this.config.tamperEvident) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    let previousHash: string | undefined;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Check previous hash
      if (event.previousHash !== previousHash) {
        errors.push(
          `Event ${i} (${event.id}): Previous hash mismatch. Expected ${previousHash}, got ${event.previousHash}`
        );
      }

      // Verify event hash
      const computedHash = this.computeEventHash(event);
      if (event.hash !== computedHash) {
        errors.push(
          `Event ${i} (${event.id}): Hash mismatch. Expected ${computedHash}, got ${event.hash}`
        );
      }

      previousHash = event.hash;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get event count
   */
  public getEventCount(): number {
    return this.eventCount;
  }

  /**
   * Get last event hash
   */
  public getLastEventHash(): string | undefined {
    return this.lastEventHash;
  }

  /**
   * Reset audit chain
   */
  public reset(): void {
    this.lastEventHash = undefined;
    this.eventCount = 0;
  }

  /**
   * Sanitize actor information
   */
  private sanitizeActor(actor: IActor): IActor {
    const sanitized = { ...actor };

    if (!this.config.includeSensitiveData) {
      // Remove sensitive data
      delete sanitized.email;
      delete sanitized.ipAddress;
      delete sanitized.userAgent;
    }

    return sanitized;
  }

  /**
   * Sanitize resource information
   */
  private sanitizeResource(resource: IResource): IResource {
    const sanitized = { ...resource };

    if (!this.config.includeSensitiveData && sanitized.metadata) {
      // Remove sensitive metadata fields
      const { password, secret, token, apiKey, ...safeMeta } = sanitized.metadata as Record<
        string,
        unknown
      > & { password?: unknown; secret?: unknown; token?: unknown; apiKey?: unknown };
      sanitized.metadata = safeMeta;
    }

    return sanitized;
  }

  /**
   * Compute event hash for integrity
   */
  private computeEventHash(event: IAuditEvent): string {
    const data = {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      actor: event.actor.id,
      action: event.action,
      resource: `${event.resource.type}:${event.resource.id}`,
      result: event.result,
      previousHash: event.previousHash,
    };

    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Calculate severity level
   */
  private calculateSeverity(action: AuditAction, result: AuditResult): IAuditEvent['severity'] {
    if (result === 'failure' || result === 'denied') {
      switch (action) {
        case 'authenticate':
        case 'authorize':
        case 'delete':
          return 'high';
        case 'access':
        case 'configure':
          return 'medium';
        default:
          return 'low';
      }
    }

    switch (action) {
      case 'configure':
      case 'delete':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Validate required fields
   */
  private validateEvent(event: IAuditEvent): void {
    if (!this.config.requiredFields) {
      return;
    }

    const missing: string[] = [];
    for (const field of this.config.requiredFields) {
      if (event[field] === undefined || event[field] === null) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required audit fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Log audit event to underlying logger
   */
  private logAuditEvent(event: IAuditEvent): void {
    const logLevel = this.mapSeverityToLogLevel(event.severity);
    const category: LogCategory = 'audit';

    this.logger.log(
      logLevel,
      {
        message: `Audit: ${event.actor.type}:${event.actor.id} ${event.action} ${event.resource.type}:${event.resource.id} - ${event.result}`,
        fields: {
          audit: {
            id: event.id,
            actor: event.actor,
            action: event.action,
            resource: event.resource,
            result: event.result,
            reason: event.reason,
            changes: event.changes,
            severity: event.severity,
            complianceTags: event.complianceTags,
            hash: event.hash,
            previousHash: event.previousHash,
          },
        },
        correlationId: event.id,
        tags: ['audit', event.action, event.result, ...(event.complianceTags || [])],
      },
      {
        category,
      }
    );
  }

  /**
   * Map severity to log level
   */
  private mapSeverityToLogLevel(severity?: IAuditEvent['severity']): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      default:
        return 'info';
    }
  }
}

/**
 * Create an audit logger
 */
export function createAuditLogger(
  logger: StructuredLogger,
  config?: Partial<IAuditConfig>
): AuditLogger {
  return new AuditLogger(logger, config);
}

export default AuditLogger;
