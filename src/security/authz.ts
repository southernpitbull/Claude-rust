/**
 * Authorization System
 * AIrchitect Security System
 *
 * Implements authorization with RBAC, ABAC, and policy-based access control.
 * SECURITY: Replaces broken stub that always returned true.
 */

import { User, Policy, PolicyContext, PolicyCondition, AuthorizationError } from './types';
import { getRBACManager } from './rbac';
import { getAuditLogger } from './audit-logger';

/**
 * Policy storage interface
 */
interface PolicyStore {
  [policyId: string]: Policy;
}

/**
 * Authorization Manager
 */
export class AuthorizationManager {
  private policies: PolicyStore = {};
  private rbacManager = getRBACManager();
  private auditLogger = getAuditLogger();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default policies
   */
  private initializeDefaultPolicies(): void {
    // Allow admins full access
    this.addPolicy({
      id: 'admin-full-access',
      name: 'Admin Full Access',
      effect: 'allow',
      actions: ['*'],
      resources: ['*'],
      conditions: [
        {
          attribute: 'user.roles',
          operator: 'contains',
          value: 'admin',
        },
      ],
    });

    // Allow developers to use AI features
    this.addPolicy({
      id: 'developer-ai-access',
      name: 'Developer AI Access',
      effect: 'allow',
      actions: ['execute'],
      resources: ['/ai/*'],
      conditions: [
        {
          attribute: 'user.roles',
          operator: 'contains',
          value: 'developer',
        },
      ],
    });

    // Allow analysts to search memory
    this.addPolicy({
      id: 'analyst-memory-access',
      name: 'Analyst Memory Access',
      effect: 'allow',
      actions: ['read', 'search'],
      resources: ['/memory/*'],
      conditions: [
        {
          attribute: 'user.roles',
          operator: 'contains',
          value: 'analyst',
        },
      ],
    });
  }

  /**
   * Add a new policy
   */
  addPolicy(policy: Policy): void {
    this.policies[policy.id] = policy;
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): void {
    delete this.policies[policyId];
  }

  /**
   * Get all policies
   */
  getPolicies(): Policy[] {
    return Object.values(this.policies);
  }

