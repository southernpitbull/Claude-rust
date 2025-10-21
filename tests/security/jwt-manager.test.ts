/**
 * JWT Manager Tests
 * Comprehensive security tests for JWT token management
 */

import { JWTManager, resetJWTManager } from '../../src/security/jwt-manager';
import { TokenError, Role } from '../../src/security/types';

describe('JWTManager', () => {
  let jwtManager: JWTManager;

  beforeEach(() => {
    resetJWTManager();
    jwtManager = new JWTManager('test-issuer', 'test-audience');
  });

  describe('Token Signing', () => {
    it('should sign a valid token with RS256', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: ['test:read'],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload, '1h');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should throw error if missing required payload fields', () => {
      const invalidPayload = {
        email: 'test@example.com'
      } as any;

      expect(() => jwtManager.sign(invalidPayload, '1h')).toThrow(TokenError);
    });

    it('should include jti for token revocation', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      const decoded = jwtManager.decode(token);

      expect(decoded).toBeDefined();
      expect(decoded?.jti).toBeDefined();
    });
  });

  describe('Token Verification', () => {
    it('should verify a valid token', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: ['test:read'],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      const verified = jwtManager.verify(token);

      expect(verified.sub).toBe('user-123');
      expect(verified.username).toBe('testuser');
      expect(verified.roles).toContain(Role.DEVELOPER);
    });

    it('should throw error for invalid token format', () => {
      expect(() => jwtManager.verify('invalid-token')).toThrow(TokenError);
    });

    it('should throw error for empty token', () => {
      expect(() => jwtManager.verify('')).toThrow(TokenError);
    });

    it('should verify token from correct issuer and audience', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      const verified = jwtManager.verify(token);

      expect(verified).toBeDefined();
    });
  });

  describe('Token Revocation', () => {
    it('should revoke a token', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      jwtManager.revoke(token);

      expect(jwtManager.isRevoked(token)).toBe(true);
    });

    it('should throw error when verifying revoked token', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      jwtManager.revoke(token);

      expect(() => jwtManager.verify(token)).toThrow(TokenError);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh an access token from refresh token', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'refresh' as const
      };

      const refreshToken = jwtManager.sign(payload, '7d');
      const newAccessToken = jwtManager.refresh(refreshToken);

      expect(newAccessToken).toBeDefined();
      expect(typeof newAccessToken).toBe('string');

      const verified = jwtManager.verify(newAccessToken);
      expect(verified.type).toBe('access');
    });

    it('should throw error when refreshing with access token', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'access' as const
      };

      const accessToken = jwtManager.sign(payload);
      expect(() => jwtManager.refresh(accessToken)).toThrow(TokenError);
    });
  });

  describe('Key Rotation', () => {
    it('should rotate signing keys', () => {
      const oldPublicKey = jwtManager.getPublicKey();

      jwtManager.rotateKeys();

      const newPublicKey = jwtManager.getPublicKey();
      expect(newPublicKey).not.toBe(oldPublicKey);
    });

    it('should still verify tokens signed with old keys after rotation', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: [],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      jwtManager.rotateKeys();

      // Should still verify with old key
      const verified = jwtManager.verify(token);
      expect(verified.sub).toBe('user-123');
    });
  });

  describe('User Extraction', () => {
    it('should extract user info from token', () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.DEVELOPER],
        permissions: ['test:read'],
        type: 'access' as const
      };

      const token = jwtManager.sign(payload);
      const user = jwtManager.extractUser(token);

      expect(user.id).toBe('user-123');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.roles).toContain(Role.DEVELOPER);
    });
  });
});
