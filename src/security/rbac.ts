/**
 * Role-Based Access Control (RBAC)
 * AIrchitect Security System
 *
 * Implements role hierarchy, permissions, and access control policies.
 * SECURITY: Enforces principle of least privilege with role-based permissions.
 */

import { Role, RoleDefinition, Permission, User, AuthorizationError } from './types';

/**
 * Permission definitions for AIrchitect resources
 */
export const PERMISSIONS: Record<string, Permission> = {
  // AI Command Permissions
  AI_GENERATE: {
    id: 'ai:generate',
    name: 'AI Generate',
    description: 'Generate code using AI',
    resource: '/ai',
    actions: ['execute'],
  },
  AI_CHAT: {
    id: 'ai:chat',
    name: 'AI Chat',
    description: 'Interactive chat with AI',
    resource: '/ai/chat',
    actions: ['execute'],
  },
  AI_COMPLETE: {
    id: 'ai:complete',
    name: 'AI Complete',
    description: 'Code completion with AI',
    resource: '/ai/complete',
    actions: ['execute'],
  },

  // Project Permissions
  PROJECT_READ: {
    id: 'project:read',
    name: 'Project Read',
    description: 'Read project information',
    resource: '/project',
    actions: ['read'],
  },
  PROJECT_WRITE: {
    id: 'project:write',
    name: 'Project Write',
    description: 'Modify project configuration',
    resource: '/project',
    actions: ['create', 'update', 'delete'],
  },
  PROJECT_INIT: {
    id: 'project:init',
    name: 'Project Initialize',
    description: 'Initialize new projects',
    resource: '/project/init',
    actions: ['execute'],
  },

  // Memory Permissions
  MEMORY_READ: {
    id: 'memory:read',
    name: 'Memory Read',
    description: 'Read from collective memory',
    resource: '/memory',
    actions: ['read', 'search', 'list'],
  },
  MEMORY_WRITE: {
    id: 'memory:write',
    name: 'Memory Write',
    description: 'Write to collective memory',
    resource: '/memory',
    actions: ['create', 'update', 'delete'],
  },

  // Agent Permissions
  AGENT_READ: {
    id: 'agent:read',
    name: 'Agent Read',
    description: 'View agent information',
    resource: '/agents',
    actions: ['read', 'list'],
  },
  AGENT_EXECUTE: {
    id: 'agent:execute',
    name: 'Agent Execute',
    description: 'Execute agent tasks',
    resource: '/agents',
    actions: ['execute'],
  },
  AGENT_MANAGE: {
    id: 'agent:manage',
    name: 'Agent Manage',
    description: 'Manage agent configurations',
    resource: '/agents',
    actions: ['create', 'update', 'delete'],
  },

  // Configuration Permissions
  CONFIG_READ: {
    id: 'config:read',
    name: 'Config Read',
    description: 'Read configuration',
    resource: '/config',
    actions: ['read'],
  },
  CONFIG_WRITE: {
    id: 'config:write',
    name: 'Config Write',
    description: 'Modify configuration',
    resource: '/config',
    actions: ['update'],
  },

  // Admin Permissions
  ADMIN_ALL: {
    id: 'admin:all',
    name: 'Admin All',
    description: 'Full administrative access',
    resource: '*',
    actions: ['*'],
  },
  USER_MANAGE: {
    id: 'user:manage',
    name: 'User Manage',
    description: 'Manage users and permissions',
    resource: '/users',
    actions: ['create', 'read', 'update', 'delete'],
  },
  AUDIT_READ: {
    id: 'audit:read',
    name: 'Audit Read',
    description: 'Read audit logs',
    resource: '/audit',
    actions: ['read'],
  },
};

/**
 * Role definitions with hierarchical permissions
 */
export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  [Role.ADMIN]: {
    role: Role.ADMIN,
    permissions: [
      'admin:all',
      'user:manage',
      'audit:read',
      'ai:generate',
      'ai:chat',
      'ai:complete',
      'project:read',
      'project:write',
      'project:init',
      'memory:read',
      'memory:write',
      'agent:read',
      'agent:execute',
      'agent:manage',
      'config:read',
      'config:write',
    ],
  },
  [Role.DEVELOPER]: {
    role: Role.DEVELOPER,
    permissions: [
      'ai:generate',
      'ai:chat',
      'ai:complete',
      'project:read',
      'project:write',
      'project:init',
      'memory:read',
      'agent:read',
      'agent:execute',
      'config:read',
    ],
  },
  [Role.ANALYST]: {
    role: Role.ANALYST,
    permissions: ['memory:read', 'agent:read', 'project:read', 'config:read'],
  },
  [Role.READONLY]: {
    role: Role.READONLY,
    permissions: ['agent:read', 'config:read'],
  },
};

/**
 * RBAC Manager - Handles role and permission checks
 */
export class RBACManager {
  private roleHierarchy: Map<Role, Set<Role>> = new Map();

  constructor() {
    this.initializeRoleHierarchy();
  }

