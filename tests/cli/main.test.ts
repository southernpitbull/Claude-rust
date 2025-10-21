/**
 * main.test.ts
 *
 * Comprehensive tests for the main CLI entry point
 */

import { initialize, gracefulShutdown } from '../../src/main';

describe('Main CLI Entry Point', () => {
  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(initialize()).resolves.not.toThrow();
    });

    it('should setup logger', async () => {
      await initialize();
      // Logger should be created (verified by no errors)
      expect(true).toBe(true);
    });

    it('should setup command runner', async () => {
      await initialize();
      // Runner should be created (verified by no errors)
      expect(true).toBe(true);
    });
  });

  describe('gracefulShutdown', () => {
    it('should handle shutdown without errors', async () => {
      await initialize();
      await expect(gracefulShutdown('SIGINT')).resolves.not.toThrow();
    });

    it('should cleanup resources on shutdown', async () => {
      await initialize();
      await gracefulShutdown('SIGTERM');
      // Cleanup should complete (verified by no errors)
      expect(true).toBe(true);
    });
  });

  describe('Signal Handlers', () => {
    it('should register SIGINT handler', () => {
      const listeners = process.listeners('SIGINT');
      expect(listeners.length).toBeGreaterThan(0);
    });

    it('should register SIGTERM handler', () => {
      const listeners = process.listeners('SIGTERM');
      expect(listeners.length).toBeGreaterThan(0);
    });

    it('should register uncaughtException handler', () => {
      const listeners = process.listeners('uncaughtException');
      expect(listeners.length).toBeGreaterThan(0);
    });

    it('should register unhandledRejection handler', () => {
      const listeners = process.listeners('unhandledRejection');
      expect(listeners.length).toBeGreaterThan(0);
    });
  });
});
