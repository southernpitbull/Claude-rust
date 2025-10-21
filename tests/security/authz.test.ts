/**
 * Authorization Tests
 * Comprehensive security tests for authorization system
 */

import {
  AuthorizationManager,
  getAuthzManager,
  resetAuthzManager,
  authorize
} from '../../src/security/authz';
import { Role, User, AuthorizationError } from '../../src/security/types';

describe('AuthorizationManager', () => {
  let authzManager: AuthorizationManager;

  beforeEach(() => {
    resetAuthzManager();
    authzManager = new AuthorizationManager();
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

  describe('RBAC Authorization', () => {
    it('should allow admin full access', async () => {
      const adminUser = createTestUser([Role.ADMIN]);

      const canAccessAI = await authzManager.authorize(adminUser, '/ai', 'execute');
      const canAccessMemory = await authzManager.authorize(adminUser, '/memory', 'write');
      const canAccessUsers = await authzManager.authorize(adminUser, '/users', 'delete');

      expect(canAccessAI).toBe(true);
      expect(canAccessMemory).toBe(true);
      expect(canAccessUsers).toBe(true);
    });

    it('should allow developer to execute AI commands', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const canExecuteAI = await authzManager.authorize(devUser, '/ai', 'execute');
      const canChatAI = await authzManager.authorize(devUser, '/ai/chat', 'execute');

      expect(canExecuteAI).toBe(true);
      expect(canChatAI).toBe(true);
    });

    it('should deny developer access to user management', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const canManageUsers = await authzManager.authorize(devUser, '/users', 'create');

      expect(canManageUsers).toBe(false);
    });

    it('should allow analyst to read memory', async () => {
      const analystUser = createTestUser([Role.ANALYST]);

      const canReadMemory = await authzManager.authorize(analystUser, '/memory', 'read');
      const canSearchMemory = await authzManager.authorize(analystUser, '/memory', 'search');

      expect(canReadMemory).toBe(true);
      expect(canSearchMemory).toBe(true);
    });

    it('should deny analyst access to AI commands', async () => {
      const analystUser = createTestUser([Role.ANALYST]);

      const canExecuteAI = await authzManager.authorize(analystUser, '/ai', 'execute');

      expect(canExecuteAI).toBe(false);
    });

    it('should deny readonly access to write operations', async () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      const canWriteMemory = await authzManager.authorize(readonlyUser, '/memory', 'write');
      const canWriteProject = await authzManager.authorize(readonlyUser, '/project', 'write');

      expect(canWriteMemory).toBe(false);
      expect(canWriteProject).toBe(false);
    });
  });

  describe('Policy-Based Authorization (ABAC)', () => {
    it('should allow based on role condition in policy', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      // Default policy allows developers to access AI
      const canAccess = await authzManager.authorize(devUser, '/ai/generate', 'execute');

      expect(canAccess).toBe(true);
    });

    it('should deny based on custom deny policy', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      // Add deny policy for this specific user
      authzManager.denyUserAccess(devUser.id, '/ai', ['execute']);

      const canAccess = await authzManager.authorize(devUser, '/ai', 'execute');

      expect(canAccess).toBe(false);
    });

    it('should allow after removing deny policy', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      // Deny then allow
      authzManager.denyUserAccess(devUser.id, '/ai', ['execute']);
      authzManager.allowUserAccess(devUser.id, '/ai');

      const canAccess = await authzManager.authorize(devUser, '/ai', 'execute');

      expect(canAccess).toBe(true);
    });
  });

  describe('Permission Checking', () => {
    it('should check specific permissions', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const hasAIGenerate = await authzManager.checkPermission(devUser, 'ai:generate');
      const hasUserManage = await authzManager.checkPermission(devUser, 'user:manage');

      expect(hasAIGenerate).toBe(true);
      expect(hasUserManage).toBe(false);
    });

    it('should recognize admin wildcard permission', async () => {
      const adminUser = createTestUser([Role.ADMIN]);

      const hasAnyPermission = await authzManager.checkPermission(adminUser, 'admin:all');

      expect(hasAnyPermission).toBe(true);
    });
  });

  describe('Required Authorization', () => {
    it('should not throw when authorized', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      await expect(
        authzManager.requireAuthorization(devUser, '/ai', 'execute')
      ).resolves.not.toThrow();
    });

    it('should throw when not authorized', async () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      await expect(
        authzManager.requireAuthorization(readonlyUser, '/ai', 'execute')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Required Permission', () => {
    it('should not throw when permission granted', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      await expect(
        authzManager.requirePermission(devUser, 'ai:generate')
      ).resolves.not.toThrow();
    });

    it('should throw when permission not granted', async () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      await expect(
        authzManager.requirePermission(readonlyUser, 'ai:generate')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('User Permissions', () => {
    it('should get all permissions for user', () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const permissions = authzManager.getUserPermissions(devUser);

      expect(permissions).toContain('ai:generate');
      expect(permissions).toContain('project:write');
      expect(permissions).toContain('memory:read');
    });
  });

  describe('Allowed Resources', () => {
    it('should list allowed resources for developer', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const allowedResources = await authzManager.getAllowedResources(devUser, 'execute');

      expect(allowedResources).toContain('/ai');
      expect(allowedResources).toContain('/agents');
      expect(allowedResources).not.toContain('/users');
    });

    it('should list minimal resources for readonly', async () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      const allowedResources = await authzManager.getAllowedResources(readonlyUser, 'read');

      expect(allowedResources).toContain('/agents');
      expect(allowedResources).toContain('/config');
      expect(allowedResources).not.toContain('/memory');
    });
  });

  describe('Admin Check', () => {
    it('should identify admin users', () => {
      const adminUser = createTestUser([Role.ADMIN]);
      const devUser = createTestUser([Role.DEVELOPER]);

      expect(authzManager.isAdmin(adminUser)).toBe(true);
      expect(authzManager.isAdmin(devUser)).toBe(false);
    });
  });

  describe('Detailed Access Validation', () => {
    it('should provide reason for allowed access', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const result = await authzManager.validateAccess(devUser, '/ai', 'execute');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should provide reason for denied access', async () => {
      const readonlyUser = createTestUser([Role.READONLY]);

      const result = await authzManager.validateAccess(readonlyUser, '/ai', 'execute');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Resource Path Normalization', () => {
    it('should handle resources with and without leading slash', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const withSlash = await authzManager.authorize(devUser, '/ai', 'execute');
      const withoutSlash = await authzManager.authorize(devUser, 'ai', 'execute');

      expect(withSlash).toBe(true);
      expect(withoutSlash).toBe(true);
    });
  });

  describe('Wildcard Resource Matching', () => {
    it('should match wildcard resources', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      // Policy allows /ai/*
      const canAccessSubresource = await authzManager.authorize(devUser, '/ai/generate', 'execute');

      expect(canAccessSubresource).toBe(true);
    });
  });

  describe('Policy Management', () => {
    it('should add and retrieve policies', () => {
      const policiesBefore = authzManager.getPolicies();
      const countBefore = policiesBefore.length;

      authzManager.addPolicy({
        id: 'test-policy',
        name: 'Test Policy',
        effect: 'allow',
        actions: ['read'],
        resources: ['/test'],
        conditions: []
      });

      const policiesAfter = authzManager.getPolicies();

      expect(policiesAfter.length).toBe(countBefore + 1);
    });

    it('should remove policies', () => {
      authzManager.addPolicy({
        id: 'test-policy',
        name: 'Test Policy',
        effect: 'allow',
        actions: ['read'],
        resources: ['/test'],
        conditions: []
      });

      authzManager.removePolicy('test-policy');

      const policies = authzManager.getPolicies();
      const hasTestPolicy = policies.some(p => p.id === 'test-policy');

      expect(hasTestPolicy).toBe(false);
    });
  });

  describe('Convenience Function', () => {
    it('should work with global authorize function', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      const result = await authorize(devUser, '/ai', 'execute');

      expect(result).toBe(true);
    });
  });

  describe('Invalid Inputs', () => {
    it('should throw error for invalid user', async () => {
      await expect(
        authzManager.authorize(null as any, '/ai', 'execute')
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw error for invalid resource', async () => {
      const devUser = createTestUser([Role.DEVELOPER]);

      await expect(
        authzManager.authorize(devUser, '', 'execute')
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
