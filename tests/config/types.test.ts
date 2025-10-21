/**
 * Tests for configuration types and type guards
 */

import {
  isFileFormat,
  isLogLevel,
  isLogFormat,
  isLogOutput,
  ENV_PREFIX,
  CONFIG_EXTENSIONS,
} from '../../src/config/types';

describe('Configuration Types', () => {
  describe('isFileFormat', () => {
    it('should return true for valid file formats', () => {
      expect(isFileFormat('toml')).toBe(true);
      expect(isFileFormat('yaml')).toBe(true);
      expect(isFileFormat('yml')).toBe(true);
      expect(isFileFormat('json')).toBe(true);
    });

    it('should return false for invalid file formats', () => {
      expect(isFileFormat('xml')).toBe(false);
      expect(isFileFormat('txt')).toBe(false);
      expect(isFileFormat('ini')).toBe(false);
      expect(isFileFormat('')).toBe(false);
    });
  });

  describe('isLogLevel', () => {
    it('should return true for valid log levels', () => {
      expect(isLogLevel('trace')).toBe(true);
      expect(isLogLevel('debug')).toBe(true);
      expect(isLogLevel('info')).toBe(true);
      expect(isLogLevel('warn')).toBe(true);
      expect(isLogLevel('error')).toBe(true);
    });

    it('should return false for invalid log levels', () => {
      expect(isLogLevel('fatal')).toBe(false);
      expect(isLogLevel('verbose')).toBe(false);
      expect(isLogLevel('')).toBe(false);
    });
  });

  describe('isLogFormat', () => {
    it('should return true for valid log formats', () => {
      expect(isLogFormat('json')).toBe(true);
      expect(isLogFormat('simple')).toBe(true);
      expect(isLogFormat('detailed')).toBe(true);
    });

    it('should return false for invalid log formats', () => {
      expect(isLogFormat('xml')).toBe(false);
      expect(isLogFormat('text')).toBe(false);
      expect(isLogFormat('')).toBe(false);
    });
  });

  describe('isLogOutput', () => {
    it('should return true for valid log outputs', () => {
      expect(isLogOutput('stdout')).toBe(true);
      expect(isLogOutput('stderr')).toBe(true);
      expect(isLogOutput('file')).toBe(true);
    });

    it('should return false for invalid log outputs', () => {
      expect(isLogOutput('console')).toBe(false);
      expect(isLogOutput('syslog')).toBe(false);
      expect(isLogOutput('')).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct environment prefix', () => {
      expect(ENV_PREFIX).toBe('AIRCHITECT_');
    });

    it('should have all supported extensions', () => {
      expect(CONFIG_EXTENSIONS).toContain('toml');
      expect(CONFIG_EXTENSIONS).toContain('yaml');
      expect(CONFIG_EXTENSIONS).toContain('yml');
      expect(CONFIG_EXTENSIONS).toContain('json');
      expect(CONFIG_EXTENSIONS).toHaveLength(4);
    });
  });
});
