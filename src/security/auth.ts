/**
 * Authentication System
 * AIrchitect Security System
 *
 * Implements secure authentication with JWT tokens, password hashing, and MFA.
 * SECURITY: Replaces broken stub that always returned true.
 */

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import {
  Credentials,
  User,
  AuthToken,
  AuthenticationError,
  Role,
  MFASetup,
  RateLimitConfig,
} from './types';
import { getJWTManager } from './jwt-manager';
import { getAuditLogger } from './audit-logger';
import { getRBACManager } from './rbac';

/**
 * User storage interface (in production, use database)
 */
interface UserStore {
  [username: string]: User;
}

/**
 * Rate limiting tracker
 */
interface RateLimitTracker {
  attempts: number;
  lastAttempt: Date;
  blockedUntil?: Date;
}

/**
 * Authentication Manager
 */
export class AuthenticationManager {
  private users: UserStore = {};
  private rateLimitTrackers: Map<string, RateLimitTracker> = new Map();
  private jwtManager = getJWTManager();
  private rbacManager = getRBACManager();
  private auditLogger = getAuditLogger();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private readonly SALT_ROUNDS = 12;
  private readonly rateLimitConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  };

  constructor() {
    // Initialize with a default admin user (in production, use database)
    this.initializationPromise = this.initializeDefaultUsers();
  }

  /**
   * Ensure initialization is complete
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && this.initializationPromise) {
      await this.initializationPromise;
      this.isInitialized = true;
    }
  }

  /**
   * Initialize default users for testing
   * SECURITY: In production, load from secure database
   */
  private async initializeDefaultUsers(): Promise<void> {
    // Create default admin user
    const adminPasswordHash = await bcrypt.hash('admin123!', this.SALT_ROUNDS);
    this.users['admin'] = {
      id: crypto.randomUUID(),
      username: 'admin',
      email: 'admin@airchitect.local',
      roles: [Role.ADMIN],
      permissions: [],
      created_at: new Date(),
      mfa_enabled: false,
      password_hash: adminPasswordHash,
    };

    // Create default developer user
    const devPasswordHash = await bcrypt.hash('dev123!', this.SALT_ROUNDS);
    this.users['developer'] = {
      id: crypto.randomUUID(),
      username: 'developer',
      email: 'dev@airchitect.local',
      roles: [Role.DEVELOPER],
      permissions: [],
      created_at: new Date(),
      mfa_enabled: false,
      password_hash: devPasswordHash,
    };

    this.isInitialized = true;
  }

  /**
   * Check rate limiting for authentication attempts
   * SECURITY: Prevents brute force attacks
   */
  private checkRateLimit(identifier: string): void {
    const tracker = this.rateLimitTrackers.get(identifier);
    const now = new Date();

    if (!tracker) {
      this.rateLimitTrackers.set(identifier, {
        attempts: 1,
        lastAttempt: now,
      });
      return;
    }

    // Check if currently blocked
    if (tracker.blockedUntil && tracker.blockedUntil > now) {
      const remainingMs = tracker.blockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new AuthenticationError(
        `Too many failed attempts. Try again in ${remainingMinutes} minutes.`,
        'RATE_LIMITED'
      );
    }

    // Reset if outside window
    const windowExpired =
      now.getTime() - tracker.lastAttempt.getTime() > this.rateLimitConfig.windowMs;
    if (windowExpired) {
      tracker.attempts = 1;
      tracker.lastAttempt = now;
      delete tracker.blockedUntil;
      return;
    }

    // Increment attempts
    tracker.attempts++;
    tracker.lastAttempt = now;

    // Block if exceeded max attempts
    if (tracker.attempts > this.rateLimitConfig.maxAttempts) {
      tracker.blockedUntil = new Date(now.getTime() + this.rateLimitConfig.blockDurationMs);
      throw new AuthenticationError(
        `Too many failed attempts. Account locked for ${this.rateLimitConfig.blockDurationMs / 60000} minutes.`,
        'RATE_LIMITED'
      );
    }
  }

  /**
   * Reset rate limit on successful authentication
   */
  private resetRateLimit(identifier: string): void {
    this.rateLimitTrackers.delete(identifier);
  }

  /**
   * Validate password strength
   * SECURITY: Enforces strong password requirements
   */
  private validatePasswordStrength(password: string): void {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new AuthenticationError(
        `Password must be at least ${minLength} characters long`,
        'WEAK_PASSWORD'
      );
    }

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      throw new AuthenticationError(
        'Password must contain uppercase, lowercase, number, and special character',
        'WEAK_PASSWORD'
      );
    }
  }

  /**
   * Authenticate user with credentials
   * SECURITY: Replaces stub that always returned true
   */
  async authenticate(credentials: Credentials, ipAddress?: string): Promise<AuthToken> {
    // Ensure initialization is complete
    await this.ensureInitialized();

    // Validate input
    if (!credentials.username || !credentials.password) {
      throw new AuthenticationError('Username and password required', 'INVALID_CREDENTIALS');
    }

    // Check rate limiting
    try {
      this.checkRateLimit(credentials.username);
    } catch (error) {
      this.auditLogger.logAuthAttempt(
        credentials.username,
        false,
        undefined,
        (error as AuthenticationError).message,
        { ip_address: ipAddress }
      );
      throw error;
    }

    // Find user
    const user = this.users[credentials.username];
    if (!user || !user.password_hash) {
      // Don't reveal whether user exists
      this.auditLogger.logAuthAttempt(
        credentials.username,
        false,
        undefined,
        'Invalid credentials',
        { ip_address: ipAddress }
      );
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(credentials.password, user.password_hash);
    if (!passwordValid) {
      this.auditLogger.logAuthAttempt(credentials.username, false, user.id, 'Invalid password', {
        ip_address: ipAddress,
      });
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Check MFA if enabled
    if (user.mfa_enabled) {
      if (!credentials.mfa_code) {
        throw new AuthenticationError('MFA code required', 'MFA_REQUIRED');
      }

      const mfaValid = await this.validateMFA(user.id, credentials.mfa_code);
      if (!mfaValid) {
        this.auditLogger.logMFAEvent(
          'mfa_failed' as any,
          user.id,
          user.username,
          false,
          'Invalid MFA code'
        );
        throw new AuthenticationError('Invalid MFA code', 'INVALID_MFA');
      }

      this.auditLogger.logMFAEvent('mfa_verified' as any, user.id, user.username, true);
    }

    // Reset rate limit on successful auth
    this.resetRateLimit(credentials.username);

    // Update last login
    user.last_login = new Date();

    // Generate tokens
    const accessToken = this.jwtManager.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: this.rbacManager.getUserPermissions(user),
        type: 'access',
      },
      '1h'
    );

    const refreshToken = this.jwtManager.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: [],
        type: 'refresh',
      },
      '7d'
    );

    // Log successful authentication
    this.auditLogger.logAuthAttempt(user.username, true, user.id, undefined, {
      ip_address: ipAddress,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  /**
   * Validate JWT token and extract user
   * SECURITY: Verifies token signature and expiration
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtManager.verify(token);

      // Find user
      const user = Object.values(this.users).find((u) => u.id === payload.sub);
      if (!user) {
        throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
      }

      return user;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid or expired token', 'INVALID_TOKEN');
    }
  }

  /**
   * Refresh access token using refresh token
   * SECURITY: Validates refresh token before issuing new access token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const newAccessToken = this.jwtManager.refresh(refreshToken);
      const payload = this.jwtManager.verify(newAccessToken);

      this.auditLogger.logTokenRefresh(payload.sub, payload.username, true);

      return {
        access_token: newAccessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      };
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Revoke a token
   * SECURITY: Prevents further use of compromised tokens
   */
  async revokeToken(token: string, userId?: string, username?: string): Promise<void> {
    this.jwtManager.revoke(token);

    if (userId && username) {
      this.auditLogger.logTokenRevoked(userId, username);
    }
  }

  /**
   * Setup MFA for a user
   * SECURITY: Enables two-factor authentication
   */
  async setupMFA(userId: string): Promise<MFASetup> {
    const user = Object.values(this.users).find((u) => u.id === userId);
    if (!user) {
      throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    user.mfa_secret = secret;

    // Generate QR code URL
    const qrCode = authenticator.keyuri(user.username, 'AIrchitect', secret);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(userId: string, verificationCode: string): Promise<void> {
    const user = Object.values(this.users).find((u) => u.id === userId);
    if (!user || !user.mfa_secret) {
      throw new AuthenticationError('MFA not set up', 'MFA_NOT_SETUP');
    }

    // Verify the code before enabling
    const isValid = authenticator.verify({
      token: verificationCode,
      secret: user.mfa_secret,
    });

    if (!isValid) {
      throw new AuthenticationError('Invalid verification code', 'INVALID_MFA');
    }

    user.mfa_enabled = true;
    this.auditLogger.logMFAEvent('mfa_enabled' as any, user.id, user.username, true);
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    const user = Object.values(this.users).find((u) => u.id === userId);
    if (!user) {
      throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
    }

    user.mfa_enabled = false;
    delete user.mfa_secret;

    this.auditLogger.logMFAEvent('mfa_disabled' as any, user.id, user.username, true);
  }

  /**
   * Validate MFA code
   * SECURITY: Verifies TOTP code with time window
   */
  async validateMFA(userId: string, code: string): Promise<boolean> {
    const user = Object.values(this.users).find((u) => u.id === userId);
    if (!user || !user.mfa_secret) {
      return false;
    }

    try {
      const isValid = authenticator.verify({
        token: code,
        secret: user.mfa_secret,
      });
      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new user
   * SECURITY: Hashes password, validates strength
   */
  async createUser(
    username: string,
    email: string,
    password: string,
    roles: Role[] = [Role.READONLY]
  ): Promise<User> {
    // Ensure initialization is complete
    await this.ensureInitialized();

    // Validate inputs
    if (!username || !email || !password) {
      throw new AuthenticationError('Username, email, and password required', 'INVALID_INPUT');
    }

    // Check if user exists
    if (this.users[username]) {
      throw new AuthenticationError('Username already exists', 'USER_EXISTS');
    }

    // Validate password strength
    this.validatePasswordStrength(password);

    // Hash password
    const password_hash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      username,
      email,
      roles,
      permissions: [],
      created_at: new Date(),
      mfa_enabled: false,
      password_hash,
    };

    this.users[username] = user;

    return user;
  }

  /**
   * Change user password
   * SECURITY: Validates old password, enforces strength requirements
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = Object.values(this.users).find((u) => u.id === userId);
    if (!user || !user.password_hash) {
      throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
    }

    // Verify old password
    const oldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!oldPasswordValid) {
      throw new AuthenticationError('Invalid old password', 'INVALID_PASSWORD');
    }

    // Validate new password strength
    this.validatePasswordStrength(newPassword);

    // Hash and update password
    user.password_hash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    this.auditLogger.logPasswordChanged(user.id, user.username);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | undefined> {
    await this.ensureInitialized();
    return Object.values(this.users).find((u) => u.id === userId);
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ensureInitialized();
    return this.users[username];
  }

  /**
   * Logout user
   */
  async logout(token: string): Promise<void> {
    try {
      const user = await this.validateToken(token);
      await this.revokeToken(token, user.id, user.username);
      this.auditLogger.logLogout(user.id, user.username);
    } catch (error) {
      // Token already invalid, no action needed
    }
  }
}

/**
 * Singleton instance for global use
 */
let authManagerInstance: AuthenticationManager | null = null;

/**
 * Get or create authentication manager instance
 */
export function getAuthManager(): AuthenticationManager {
  if (!authManagerInstance) {
    authManagerInstance = new AuthenticationManager();
  }
  return authManagerInstance;
}

/**
 * Reset authentication manager instance (for testing)
 */
export function resetAuthManager(): void {
  authManagerInstance = null;
}

/**
 * Convenience function for authentication
 * SECURITY: This replaces the broken stub that always returned true
 */
export async function authenticate(credentials: Credentials): Promise<AuthToken> {
  const authManager = getAuthManager();
  return authManager.authenticate(credentials);
}
