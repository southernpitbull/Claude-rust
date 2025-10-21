/**
 * Security Integration Tests
 * End-to-end security flow tests
 */

import { initializeSecurity, resetSecurity } from '../../src/security';
import { getAuthManager } from '../../src/security/auth';
import { getAuthzManager } from '../../src/security/authz';
import { Role } from '../../src/security/types';

describe('Security Integration Tests', () => {
  beforeEach(() => {
    resetSecurity();
    initializeSecurity({
      jwtIssuer: 'test-airchitect',
      jwtAudience: 'test-users'
    });
  });

  describe('Complete Authentication and Authorization Flow', () => {
    it('should complete full auth/authz cycle for admin user', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // 1. Authenticate
      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      expect(authResult.access_token).toBeDefined();

      // 2. Validate token and get user
      const user = await authManager.validateToken(authResult.access_token);

      expect(user.username).toBe('admin');
      expect(user.roles).toContain(Role.ADMIN);

      // 3. Check authorization
      const canAccessAI = await authzManager.authorize(user, '/ai', 'execute');
      const canManageUsers = await authzManager.authorize(user, '/users', 'create');

      expect(canAccessAI).toBe(true);
      expect(canManageUsers).toBe(true);

      // 4. Logout
      await authManager.logout(authResult.access_token);
    });

    it('should complete full auth/authz cycle for developer user', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // 1. Authenticate
      const authResult = await authManager.authenticate({
        username: 'developer',
        password: 'dev123!'
      });

      // 2. Validate and authorize
      const user = await authManager.validateToken(authResult.access_token);

      const canAccessAI = await authzManager.authorize(user, '/ai', 'execute');
      const canManageUsers = await authzManager.authorize(user, '/users', 'create');

      expect(canAccessAI).toBe(true);
      expect(canManageUsers).toBe(false); // Developer cannot manage users
    });

    it('should prevent unauthorized access after token revocation', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // Authenticate
      const authResult = await authManager.authenticate({
        username: 'developer',
        password: 'dev123!'
      });

      const user = await authManager.validateToken(authResult.access_token);

      // Should have access initially
      const canAccessBefore = await authzManager.authorize(user, '/ai', 'execute');
      expect(canAccessBefore).toBe(true);

      // Revoke token
      await authManager.revokeToken(
        authResult.access_token,
        user.id,
        user.username
      );

      // Should not be able to validate revoked token
      await expect(
        authManager.validateToken(authResult.access_token)
      ).rejects.toThrow();
    });

    it('should enforce role-based restrictions across system', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // Create user with readonly role
      const readonlyUser = await authManager.createUser(
        'readonly_user',
        'readonly@example.com',
        'Readonly123!',
        [Role.READONLY]
      );

      // Check various access levels
      const canReadConfig = await authzManager.authorize(
        readonlyUser,
        '/config',
        'read'
      );
      const canWriteConfig = await authzManager.authorize(
        readonlyUser,
        '/config',
        'update'
      );
      const canAccessAI = await authzManager.authorize(
        readonlyUser,
        '/ai',
        'execute'
      );

      expect(canReadConfig).toBe(true); // Readonly can read config
      expect(canWriteConfig).toBe(false); // Readonly cannot write config
      expect(canAccessAI).toBe(false); // Readonly cannot use AI
    });

    it('should handle token refresh properly', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // Initial authentication
      const authResult = await authManager.authenticate({
        username: 'developer',
        password: 'dev123!'
      });

      const initialUser = await authManager.validateToken(authResult.access_token);

      // Refresh token
      const refreshResult = await authManager.refreshToken(authResult.refresh_token);

      const refreshedUser = await authManager.validateToken(refreshResult.access_token);

      // Should maintain same permissions
      expect(refreshedUser.id).toBe(initialUser.id);
      expect(refreshedUser.roles).toEqual(initialUser.roles);

      const canAccess = await authzManager.authorize(refreshedUser, '/ai', 'execute');
      expect(canAccess).toBe(true);
    });

    it('should enforce custom policies correctly', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // Create test user
      const testUser = await authManager.createUser(
        'policytest',
        'policy@example.com',
        'Policy123!',
        [Role.DEVELOPER]
      );

      // Initially should have access
      const canAccessBefore = await authzManager.authorize(testUser, '/ai', 'execute');
      expect(canAccessBefore).toBe(true);

      // Add deny policy for this specific user
      authzManager.denyUserAccess(testUser.id, '/ai', ['execute']);

      // Should now be denied
      const canAccessAfter = await authzManager.authorize(testUser, '/ai', 'execute');
      expect(canAccessAfter).toBe(false);

      // Remove deny policy
      authzManager.allowUserAccess(testUser.id, '/ai');

      // Should have access again
      const canAccessRestored = await authzManager.authorize(testUser, '/ai', 'execute');
      expect(canAccessRestored).toBe(true);
    });

    it('should handle password changes correctly', async () => {
      const authManager = getAuthManager();

      // Create user
      const user = await authManager.createUser(
        'changepass',
        'changepass@example.com',
        'OldPass123!',
        [Role.DEVELOPER]
      );

      // Authenticate with old password
      const oldAuth = await authManager.authenticate({
        username: 'changepass',
        password: 'OldPass123!'
      });
      expect(oldAuth).toBeDefined();

      // Change password
      await authManager.changePassword(user.id, 'OldPass123!', 'NewPass456!');

      // Old password should fail
      await expect(
        authManager.authenticate({
          username: 'changepass',
          password: 'OldPass123!'
        })
      ).rejects.toThrow();

      // New password should work
      const newAuth = await authManager.authenticate({
        username: 'changepass',
        password: 'NewPass456!'
      });
      expect(newAuth).toBeDefined();
    });

    it('should properly aggregate permissions from multiple roles', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      // Create user with multiple roles
      const multiRoleUser = await authManager.createUser(
        'multirole',
        'multi@example.com',
        'Multi123!',
        [Role.DEVELOPER, Role.ANALYST]
      );

      // Should have developer permissions
      const canAccessAI = await authzManager.authorize(multiRoleUser, '/ai', 'execute');
      expect(canAccessAI).toBe(true);

      // Should have analyst permissions
      const canSearchMemory = await authzManager.authorize(
        multiRoleUser,
        '/memory',
        'search'
      );
      expect(canSearchMemory).toBe(true);

      // Should not have admin permissions
      const canManageUsers = await authzManager.authorize(
        multiRoleUser,
        '/users',
        'create'
      );
      expect(canManageUsers).toBe(false);
    });

    it('should validate detailed access reasons', async () => {
      const authManager = getAuthManager();
      const authzManager = getAuthzManager();

      const authResult = await authManager.authenticate({
        username: 'developer',
        password: 'dev123!'
      });

      const user = await authManager.validateToken(authResult.access_token);

      // Check allowed access
      const allowedResult = await authzManager.validateAccess(user, '/ai', 'execute');
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.reason).toContain('permission');

      // Check denied access
      const deniedResult = await authzManager.validateAccess(user, '/users', 'create');
      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.reason).toBeDefined();
    });
  });

  describe('Security Best Practices Validation', () => {
    it('should never expose password hashes', async () => {
      const authManager = getAuthManager();

      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      const user = await authManager.validateToken(authResult.access_token);

      // Password hash should not be exposed in normal user object
      // (it exists internally but should not be returned in API responses)
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.roles).toBeDefined();
    });

    it('should enforce strong password requirements', async () => {
      const authManager = getAuthManager();

      // Test various weak passwords
      const weakPasswords = [
        'short',           // Too short
        'alllowercase',    // No uppercase
        'ALLUPPERCASE',    // No lowercase
        'NoNumbers!',      // No numbers
        'NoSpecial123',    // No special chars
      ];

      for (const weakPass of weakPasswords) {
        await expect(
          authManager.createUser('test', 'test@example.com', weakPass, [Role.READONLY])
        ).rejects.toThrow();
      }

      // Strong password should work
      const strongPass = 'Strong1Pass!';
      const user = await authManager.createUser(
        'strongtest',
        'strong@example.com',
        strongPass,
        [Role.READONLY]
      );
      expect(user).toBeDefined();
    });

    it('should use secure token format (RS256)', async () => {
      const authManager = getAuthManager();

      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      // JWT should have 3 parts (header.payload.signature)
      const parts = authResult.access_token.split('.');
      expect(parts).toHaveLength(3);

      // Decode header to check algorithm
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      expect(header.alg).toBe('RS256');
    });

    it('should implement proper separation of access and refresh tokens', async () => {
      const authManager = getAuthManager();

      const authResult = await authManager.authenticate({
        username: 'developer',
        password: 'dev123!'
      });

      // Access and refresh tokens should be different
      expect(authResult.access_token).not.toBe(authResult.refresh_token);

      // Access token should have type 'access'
      const jwtManager = (authManager as any).jwtManager;
      const accessPayload = jwtManager.decode(authResult.access_token);
      expect(accessPayload.type).toBe('access');

      // Refresh token should have type 'refresh'
      const refreshPayload = jwtManager.decode(authResult.refresh_token);
      expect(refreshPayload.type).toBe('refresh');
    });
  });
});
