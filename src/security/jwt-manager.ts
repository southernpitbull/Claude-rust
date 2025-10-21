/**
 * JWT Token Manager
 * AIrchitect Security System
 *
 * Manages JWT token signing, verification, and key rotation using RS256 (asymmetric).
 * SECURITY: Uses RS256 algorithm to prevent token forgery attacks.
 */

import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { TokenPayload, JWTSignOptions, JWTVerifyOptions, KeyPair, TokenError, User } from './types';

/**
 * JWT Token Manager - Handles token lifecycle with RS256
 */
export class JWTManager {
  private currentKeyPair: KeyPair | null = null;
  private keyPairs: Map<string, KeyPair> = new Map();
  private revokedTokens: Set<string> = new Set();
  private readonly defaultIssuer: string;
  private readonly defaultAudience: string;

  constructor(issuer: string = 'airchitect-cli', audience: string = 'airchitect-users') {
    this.defaultIssuer = issuer;
    this.defaultAudience = audience;
    this.initializeKeyPair();
  }

  /**
   * Initialize RSA key pair for token signing
   * SECURITY: Uses RSA 2048-bit keys for asymmetric signing
   */
  private initializeKeyPair(): void {
    const keyId = crypto.randomUUID();
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    this.currentKeyPair = {
      privateKey,
      publicKey,
      keyId,
      createdAt: new Date(),
    };

    this.keyPairs.set(keyId, this.currentKeyPair);
  }

  /**
   * Sign a JWT token with RS256
   * SECURITY: Only signs with current private key, includes jti for revocation
   */
  sign(payload: Partial<TokenPayload>, expiresIn: string = '1h'): string {
    if (!this.currentKeyPair) {
      throw new TokenError('No signing key available', 'KEY_UNAVAILABLE');
    }

    // Validate payload
    if (!payload.sub || !payload.username) {
      throw new TokenError('Invalid payload: sub and username required', 'INVALID_PAYLOAD');
    }

    // Generate unique token ID for revocation support
    const jti = crypto.randomUUID();

    const fullPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: payload.sub,
      username: payload.username,
      email: payload.email || '',
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      jti,
      type: payload.type || 'access',
    };

    const options: jwt.SignOptions = {
      algorithm: 'RS256',
      expiresIn,
      issuer: this.defaultIssuer,
      audience: this.defaultAudience,
      jwtid: jti,
    };

    try {
      const token = jwt.sign(fullPayload, this.currentKeyPair.privateKey, options);
      return token;
    } catch (error) {
      throw new TokenError(
        `Token signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIGN_FAILED'
      );
    }
  }

  /**
   * Verify and decode a JWT token
   * SECURITY: Verifies signature, expiration, issuer, audience
   */
  verify(token: string): TokenPayload {
    if (!token || typeof token !== 'string') {
      throw new TokenError('Invalid token format', 'INVALID_FORMAT');
    }

    // Check if token is revoked
    const decoded = this.decode(token);
    if (decoded?.jti && this.revokedTokens.has(decoded.jti)) {
      throw new TokenError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // Try to verify with all known public keys (supports key rotation)
    for (const keyPair of this.keyPairs.values()) {
      try {
        const options: jwt.VerifyOptions = {
          algorithms: ['RS256'],
          issuer: this.defaultIssuer,
          audience: this.defaultAudience,
          clockTolerance: 30, // Allow 30 seconds clock skew
        };

        const verified = jwt.verify(token, keyPair.publicKey, options) as TokenPayload;
        return verified;
      } catch (error) {
        // Try next key if this one fails
        continue;
      }
    }

    // If no key worked, throw error
    throw new TokenError('Token verification failed', 'VERIFICATION_FAILED');
  }

  /**
   * Decode token without verification (for inspecting revoked tokens)
   * SECURITY: Only for non-sensitive operations, always verify first
   */
  decode(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token, { complete: false }) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh an access token using a refresh token
   * SECURITY: Validates refresh token, issues new access token
   */
  refresh(refreshToken: string): string {
    // Verify the refresh token
    const payload = this.verify(refreshToken);

    // Ensure it's actually a refresh token
    if (payload.type !== 'refresh') {
      throw new TokenError('Invalid token type for refresh', 'INVALID_TOKEN_TYPE');
    }

    // Issue new access token with same claims
    const newAccessToken = this.sign(
      {
        sub: payload.sub,
        username: payload.username,
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
        type: 'access',
      },
      '1h'
    );

    return newAccessToken;
  }

  /**
   * Revoke a token by its JTI
   * SECURITY: Prevents reuse of compromised tokens
   */
  revoke(token: string): void {
    const decoded = this.decode(token);
    if (!decoded || !decoded.jti) {
      throw new TokenError('Cannot revoke token without JTI', 'MISSING_JTI');
    }

    this.revokedTokens.add(decoded.jti);
  }

  /**
   * Check if a token is revoked
   */
  isRevoked(token: string): boolean {
    const decoded = this.decode(token);
    if (!decoded || !decoded.jti) {
      return false;
    }
    return this.revokedTokens.has(decoded.jti);
  }

  /**
   * Rotate signing keys
   * SECURITY: Implements key rotation for enhanced security
   */
  rotateKeys(): void {
    const oldKeyPair = this.currentKeyPair;
    this.initializeKeyPair();

    // Keep old key for verification of existing tokens
    if (oldKeyPair) {
      // Set expiration for old key (30 days)
      oldKeyPair.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Clean up expired keys
    this.cleanupExpiredKeys();
  }

  /**
   * Remove expired keys from storage
   */
  private cleanupExpiredKeys(): void {
    const now = new Date();
    for (const [keyId, keyPair] of this.keyPairs.entries()) {
      if (keyPair.expiresAt && keyPair.expiresAt < now) {
        this.keyPairs.delete(keyId);
      }
    }
  }

  /**
   * Get current public key for external verification
   */
  getPublicKey(): string {
    if (!this.currentKeyPair) {
      throw new TokenError('No signing key available', 'KEY_UNAVAILABLE');
    }
    return this.currentKeyPair.publicKey;
  }

  /**
   * Get all public keys (for key rotation support)
   */
  getAllPublicKeys(): Map<string, string> {
    const publicKeys = new Map<string, string>();
    for (const [keyId, keyPair] of this.keyPairs.entries()) {
      publicKeys.set(keyId, keyPair.publicKey);
    }
    return publicKeys;
  }

  /**
   * Extract user information from token
   */
  extractUser(token: string): Partial<User> {
    const payload = this.verify(token);
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }

  /**
   * Clean up revoked tokens older than specified days
   */
  cleanupRevokedTokens(olderThanDays: number = 30): void {
    // In production, this would query a database
    // For now, we'll implement a simple in-memory cleanup
    // This is a placeholder for production implementation
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    // NOTE: In production, store revoked tokens with timestamp
    // and remove those older than cutoff
    // Current implementation keeps all revoked tokens in memory
  }
}

/**
 * Singleton instance for global use
 */
let jwtManagerInstance: JWTManager | null = null;

/**
 * Get or create JWT manager instance
 */
export function getJWTManager(issuer?: string, audience?: string): JWTManager {
  if (!jwtManagerInstance) {
    jwtManagerInstance = new JWTManager(issuer, audience);
  }
  return jwtManagerInstance;
}

/**
 * Reset JWT manager instance (for testing)
 */
export function resetJWTManager(): void {
  jwtManagerInstance = null;
}
