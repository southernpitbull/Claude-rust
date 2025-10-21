/**
 * ErrorFormatter.ts
 *
 * Format errors for display with console formatting, JSON, HTML, and more.
 * Provides consistent error presentation across the AIrchitect CLI.
 */

import chalk from 'chalk';
import { BaseError } from './BaseError';
import { ErrorCodes, ErrorCodeRegistry } from './ErrorCodes';

/**
 * Error formatting options
 */
export interface ErrorFormattingOptions {
  format?: 'console' | 'json' | 'html' | 'markdown' | 'plain';
  colorize?: boolean;
  includeStack?: boolean;
  includeContext?: boolean;
  includeMetadata?: boolean;
  compact?: boolean;
  verbose?: boolean;
  includeTimestamp?: boolean;
  includeErrorCodeDetails?: boolean;
  maxDepth?: number;
  syntaxHighlight?: boolean;
}

/**
 * Formatted error interface
 */
export interface FormattedError {
  formatted: string;
  format: string;
  metadata?: Record<string, unknown>;
}

/**
 * ErrorFormatter class for formatting errors
 */
export class ErrorFormatter {
  private defaultOptions: ErrorFormattingOptions;

  constructor(defaultOptions?: ErrorFormattingOptions) {
    this.defaultOptions = {
      format: defaultOptions?.format || 'console',
      colorize: defaultOptions?.colorize ?? true,
      includeStack: defaultOptions?.includeStack ?? true,
      includeContext: defaultOptions?.includeContext ?? true,
      includeMetadata: defaultOptions?.includeMetadata ?? true,
      compact: defaultOptions?.compact ?? false,
      verbose: defaultOptions?.verbose ?? false,
      includeTimestamp: defaultOptions?.includeTimestamp ?? true,
      includeErrorCodeDetails: defaultOptions?.includeErrorCodeDetails ?? true,
      maxDepth: defaultOptions?.maxDepth ?? 3,
      syntaxHighlight: defaultOptions?.syntaxHighlight ?? true,
    };
  }

  /**
   * Format an error according to options
   */
  public format(error: BaseError | Error, options?: ErrorFormattingOptions): FormattedError {
    const opts = { ...this.defaultOptions, ...options };

    let formatted: string;
    switch (opts.format) {
      case 'json':
        formatted = this.formatAsJSON(error, opts);
        break;
      case 'html':
        formatted = this.formatAsHTML(error, opts);
        break;
      case 'markdown':
        formatted = this.formatAsMarkdown(error, opts);
        break;
      case 'plain':
        formatted = this.formatAsPlain(error, opts);
        break;
      case 'console':
      default:
        formatted = this.formatAsConsole(error, opts);
        break;
    }

    return {
      formatted,
      format: opts.format!,
      metadata: this.getMetadata(error, opts),
    };
  }

