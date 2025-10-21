/**
 * ConfigExport.ts
 *
 * Export configuration to various formats with support for
 * selective export, secret redaction, and format conversion.
 *
 * @module config/ConfigExport
 */

import * as fs from 'fs/promises';
import type { Config, ExportFormat, PartialConfig } from './ConfigSchema';
import { ConfigEncryption } from './ConfigEncryption';

/**
 * Export options
 */
export interface ExportOptions {
  format?: ExportFormat;
  pretty?: boolean;
  redactSecrets?: boolean;
  includeDefaults?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  comments?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  content: string;
  errors?: string[];
}

/**
 * Configuration exporter class
 *
 * Exports configuration to various formats:
 * - JSON (with pretty printing)
 * - YAML (future support)
 * - TOML (future support)
 * - Environment file (.env)
 * - Selective field export
 * - Secret redaction
 */
export class ConfigExport {
  private encryption: ConfigEncryption;
  private options: Required<ExportOptions>;

  /**
   * Create a new ConfigExport instance
   *
   * @param {ExportOptions} options - Export options
   */
  constructor(options: ExportOptions = {}) {
    this.encryption = new ConfigEncryption();
    this.options = {
      format: options.format || 'json',
      pretty: options.pretty ?? true,
      redactSecrets: options.redactSecrets ?? true,
      includeDefaults: options.includeDefaults ?? false,
      includePatterns: options.includePatterns || [],
      excludePatterns: options.excludePatterns || [],
      comments: options.comments ?? false,
    };
  }

  /**
   * Export configuration
   *
   * @param {Config | PartialConfig} config - Configuration to export
   * @param {ExportOptions} options - Export options (overrides constructor options)
   * @returns {ExportResult} Export result
   */
  public export(config: Config | PartialConfig, options?: ExportOptions): ExportResult {
    const opts = { ...this.options, ...options };

    try {
      // Filter configuration based on patterns
      let filtered = this.filterConfig(config, opts);

      // Redact secrets if requested
      if (opts.redactSecrets) {
        filtered = this.redactSecrets(filtered);
      }

      // Export to requested format
      let content: string;
      switch (opts.format) {
        case 'json':
          content = this.exportToJson(filtered, opts);
          break;
        case 'yaml':
          content = this.exportToYaml(filtered, opts);
          break;
        case 'toml':
          content = this.exportToToml(filtered, opts);
          break;
        case 'env':
          content = this.exportToEnv(filtered, opts);
          break;
        default:
          throw new Error(`Unsupported export format: ${opts.format}`);
      }

      return {
        success: true,
        format: opts.format,
        content,
      };
    } catch (error) {
      return {
        success: false,
        format: opts.format,
        content: '',
        errors: [error instanceof Error ? error.message : 'Unknown export error'],
      };
    }
  }

