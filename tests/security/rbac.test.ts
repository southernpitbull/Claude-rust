/**
 * RBAC Tests
 * Comprehensive security tests for role-based access control
 */

import { RBACManager, resetRBACManager, PERMISSIONS, ROLE_DEFINITIONS } from '../../src/security/rbac';
import { Role, User } from '../../src/security/types';

describe('RBACManager', () => {
  let rbacManager: RBACManager;

  beforeEach(() => {
    resetRBACManager();
    rbacManager = new RBACManager();
  });

  const createTestUser = (roles: Role[]): User => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    roles,
    permissions: [],
    created_at: new Date(),
    mfa_enabled: false
  });

  describe('Role Hierarchy', () => {
    it('should grant admin all permissions', () => {
      const adminUser = createTestUser([Role.ADMIN]);
      const permissions = rbacManager.getUserPermissions(adminUser);

      expect(permissions).toContain('admin:all');
      expect(permissions).toContain('ai:generate');
      expect(permissions).toContain('project:write');
    });

    it('should grant developer permissions', () => {
      const devUser = createTestUser([Role.DEVELOPER]);
      const permissions = rbacManager.getUserPermissions(devUser);

      expect(permissions).toContain('ai:generate');
      expect(permissions).toContain('project:write');
      expect(permissions).toContain('memory:read');
      expect(permissions).not.toContain('admin:all');
    });

    it('should grant analyst limited permissions', () => {
      const analystUser = createTestUser([Role.ANALYST]);
      const permissions = rbacManager.getUserPermissions(analystUser);

      expect(permissions).toContain('memory:read');
      expect(permissions).toContain('agent:read');
      expect(permissions).not.toContain('ai:generate');
      expect(permissions).not.toContain('project:write');
    });

    it('should grant readonly minimal permissions', () => {
      const readonlyUser = createTestUser([Role.READONLY]);
      const permissions = rbacManager.getUserPermissions(readonlyUser);

      expect(permissions).toContain('agent:read');
      expect(permissions).toContain('config:read');
      expect(permissions).not.toContain('memory:read');
      expect(permissions).not.toContain('ai:generate');
    });

    it('should respect role hierarchy (admin inherits all)', () => {
      const adminUser = createTestUser([Role.ADMIN]);

      expect(rbacManager.hasRole(adminUser, Role.ADMIN)).toBe(true);
      expect(rbacManager.hasRole(adminUser, Role.DEVELOPER)).toBe(true);
      expect(rbacManager.hasRole(adminUser, Role.ANALYST)).toBe(true);
      expect(rbacManager.hasRole(adminUser, Role.READONLY)).toBe(true);
    });
  });

  describe('Permission Checking', () => {
    it('should allow admin access to all permissions', () => {
      const adminUser = createTestUser([Role.ADMIN]);

      expect(rbacManager.hasPermission(adminUser, 'admin:all')).toBe(true);
      expect(rbacManager.hasPermission(adminUser, 'ai:generate')).toBe(true);
      expect(rbacManager.hasPermission(adminUser, 'user:manage')).toBe(true);
    });

    it('should deny analyst access to AI generation', () => {
      const analystUser = createTestUser([Role.ANALYST]);

      expect(rbacManager.hasPermission(analystUser, 'ai:generate')).toBe(false);
      expect(rbacManager.hasPermission(analystUser, 'project:write')).toBe(false);
    });

    it('should deny readonly access to memory write', () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      expect(rbacManager.hasPermission(readonlyUser, 'memory:read')).toBe(false);
      expect(rbacManager.hasPermission(readonlyUser, 'memory:write')).toBe(false);
    });

    it('should handle wildcard admin permission', () => {
      const adminUser = createTestUser([Role.ADMIN]);

      expect(rbacManager.hasPermission(adminUser, 'any:custom:permission')).toBe(true);
    });
  });

  describe('Resource Access', () => {
    it('should allow developer to execute AI commands', () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      expect(rbacManager.hasResourceAccess(devUser, '/ai', 'execute')).toBe(true);
      expect(rbacManager.hasResourceAccess(devUser, '/ai/chat', 'execute')).toBe(true);
    });

    it('should deny analyst access to AI commands', () => {
      const analystUser = createTestUser([Role.ANALYST]);

      expect(rbacManager.hasResourceAccess(analystUser, '/ai', 'execute')).toBe(false);
    });

    it('should allow analyst to read memory', () => {
      const analystUser = createTestUser([Role.ANALYST]);

      expect(rbacManager.hasResourceAccess(analystUser, '/memory', 'read')).toBe(true);
      expect(rbacManager.hasResourceAccess(analystUser, '/memory', 'search')).toBe(true);
    });

    it('should deny readonly access to project modifications', () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      expect(rbacManager.hasResourceAccess(readonlyUser, '/project', 'write')).toBe(false);
      expect(rbacManager.hasResourceAccess(readonlyUser, '/project', 'update')).toBe(false);
    });

    it('should handle resource paths with and without leading slash', () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      expect(rbacManager.hasResourceAccess(devUser, 'ai', 'execute')).toBe(true);
      expect(rbacManager.hasResourceAccess(devUser, '/ai', 'execute')).toBe(true);
    });
  });

  describe('Multiple Roles', () => {
    it('should combine permissions from multiple roles', () => {
      const multiRoleUser = createTestUser([Role.DEVELOPER, Role.ANALYST]);
      const permissions = rbacManager.getUserPermissions(multiRoleUser);

      // Should have both developer and analyst permissions
      expect(permissions).toContain('ai:generate'); // developer
      expect(permissions).toContain('memory:read'); // both
      expect(permissions).toContain('project:read'); // both
    });
  });

  describe('Custom Permissions', () => {
    it('should include explicit user permissions', () => {
      const user = createTestUser([Role.READONLY]);
      user.permissions = ['custom:permission'];

      const permissions = rbacManager.getUserPermissions(user);

      expect(permissions).toContain('custom:permission');
      expect(rbacManager.hasPermission(user, 'custom:permission')).toBe(true);
    });
  });

  describe('Highest Role', () => {
    it('should identify admin as highest role', () => {
      const adminUser = createTestUser([Role.ADMIN]);

      expect(rbacManager.getHighestRole(adminUser)).toBe(Role.ADMIN);
    });

    it('should identify developer as highest when user has developer and analyst', () => {
      const user = createTestUser([Role.DEVELOPER, Role.ANALYST]);

      expect(rbacManager.getHighestRole(user)).toBe(Role.DEVELOPER);
    });
  });

  describe('Permission Validation', () => {
    it('should validate permission format', () => {
      expect(rbacManager.isValidPermission('ai:generate')).toBe(true);
      expect(rbacManager.isValidPermission('admin:all')).toBe(true);
      expect(rbacManager.isValidPermission('invalid-format')).toBe(false);
      expect(rbacManager.isValidPermission('too:many:parts')).toBe(false);
    });
  });

  describe('Role Definitions', () => {
    it('should have correct admin role definition', () => {
      const adminDef = ROLE_DEFINITIONS[Role.ADMIN];

      expect(adminDef.role).toBe(Role.ADMIN);
      expect(adminDef.permissions).toContain('admin:all');
      expect(adminDef.permissions).toContain('user:manage');
    });

    it('should have all required permissions defined', () => {
      expect(PERMISSIONS.AI_GENERATE).toBeDefined();
      expect(PERMISSIONS.PROJECT_WRITE).toBeDefined();
      expect(PERMISSIONS.MEMORY_READ).toBeDefined();
      expect(PERMISSIONS.ADMIN_ALL).toBeDefined();
    });
  });
});