  /**
   * Format error as console output
   */
  public formatAsConsole(error: BaseError | Error, options?: ErrorFormattingOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    // Error header
    lines.push('');

    if (error instanceof BaseError) {
      // Format BaseError with enhanced details
      const severityColor = this.getSeverityColor(error.severity);

      if (opts.colorize) {
        lines.push(chalk.bgRed.white(' ERROR ') + chalk.red(` [${error.errorCode}]`));
        lines.push(severityColor(`${error.severity.toUpperCase()}: ${error.message}`));
      } else {
        lines.push(`ERROR [${error.errorCode}]`);
        lines.push(`${error.severity.toUpperCase()}: ${error.message}`);
      }
    } else {
      // Format standard Error
      if (opts.colorize) {
        lines.push(chalk.bgRed.white(' ERROR '));
        lines.push(chalk.red(error.message));
      } else {
        lines.push('ERROR');
        lines.push(error.message);
      }
    }

    // Include error code details
    if (opts.includeErrorCodeDetails && error instanceof BaseError) {
      const errorMetadata = ErrorCodeRegistry.getMetadata(error.errorCode as ErrorCodes);
      if (errorMetadata) {
        if (opts.colorize) {
          lines.push(chalk.yellow('\nError Details:'));
          lines.push(`  Category: ${chalk.cyan(errorMetadata.category)}`);
          lines.push(
            `  Severity: ${this.getSeverityColor(errorMetadata.severity.toLowerCase())(errorMetadata.severity)}`
          );
          lines.push(`  User Message: ${chalk.gray(errorMetadata.userMessage)}`);

          if (errorMetadata.recoverySuggestions && errorMetadata.recoverySuggestions.length > 0) {
            lines.push(chalk.yellow('Recovery Suggestions:'));
            errorMetadata.recoverySuggestions.forEach((suggestion) => {
              lines.push(`  • ${chalk.green(suggestion)}`);
            });
          }
        } else {
          lines.push('\nError Details:');
          lines.push(`  Category: ${errorMetadata.category}`);
          lines.push(`  Severity: ${errorMetadata.severity}`);
          lines.push(`  User Message: ${errorMetadata.userMessage}`);

          if (errorMetadata.recoverySuggestions && errorMetadata.recoverySuggestions.length > 0) {
            lines.push('Recovery Suggestions:');
            errorMetadata.recoverySuggestions.forEach((suggestion) => {
              lines.push(`  • ${suggestion}`);
            });
          }
        }
      }
    }

    // Include context
    if (opts.includeContext && error instanceof BaseError && error.context) {
      if (opts.colorize) {
        lines.push(chalk.yellow('\nContext:'));
        lines.push(this.formatContextAsConsole(error.context, opts));
      } else {
        lines.push('\nContext:');
        lines.push(this.formatContextAsPlain(error.context));
      }
    }

    // Include metadata
    if (opts.includeMetadata && error instanceof BaseError && error.metadata) {
      if (opts.colorize) {
        lines.push(chalk.yellow('\nMetadata:'));
        lines.push(this.formatMetadataAsConsole(error.metadata, opts));
      } else {
        lines.push('\nMetadata:');
        lines.push(this.formatMetadataAsPlain(error.metadata));
      }
    }

    // Include stack trace
    if (opts.includeStack && error.stack) {
      if (opts.colorize) {
        lines.push(chalk.yellow('\nStack Trace:'));
        lines.push(chalk.gray(error.stack));
      } else {
        lines.push('\nStack Trace:');
        lines.push(error.stack);
      }
    }

    // Include timestamp
    if (opts.includeTimestamp) {
      const timestamp = new Date().toISOString();
      if (opts.colorize) {
        lines.push(chalk.gray(`\n[${timestamp}]`));
      } else {
        lines.push(`\n[${timestamp}]`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format error as JSON
   */
  public formatAsJSON(error: BaseError | Error, options?: ErrorFormattingOptions): string {
    const opts = { ...this.defaultOptions, ...options };

    const jsonObj: Record<string, unknown> = {
      message: error.message,
      name: error.name,
      timestamp: opts.includeTimestamp ? new Date().toISOString() : undefined,
    };

    if (error instanceof BaseError) {
      jsonObj.errorCode = error.errorCode;
      jsonObj.severity = error.severity;
      jsonObj.category = error.category;

      if (opts.includeContext && error.context) {
        jsonObj.context = this.truncateObject(error.context, opts.maxDepth!);
      }

      if (opts.includeMetadata && error.metadata) {
        jsonObj.metadata = this.truncateObject(error.metadata, opts.maxDepth!);
      }
    }

    if (opts.includeStack && error.stack) {
      jsonObj.stack = error.stack;
    }

    // Remove undefined values
    Object.keys(jsonObj).forEach((key) => {
      if (jsonObj[key] === undefined) {
        delete jsonObj[key];
      }
    });

    return JSON.stringify(jsonObj, null, opts.compact ? 0 : 2);
  }

  /**
   * Format error as HTML
   */
  public formatAsHTML(error: BaseError | Error, options?: ErrorFormattingOptions): string {
    const opts = { ...this.defaultOptions, ...options };

    let html = '<div class="error-report">';

    // Header
    html += '<div class="error-header">';
    if (error instanceof BaseError) {
      html += `<h2 class="error-code">${error.errorCode}</h2>`;
      html += `<h3 class="error-severity severity-${error.severity.toLowerCase()}">${error.severity}</h3>`;
    }
    html += `<h1 class="error-message">${this.escapeHtml(error.message)}</h1>`;
    html += '</div>';

    // Details
    html += '<div class="error-details">';

    if (opts.includeErrorCodeDetails && error instanceof BaseError) {
      const errorMetadata = ErrorCodeRegistry.getMetadata(error.errorCode as ErrorCodes);
      if (errorMetadata) {
        html += `<div class="error-metadata">`;
        html += `<p><strong>Category:</strong> ${this.escapeHtml(errorMetadata.category)}</p>`;
        html += `<p><strong>Description:</strong> ${this.escapeHtml(errorMetadata.description)}</p>`;
        html += `<p><strong>User Message:</strong> ${this.escapeHtml(errorMetadata.userMessage)}</p>`;

        if (errorMetadata.recoverySuggestions && errorMetadata.recoverySuggestions.length > 0) {
          html += `<p><strong>Recovery Suggestions:</strong></p><ul>`;
          errorMetadata.recoverySuggestions.forEach((suggestion) => {
            html += `<li>${this.escapeHtml(suggestion)}</li>`;
          });
          html += `</ul>`;
        }
        html += '</div>';
      }
    }

    if (opts.includeContext && error instanceof BaseError && error.context) {
      html += `<div class="error-context"><h4>Context:</h4>`;
      html += `<pre>${this.escapeHtml(JSON.stringify(error.context, null, 2))}</pre>`;
      html += '</div>';
    }

    if (opts.includeMetadata && error instanceof BaseError && error.metadata) {
      html += `<div class="error-metadata"><h4>Metadata:</h4>`;
      html += `<pre>${this.escapeHtml(JSON.stringify(error.metadata, null, 2))}</pre>`;
      html += '</div>';
    }

    if (opts.includeStack && error.stack) {
      html += `<div class="error-stack"><h4>Stack Trace:</h4>`;
      html += `<pre>${this.escapeHtml(error.stack)}</pre>`;
      html += '</div>';
    }

    if (opts.includeTimestamp) {
      html += `<div class="error-timestamp">${new Date().toISOString()}</div>`;
    }

    html += '</div>';
    html += '</div>';

    // Add basic styling
    html += `
    <style>
      .error-report { font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 5px; background-color: #fff5f5; }
      .error-header { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px; }
      .error-code { color: #d32f2f; margin: 0; }
      .error-severity { display: inline-block; padding: 2px 8px; border-radius: 3px; background-color: #ffebee; color: #c62828; margin: 0 0 10px 0; }
      .error-message { color: #d32f2f; margin: 10px 0 0 0; }
      .error-details { margin-top: 15px; }
      .error-metadata, .error-context, .error-stack { margin: 10px 0; }
      .error-stack pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
      .error-timestamp { color: #777; font-size: 0.9em; margin-top: 15px; }
    </style>`;

    return html;
  }

  /**
   * Format error as Markdown
   */
  public formatAsMarkdown(error: BaseError | Error, options?: ErrorFormattingOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    // Header
    if (error instanceof BaseError) {
      lines.push(`# Error: ${error.errorCode}`);
      lines.push(`**Severity**: ${error.severity}`);
      lines.push('');
    }

    lines.push(`## Message`);
    lines.push(error.message);
    lines.push('');

    if (opts.includeErrorCodeDetails && error instanceof BaseError) {
      const errorMetadata = ErrorCodeRegistry.getMetadata(error.errorCode as ErrorCodes);
      if (errorMetadata) {
        lines.push('## Error Details');
        lines.push(`- **Category**: ${errorMetadata.category}`);
        lines.push(`- **Description**: ${errorMetadata.description}`);
        lines.push(`- **User Message**: ${errorMetadata.userMessage}`);

        if (errorMetadata.recoverySuggestions && errorMetadata.recoverySuggestions.length > 0) {
          lines.push('## Recovery Suggestions');
          errorMetadata.recoverySuggestions.forEach((suggestion) => {
            lines.push(`- ${suggestion}`);
          });
          lines.push('');
        }
      }
    }

    if (opts.includeContext && error instanceof BaseError && error.context) {
      lines.push('## Context');
      lines.push('```json');
      lines.push(JSON.stringify(error.context, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (opts.includeMetadata && error instanceof BaseError && error.metadata) {
      lines.push('## Metadata');
      lines.push('```json');
      lines.push(JSON.stringify(error.metadata, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (opts.includeStack && error.stack) {
      lines.push('## Stack Trace');
      lines.push('```');
      lines.push(error.stack);
      lines.push('```');
      lines.push('');
    }

    if (opts.includeTimestamp) {
      lines.push(`## Timestamp`);
      lines.push(new Date().toISOString());
    }

    return lines.join('\n');
  }

  /**
   * Format error as plain text
   */
  public formatAsPlain(error: BaseError | Error, options?: ErrorFormattingOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (error instanceof BaseError) {
      lines.push(`ERROR [${error.errorCode}]`);
      lines.push(`SEVERITY: ${error.severity}`);
    } else {
      lines.push('ERROR');
    }

    lines.push(`MESSAGE: ${error.message}`);

    if (opts.includeErrorCodeDetails && error instanceof BaseError) {
      const errorMetadata = ErrorCodeRegistry.getMetadata(error.errorCode as ErrorCodes);
      if (errorMetadata) {
        lines.push(`CATEGORY: ${errorMetadata.category}`);
        lines.push(`DESCRIPTION: ${errorMetadata.description}`);
        lines.push(`USER MESSAGE: ${errorMetadata.userMessage}`);

        if (errorMetadata.recoverySuggestions && errorMetadata.recoverySuggestions.length > 0) {
          lines.push('RECOVERY SUGGESTIONS:');
          errorMetadata.recoverySuggestions.forEach((suggestion) => {
            lines.push(`  - ${suggestion}`);
          });
        }
      }
    }

    if (opts.includeContext && error instanceof BaseError && error.context) {
      lines.push('CONTEXT:');
      lines.push(JSON.stringify(error.context, null, 2));
    }

    if (opts.includeMetadata && error instanceof BaseError && error.metadata) {
      lines.push('METADATA:');
      lines.push(JSON.stringify(error.metadata, null, 2));
    }

    if (opts.includeStack && error.stack) {
      lines.push('STACK TRACE:');
      lines.push(error.stack);
    }

    if (opts.includeTimestamp) {
      lines.push(`TIMESTAMP: ${new Date().toISOString()}`);
    }

    return lines.join('\n');
  }

  /**
   * Get severity color function
   */
  private getSeverityColor(severity: string): (str: string) => string {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return chalk.red;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.blue;
      default:
        return chalk.gray;
    }
  }

  /**
   * Format context as console output
   */
  private formatContextAsConsole(
    context: Record<string, unknown>,
    options: ErrorFormattingOptions
  ): string {
    if (options.compact) {
      return chalk.gray(JSON.stringify(context));
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(context)) {
      lines.push(`  ${chalk.cyan(key)}: ${this.formatValue(value, options)}`);
    }
    return lines.join('\n');
  }

  /**
   * Format context as plain text
   */
  private formatContextAsPlain(context: Record<string, unknown>): string {
    return JSON.stringify(context, null, 2);
  }

  /**
   * Format metadata as console output
   */
  private formatMetadataAsConsole(
    metadata: Record<string, unknown>,
    options: ErrorFormattingOptions
  ): string {
    if (options.compact) {
      return chalk.gray(JSON.stringify(metadata));
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(metadata)) {
      lines.push(`  ${chalk.magenta(key)}: ${this.formatValue(value, options)}`);
    }
    return lines.join('\n');
  }

  /**
   * Format metadata as plain text
   */
  private formatMetadataAsPlain(metadata: Record<string, unknown>): string {
    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Format a value for console output
   */
  private formatValue(value: unknown, options: ErrorFormattingOptions): string {
    if (value === null) {
      return options.colorize ? chalk.gray('null') : 'null';
    }

    if (value === undefined) {
      return options.colorize ? chalk.gray('undefined') : 'undefined';
    }

    if (typeof value === 'string') {
      return options.colorize ? chalk.green(`"${value}"`) : `"${value}"`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return options.colorize ? chalk.yellow(String(value)) : String(value);
    }

    if (typeof value === 'object') {
      return options.colorize
        ? chalk.gray(JSON.stringify(value, null, options.compact ? 0 : 1))
        : JSON.stringify(value, null, options.compact ? 0 : 1);
    }

    return String(value);
  }

  /**
   * Get error metadata
   */
  private getMetadata(
    error: BaseError | Error,
    options: ErrorFormattingOptions
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      formattedAt: new Date().toISOString(),
      format: options.format,
      includeStack: options.includeStack,
      includeContext: options.includeContext,
      includeMetadata: options.includeMetadata,
    };

    if (error instanceof BaseError) {
      metadata.errorCode = error.errorCode;
      metadata.severity = error.severity;
      metadata.category = error.category;
    }

    return metadata;
  }

  /**
   * Truncate object to max depth
   */
  private truncateObject(obj: unknown, maxDepth: number, currentDepth = 0): unknown {
    if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.truncateObject(item, maxDepth, currentDepth + 1));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.truncateObject(value, maxDepth, currentDepth + 1);
    }

    return result;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(str: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return str.replace(/[&<>"'\/]/g, (char) => escapeMap[char]);
  }

  /**
   * Format multiple errors
   */
  public formatMultiple(
    errors: Array<BaseError | Error>,
    options?: ErrorFormattingOptions
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const formattedErrors = errors.map((error) => this.format(error, opts));
    return formattedErrors.map((fe) => fe.formatted).join('\n\n' + '='.repeat(50) + '\n\n');
  }

  /**
   * Format error for CLI output (with appropriate colors based on environment)
   */
  public formatForCLI(error: BaseError | Error, verbose = false): string {
    const shouldColorize = process.env.NO_COLOR !== '1' && process.stdout.isTTY;

    return this.formatAsConsole(error, {
      colorize: shouldColorize,
      verbose,
      includeStack: verbose,
      includeContext: verbose,
      includeMetadata: verbose,
      includeErrorCodeDetails: true,
    }).trim();
  }
}

/**
 * Default error formatter instance
 */
export const errorFormatter = new ErrorFormatter();

export default ErrorFormatter;