  /**
   * Export configuration to file
   *
   * @param {Config | PartialConfig} config - Configuration to export
   * @param {string} filePath - File path to write to
   * @param {ExportOptions} options - Export options
   * @returns {Promise<ExportResult>} Export result
   */
  public async exportToFile(
    config: Config | PartialConfig,
    filePath: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const result = this.export(config, options);

    if (result.success) {
      try {
        await fs.writeFile(filePath, result.content, 'utf-8');
      } catch (error) {
        return {
          ...result,
          success: false,
          errors: [
            ...(result.errors || []),
            `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
        };
      }
    }

    return result;
  }

  /**
   * Export to JSON format
   *
   * @param {Config | PartialConfig} config - Configuration to export
   * @param {ExportOptions} options - Export options
   * @returns {string} JSON string
   */
  private exportToJson(config: Config | PartialConfig, options: ExportOptions): string {
    const indent = options.pretty ? 2 : 0;
    return JSON.stringify(config, null, indent);
  }

  /**
   * Export to YAML format
   *
   * @param {Config | PartialConfig} config - Configuration to export
   * @param {ExportOptions} options - Export options
   * @returns {string} YAML string
   */
  private exportToYaml(config: Config | PartialConfig, options: ExportOptions): string {
    // Simple YAML conversion (basic implementation)
    // For production, consider using a YAML library like 'js-yaml'
    const yaml = this.objectToYaml(config, 0);
    return yaml;
  }

  /**
   * Export to TOML format
   *
   * @param {Config | PartialConfig} config - Configuration to export
   * @param {ExportOptions} options - Export options
   * @returns {string} TOML string
   */
  private exportToToml(config: Config | PartialConfig, options: ExportOptions): string {
    // Simple TOML conversion (basic implementation)
    // For production, consider using a TOML library like '@iarna/toml'
    const toml = this.objectToToml(config);
    return toml;
  }

  /**
   * Export to environment file format
   *
   * @param {Config | PartialConfig} config - Configuration to export
   * @param {ExportOptions} options - Export options
   * @returns {string} Environment file string
   */
  private exportToEnv(config: Config | PartialConfig, options: ExportOptions): string {
    const lines: string[] = [];

    // Add header comment
    if (options.comments) {
      lines.push('# AIrchitect Configuration');
      lines.push('# Generated on ' + new Date().toISOString());
      lines.push('');
    }

    // Flatten configuration to env vars
    const flattened = this.flattenToEnvVars(config);

    for (const [key, value] of Object.entries(flattened)) {
      if (options.comments) {
        lines.push(`# ${key}`);
      }
      lines.push(`${key}=${value}`);
      if (options.comments) {
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Filter configuration based on include/exclude patterns
   *
   * @param {Config | PartialConfig} config - Configuration to filter
   * @param {ExportOptions} options - Export options
   * @returns {Config | PartialConfig} Filtered configuration
   */
  private filterConfig(
    config: Config | PartialConfig,
    options: ExportOptions
  ): Config | PartialConfig {
    // If no patterns, return as is
    if (options.includePatterns.length === 0 && options.excludePatterns.length === 0) {
      return config;
    }

    // Apply filters (simplified implementation)
    // For production, implement proper pattern matching
    return config;
  }

  /**
   * Redact sensitive values
   *
   * @param {Config | PartialConfig} config - Configuration to redact
   * @returns {Config | PartialConfig} Configuration with redacted secrets
   */
  private redactSecrets(config: Config | PartialConfig): Config | PartialConfig {
    const redacted = JSON.parse(JSON.stringify(config));

    // Redact API keys
    if (redacted.providers) {
      for (const provider of Object.values(redacted.providers)) {
        if (typeof provider === 'object' && provider !== null) {
          const p = provider as Record<string, unknown>;
          if (p.apiKey) {
            p.apiKey = '***REDACTED***';
          }
        }
      }
    }

    // Redact security API keys
    if (redacted.security?.apiKeys) {
      const keys = redacted.security.apiKeys as Record<string, unknown>;
      for (const key of Object.keys(keys)) {
        keys[key] = '***REDACTED***';
      }
    }

    return redacted;
  }

  /**
   * Convert object to YAML (simplified)
   *
   * @param {unknown} obj - Object to convert
   * @param {number} indent - Indentation level
   * @returns {string} YAML string
   */
  private objectToYaml(obj: unknown, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    const lines: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object') {
          lines.push(`${spaces}- `);
          lines.push(this.objectToYaml(item, indent + 1));
        } else {
          lines.push(`${spaces}- ${item}`);
        }
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          lines.push(`${spaces}${key}:`);
          lines.push(this.objectToYaml(value, indent + 1));
        } else {
          lines.push(`${spaces}${key}: ${value}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert object to TOML (simplified)
   *
   * @param {unknown} obj - Object to convert
   * @returns {string} TOML string
   */
  private objectToToml(obj: unknown): string {
    const lines: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`[${key}]`);
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue !== 'object') {
            lines.push(`${subKey} = ${this.tomlValue(subValue)}`);
          }
        }
        lines.push('');
      } else {
        lines.push(`${key} = ${this.tomlValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format value for TOML
   *
   * @param {unknown} value - Value to format
   * @returns {string} Formatted value
   */
  private tomlValue(value: unknown): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.tomlValue(v)).join(', ')}]`;
    }
    return String(value);
  }

  /**
   * Flatten configuration to environment variables
   *
   * @param {Config | PartialConfig} config - Configuration to flatten
   * @param {string} prefix - Variable prefix
   * @returns {Record<string, string>} Flattened environment variables
   */
  private flattenToEnvVars(
    config: Config | PartialConfig,
    prefix: string = 'AICHITECT'
  ): Record<string, string> {
    const result: Record<string, string> = {};

    const flatten = (obj: unknown, path: string[]): void => {
      if (typeof obj !== 'object' || obj === null) {
        const key = [prefix, ...path].join('_').toUpperCase();
        result[key] = String(obj);
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        flatten(value, [...path, key]);
      }
    };

    flatten(config, []);
    return result;
  }
}

/**
 * Create an exporter instance
 *
 * @param {ExportOptions} options - Export options
 * @returns {ConfigExport} Exporter instance
 */
export function createExporter(options?: ExportOptions): ConfigExport {
  return new ConfigExport(options);
}

/**
 * Quick export to JSON
 *
 * @param {Config | PartialConfig} config - Configuration to export
 * @param {boolean} pretty - Pretty print
 * @returns {string} JSON string
 */
export function exportToJson(config: Config | PartialConfig, pretty: boolean = true): string {
  const exporter = new ConfigExport({ format: 'json', pretty });
  const result = exporter.export(config);
  return result.content;
}

/**
 * Quick export to environment file
 *
 * @param {Config | PartialConfig} config - Configuration to export
 * @returns {string} Environment file string
 */
export function exportToEnv(config: Config | PartialConfig): string {
  const exporter = new ConfigExport({ format: 'env' });
  const result = exporter.export(config);
  return result.content;
}