  /**
   * Evaluate a policy condition
   * SECURITY: Implements ABAC attribute-based conditions
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    // Extract attribute value from context
    const attributePath = condition.attribute.split('.');
    let value: any = context;

    for (const part of attributePath) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return false;
      }
    }

    // Apply operator
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(condition.value);
        }
        if (typeof value === 'string') {
          return value.includes(condition.value);
        }
        return false;

      case 'startsWith':
        return typeof value === 'string' && value.startsWith(condition.value);

      case 'endsWith':
        return typeof value === 'string' && value.endsWith(condition.value);

      case 'gt':
        return typeof value === 'number' && value > condition.value;

      case 'lt':
        return typeof value === 'number' && value < condition.value;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      default:
        return false;
    }
  }

  /**
   * Evaluate a policy against context
   * SECURITY: Evaluates all conditions for policy decision
   */
  private evaluatePolicy(policy: Policy, context: PolicyContext): boolean {
    // Check if resource matches (with wildcard support)
    const resourceMatches = policy.resources.some((policyResource) => {
      if (policyResource === '*') {return true;}
      if (policyResource.endsWith('/*')) {
        const base = policyResource.slice(0, -2);
        return context.resource.startsWith(base);
      }
      return context.resource === policyResource;
    });

    if (!resourceMatches) {
      return false;
    }

    // Check if action matches (with wildcard support)
    const actionMatches = policy.actions.includes('*') || policy.actions.includes(context.action);
    if (!actionMatches) {
      return false;
    }

    // Evaluate all conditions (all must pass)
    if (policy.conditions) {
      const allConditionsMet = policy.conditions.every((condition) =>
        this.evaluateCondition(condition, context)
      );
      if (!allConditionsMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * Authorize user access to resource with action
   * SECURITY: This replaces the broken stub that always returned true
   */
  async authorize(user: User, resource: string, action: string = 'execute'): Promise<boolean> {
    // Validate inputs
    if (!user || !resource) {
      throw new AuthorizationError('Invalid authorization request', 'INVALID_REQUEST');
    }

    // Normalize resource path
    const normalizedResource = resource.startsWith('/') ? resource : `/${resource}`;

    // Create policy context
    const context: PolicyContext = {
      user,
      resource: normalizedResource,
      action,
      context: {},
    };

    // First, check RBAC permissions
    const hasRBACAccess = this.rbacManager.hasResourceAccess(user, normalizedResource, action);

    // Then, evaluate policies (ABAC)
    const allowPolicies: Policy[] = [];
    const denyPolicies: Policy[] = [];

    for (const policy of Object.values(this.policies)) {
      if (this.evaluatePolicy(policy, context)) {
        if (policy.effect === 'allow') {
          allowPolicies.push(policy);
        } else if (policy.effect === 'deny') {
          denyPolicies.push(policy);
        }
      }
    }

    // Deny takes precedence over allow
    if (denyPolicies.length > 0) {
      this.auditLogger.logAuthorizationCheck(
        user.id,
        user.username,
        normalizedResource,
        action,
        false,
        'Denied by policy'
      );
      return false;
    }

    // Allow if either RBAC or policy allows
    const allowed = hasRBACAccess || allowPolicies.length > 0;

    // Log authorization decision
    this.auditLogger.logAuthorizationCheck(
      user.id,
      user.username,
      normalizedResource,
      action,
      allowed,
      allowed ? undefined : 'No matching permissions or policies'
    );

    return allowed;
  }

  /**
   * Check if user has specific permission
   * SECURITY: Validates permission against RBAC system
   */
  async checkPermission(user: User, permission: string): Promise<boolean> {
    const hasPermission = this.rbacManager.hasPermission(user, permission);

    this.auditLogger.logAuthorizationCheck(
      user.id,
      user.username,
      permission,
      'check',
      hasPermission,
      hasPermission ? undefined : 'Permission not granted'
    );

    return hasPermission;
  }

  /**
   * Evaluate policy with custom context
   * SECURITY: Allows complex ABAC policy evaluation
   */
  async evaluatePolicyContext(policyContext: PolicyContext): Promise<boolean> {
    // Evaluate all policies
    const allowPolicies: Policy[] = [];
    const denyPolicies: Policy[] = [];

    for (const policy of Object.values(this.policies)) {
      if (this.evaluatePolicy(policy, policyContext)) {
        if (policy.effect === 'allow') {
          allowPolicies.push(policy);
        } else if (policy.effect === 'deny') {
          denyPolicies.push(policy);
        }
      }
    }

    // Deny takes precedence
    if (denyPolicies.length > 0) {
      return false;
    }

    return allowPolicies.length > 0;
  }

  /**
   * Require authorization (throws if denied)
   * SECURITY: Convenient method for enforcing authorization
   */
  async requireAuthorization(
    user: User,
    resource: string,
    action: string = 'execute'
  ): Promise<void> {
    const allowed = await this.authorize(user, resource, action);
    if (!allowed) {
      throw new AuthorizationError(
        `Access denied to ${resource} for action ${action}`,
        'ACCESS_DENIED'
      );
    }
  }

  /**
   * Require permission (throws if not granted)
   * SECURITY: Convenient method for enforcing permissions
   */
  async requirePermission(user: User, permission: string): Promise<void> {
    const hasPermission = await this.checkPermission(user, permission);
    if (!hasPermission) {
      throw new AuthorizationError(`Permission ${permission} not granted`, 'PERMISSION_DENIED');
    }
  }

  /**
   * Get effective permissions for user
   */
  getUserPermissions(user: User): string[] {
    return this.rbacManager.getUserPermissions(user);
  }

  /**
   * Get allowed resources for user
   */
  async getAllowedResources(user: User, action: string = 'read'): Promise<string[]> {
    const allowedResources: string[] = [];

    // Check all known resources
    const resources = [
      '/ai',
      '/ai/chat',
      '/ai/complete',
      '/project',
      '/project/init',
      '/memory',
      '/agents',
      '/config',
      '/users',
      '/audit',
    ];

    for (const resource of resources) {
      const allowed = await this.authorize(user, resource, action);
      if (allowed) {
        allowedResources.push(resource);
      }
    }

    return allowedResources;
  }

  /**
   * Create a deny policy for specific user
   */
  denyUserAccess(userId: string, resource: string, actions: string[] = ['*']): void {
    const policyId = `deny-${userId}-${resource.replace(/\//g, '-')}`;
    this.addPolicy({
      id: policyId,
      name: `Deny ${userId} access to ${resource}`,
      effect: 'deny',
      actions,
      resources: [resource],
      conditions: [
        {
          attribute: 'user.id',
          operator: 'equals',
          value: userId,
        },
      ],
    });
  }

  /**
   * Remove deny policy for user
   */
  allowUserAccess(userId: string, resource: string): void {
    const policyId = `deny-${userId}-${resource.replace(/\//g, '-')}`;
    this.removePolicy(policyId);
  }

  /**
   * Check if user is admin
   */
  isAdmin(user: User): boolean {
    return this.rbacManager.hasRole(user, 'admin' as any);
  }

  /**
   * Validate access with detailed reason
   */
  async validateAccess(
    user: User,
    resource: string,
    action: string = 'execute'
  ): Promise<{ allowed: boolean; reason: string }> {
    const normalizedResource = resource.startsWith('/') ? resource : `/${resource}`;

    // Check RBAC
    const hasRBACAccess = this.rbacManager.hasResourceAccess(user, normalizedResource, action);
    if (hasRBACAccess) {
      return { allowed: true, reason: 'RBAC permission granted' };
    }

    // Check policies
    const context: PolicyContext = {
      user,
      resource: normalizedResource,
      action,
      context: {},
    };

    const denyPolicies = Object.values(this.policies).filter(
      (p) => p.effect === 'deny' && this.evaluatePolicy(p, context)
    );

    if (denyPolicies.length > 0) {
      return { allowed: false, reason: `Denied by policy: ${denyPolicies[0].name}` };
    }

    const allowPolicies = Object.values(this.policies).filter(
      (p) => p.effect === 'allow' && this.evaluatePolicy(p, context)
    );

    if (allowPolicies.length > 0) {
      return { allowed: true, reason: `Allowed by policy: ${allowPolicies[0].name}` };
    }

    return { allowed: false, reason: 'No matching permissions or policies' };
  }
}

/**
 * Singleton instance for global use
 */
let authzManagerInstance: AuthorizationManager | null = null;

/**
 * Get or create authorization manager instance
 */
export function getAuthzManager(): AuthorizationManager {
  if (!authzManagerInstance) {
    authzManagerInstance = new AuthorizationManager();
  }
  return authzManagerInstance;
}

/**
 * Reset authorization manager instance (for testing)
 */
export function resetAuthzManager(): void {
  authzManagerInstance = null;
}

/**
 * Convenience function for authorization
 * SECURITY: This replaces the broken stub that always returned true
 */
export async function authorize(
  user: User,
  resource: string,
  action: string = 'execute'
): Promise<boolean> {
  const authzManager = getAuthzManager();
  return authzManager.authorize(user, resource, action);
}