  /**
   * Initialize role hierarchy
   * SECURITY: Admin inherits all roles, developer inherits analyst and readonly
   */
  private initializeRoleHierarchy(): void {
    this.roleHierarchy.set(
      Role.ADMIN,
      new Set([Role.ADMIN, Role.DEVELOPER, Role.ANALYST, Role.READONLY])
    );
    this.roleHierarchy.set(Role.DEVELOPER, new Set([Role.DEVELOPER, Role.ANALYST, Role.READONLY]));
    this.roleHierarchy.set(Role.ANALYST, new Set([Role.ANALYST, Role.READONLY]));
    this.roleHierarchy.set(Role.READONLY, new Set([Role.READONLY]));
  }

  /**
   * Get all permissions for a role (including inherited)
   * SECURITY: Returns complete permission set based on role hierarchy
   */
  getPermissionsForRole(role: Role): string[] {
    const effectiveRoles = this.roleHierarchy.get(role) || new Set([role]);
    const allPermissions = new Set<string>();

    for (const effectiveRole of effectiveRoles) {
      const roleDef = ROLE_DEFINITIONS[effectiveRole];
      if (roleDef) {
        roleDef.permissions.forEach((perm) => allPermissions.add(perm));
      }
    }

    return Array.from(allPermissions);
  }

  /**
   * Get all permissions for a user
   * SECURITY: Aggregates permissions from all user roles
   */
  getUserPermissions(user: User): string[] {
    const allPermissions = new Set<string>();

    // Add permissions from all user roles
    for (const role of user.roles) {
      const rolePermissions = this.getPermissionsForRole(role);
      rolePermissions.forEach((perm) => allPermissions.add(perm));
    }

    // Add explicit user permissions
    if (user.permissions) {
      user.permissions.forEach((perm) => allPermissions.add(perm));
    }

    return Array.from(allPermissions);
  }

  /**
   * Check if user has a specific permission
   * SECURITY: Validates permission against user's complete permission set
   */
  hasPermission(user: User, permission: string): boolean {
    const userPermissions = this.getUserPermissions(user);

    // Check for exact match
    if (userPermissions.includes(permission)) {
      return true;
    }

    // Check for wildcard admin permission
    if (userPermissions.includes('admin:all')) {
      return true;
    }

    // Check for resource-level wildcards
    const [resource, action] = permission.split(':');
    const wildcardPermission = `${resource}:*`;
    if (userPermissions.includes(wildcardPermission)) {
      return true;
    }

    return false;
  }

  /**
   * Check if user has access to a resource with specific action
   * SECURITY: Validates resource access based on permission model
   */
  hasResourceAccess(user: User, resource: string, action: string): boolean {
    // Normalize resource path
    const normalizedResource = resource.startsWith('/') ? resource : `/${resource}`;

    // Find matching permissions
    for (const [permId, permission] of Object.entries(PERMISSIONS)) {
      // Check if user has this permission
      if (!this.hasPermission(user, permission.id)) {
        continue;
      }

      // Check if resource matches
      if (permission.resource === '*' || normalizedResource.startsWith(permission.resource)) {
        // Check if action matches
        if (permission.actions.includes('*') || permission.actions.includes(action)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if user has any of the specified roles
   * SECURITY: Validates role membership with hierarchy support
   */
  hasRole(user: User, ...roles: Role[]): boolean {
    for (const userRole of user.roles) {
      const effectiveRoles = this.roleHierarchy.get(userRole) || new Set([userRole]);
      for (const requiredRole of roles) {
        if (effectiveRoles.has(requiredRole)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(user: User, ...roles: Role[]): boolean {
    const userEffectiveRoles = new Set<Role>();
    for (const userRole of user.roles) {
      const effectiveRoles = this.roleHierarchy.get(userRole) || new Set([userRole]);
      effectiveRoles.forEach((role) => userEffectiveRoles.add(role));
    }

    return roles.every((role) => userEffectiveRoles.has(role));
  }

  /**
   * Get highest role in user's role set
   */
  getHighestRole(user: User): Role | null {
    const roleOrder = [Role.ADMIN, Role.DEVELOPER, Role.ANALYST, Role.READONLY];
    for (const role of roleOrder) {
      if (this.hasRole(user, role)) {
        return role;
      }
    }
    return null;
  }

  /**
   * Validate permission ID format
   */
  isValidPermission(permission: string): boolean {
    return /^[a-z]+:[a-z*]+$/.test(permission);
  }

  /**
   * Get all permissions for display
   */
  getAllPermissions(): Permission[] {
    return Object.values(PERMISSIONS);
  }

  /**
   * Get permission by ID
   */
  getPermission(permissionId: string): Permission | undefined {
    return Object.values(PERMISSIONS).find((p) => p.id === permissionId);
  }

  /**
   * Check if role can perform action on resource
   */
  canRoleAccess(role: Role, resource: string, action: string): boolean {
    const mockUser: User = {
      id: 'mock',
      username: 'mock',
      email: 'mock@example.com',
      roles: [role],
      permissions: [],
      created_at: new Date(),
      mfa_enabled: false,
    };

    return this.hasResourceAccess(mockUser, resource, action);
  }
}

/**
 * Singleton instance for global use
 */
let rbacManagerInstance: RBACManager | null = null;

/**
 * Get or create RBAC manager instance
 */
export function getRBACManager(): RBACManager {
  if (!rbacManagerInstance) {
    rbacManagerInstance = new RBACManager();
  }
  return rbacManagerInstance;
}

/**
 * Reset RBAC manager instance (for testing)
 */
export function resetRBACManager(): void {
  rbacManagerInstance = null;
}
