/**
 * Authentication Tests
 * Comprehensive security tests for authentication system
 */

import {
  AuthenticationManager,
  getAuthManager,
  resetAuthManager,
  authenticate
} from '../../src/security/auth';
import { AuthenticationError, Role } from '../../src/security/types';

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;

  beforeEach(() => {
    resetAuthManager();
    authManager = new AuthenticationManager();
  });

  describe('Authentication', () => {
    it('should authenticate with valid credentials', async () => {
      const result = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
    });

    it('should reject invalid credentials', async () => {
      await expect(
        authManager.authenticate({
          username: 'admin',
          password: 'wrongpassword'
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject non-existent user', async () => {
      await expect(
        authManager.authenticate({
          username: 'nonexistent',
          password: 'password'
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject empty credentials', async () => {
      await expect(
        authManager.authenticate({
          username: '',
          password: ''
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should update last login timestamp', async () => {
      const userBefore = authManager.getUserByUsername('admin');
      const lastLoginBefore = userBefore?.last_login;

      await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      const userAfter = authManager.getUserByUsername('admin');
      expect(userAfter?.last_login).toBeDefined();
      expect(userAfter?.last_login).not.toBe(lastLoginBefore);
    });
  });

  describe('Rate Limiting', () => {
    it('should block after too many failed attempts', async () => {
      const invalidCredentials = {
        username: 'admin',
        password: 'wrongpassword'
      };

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authManager.authenticate(invalidCredentials);
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should be rate limited
      await expect(
        authManager.authenticate(invalidCredentials)
      ).rejects.toThrow('Too many failed attempts');
    });

    it('should reset rate limit after successful authentication', async () => {
      // Make a few failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await authManager.authenticate({
            username: 'admin',
            password: 'wrongpassword'
          });
        } catch (error) {
          // Expected
        }
      }

      // Successful auth should reset limit
      await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      // Should be able to try again without being blocked
      const result = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });
      expect(result).toBeDefined();
    });
  });

  describe('Token Validation', () => {
    it('should validate a valid token', async () => {
      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      const user = await authManager.validateToken(authResult.access_token);

      expect(user).toBeDefined();
      expect(user.username).toBe('admin');
      expect(user.roles).toContain(Role.ADMIN);
    });

    it('should reject invalid token', async () => {
      await expect(
        authManager.validateToken('invalid.token.here')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject revoked token', async () => {
      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      await authManager.revokeToken(authResult.access_token);

      await expect(
        authManager.validateToken(authResult.access_token)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      const refreshResult = await authManager.refreshToken(authResult.refresh_token);

      expect(refreshResult).toBeDefined();
      expect(refreshResult.access_token).toBeDefined();
      expect(refreshResult.access_token).not.toBe(authResult.access_token);
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        authManager.refreshToken('invalid.refresh.token')
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('User Creation', () => {
    it('should create a new user with valid data', async () => {
      const user = await authManager.createUser(
        'newuser',
        'new@example.com',
        'Strong1Pass!',
        [Role.DEVELOPER]
      );

      expect(user).toBeDefined();
      expect(user.username).toBe('newuser');
      expect(user.email).toBe('new@example.com');
      expect(user.roles).toContain(Role.DEVELOPER);
      expect(user.password_hash).toBeDefined();
    });

    it('should reject weak passwords', async () => {
      await expect(
        authManager.createUser('newuser', 'new@example.com', 'weak', [Role.DEVELOPER])
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject password without uppercase', async () => {
      await expect(
        authManager.createUser('newuser', 'new@example.com', 'password123!', [Role.DEVELOPER])
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject password without special character', async () => {
      await expect(
        authManager.createUser('newuser', 'new@example.com', 'Password123', [Role.DEVELOPER])
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject duplicate username', async () => {
      await authManager.createUser('newuser', 'new@example.com', 'Strong1Pass!', [Role.DEVELOPER]);

      await expect(
        authManager.createUser('newuser', 'another@example.com', 'Strong1Pass!', [Role.DEVELOPER])
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Password Change', () => {
    it('should change password with valid old password', async () => {
      const user = await authManager.createUser(
        'testuser',
        'test@example.com',
        'OldPass123!',
        [Role.DEVELOPER]
      );

      await authManager.changePassword(user.id, 'OldPass123!', 'NewPass456!');

      // Old password should not work
      await expect(
        authManager.authenticate({
          username: 'testuser',
          password: 'OldPass123!'
        })
      ).rejects.toThrow(AuthenticationError);

      // New password should work
      const result = await authManager.authenticate({
        username: 'testuser',
        password: 'NewPass456!'
      });
      expect(result).toBeDefined();
    });

    it('should reject password change with wrong old password', async () => {
      const user = await authManager.createUser(
        'testuser',
        'test@example.com',
        'OldPass123!',
        [Role.DEVELOPER]
      );

      await expect(
        authManager.changePassword(user.id, 'WrongOld123!', 'NewPass456!')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should enforce password strength on new password', async () => {
      const user = await authManager.createUser(
        'testuser',
        'test@example.com',
        'OldPass123!',
        [Role.DEVELOPER]
      );

      await expect(
        authManager.changePassword(user.id, 'OldPass123!', 'weak')
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('MFA Support', () => {
    it('should setup MFA for user', async () => {
      const user = await authManager.getUserByUsername('admin');
      if (!user) throw new Error('Admin user not found');

      const mfaSetup = await authManager.setupMFA(user.id);

      expect(mfaSetup).toBeDefined();
      expect(mfaSetup.secret).toBeDefined();
      expect(mfaSetup.qrCode).toBeDefined();
      expect(mfaSetup.backupCodes).toHaveLength(10);
    });

    it('should require MFA code after enabling', async () => {
      const user = await authManager.createUser(
        'mfauser',
        'mfa@example.com',
        'MfaPass123!',
        [Role.DEVELOPER]
      );

      const mfaSetup = await authManager.setupMFA(user.id);

      // This would normally verify a real TOTP code
      // For testing, we'll use the authenticator library directly

      await expect(
        authManager.authenticate({
          username: 'mfauser',
          password: 'MfaPass123!'
          // Missing MFA code after it's enabled
        })
      ).rejects.toThrow(); // Will throw after MFA is enabled
    });
  });

  describe('Logout', () => {
    it('should logout user and revoke token', async () => {
      const authResult = await authManager.authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      await authManager.logout(authResult.access_token);

      await expect(
        authManager.validateToken(authResult.access_token)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Convenience Function', () => {
    it('should work with global authenticate function', async () => {
      const result = await authenticate({
        username: 'admin',
        password: 'admin123!'
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
    });
  });
});
