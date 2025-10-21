/**
 * OutputFormatter.ts
 *
 * Flexible output formatting system for the AIrchitect CLI.
 * Supports JSON, table, YAML, and plain text output formats.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Available output formats
 */
export enum OutputFormat {
  JSON = 'json',
  TABLE = 'table',
  PLAIN = 'plain',
  YAML = 'yaml',
  LIST = 'list',
}

/**
 * Table column configuration
 */
export interface ITableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: unknown) => string;
}

/**
 * Output formatter configuration
 */
export interface IOutputFormatterConfig {
  format?: OutputFormat;
  colorize?: boolean;
  pretty?: boolean;
  indent?: number;
}

/**
 * OutputFormatter class for formatting CLI output
 */
export class OutputFormatter {
  private format: OutputFormat;
  private colorize: boolean;
  private pretty: boolean;
  private indent: number;

  /**
   * Creates a new OutputFormatter instance
   * @param config - Formatter configuration
   */
  constructor(config: IOutputFormatterConfig = {}) {
    this.format = config.format ?? OutputFormat.PLAIN;
    this.colorize = config.colorize ?? true;
    this.pretty = config.pretty ?? true;
    this.indent = config.indent ?? 2;
  }

  /**
   * Set the output format
   * @param format - Output format to use
   */
  public setFormat(format: OutputFormat): void {
    this.format = format;
  }

  /**
   * Get the current output format
   * @returns Current output format
   */
  public getFormat(): OutputFormat {
    return this.format;
  }

  /**
   * Format data for output
   * @param data - Data to format
   * @param columns - Column configuration for table format
   * @returns Formatted output string
   */
  public format(data: unknown, columns?: ITableColumn[]): string {
    switch (this.format) {
      case OutputFormat.JSON:
        return this.formatJSON(data);
      case OutputFormat.TABLE:
        return this.formatTable(data, columns);
      case OutputFormat.YAML:
        return this.formatYAML(data);
      case OutputFormat.LIST:
        return this.formatList(data);
      case OutputFormat.PLAIN:
      default:
        return this.formatPlain(data);
    }
  }

  /**
   * Print formatted data to console
   * @param data - Data to print
   * @param columns - Column configuration for table format
   */
  public print(data: unknown, columns?: ITableColumn[]): void {
    const output = this.format(data, columns);
    console.log(output);
  }

  /**
   * Format data as JSON
   * @param data - Data to format
   * @returns JSON formatted string
   */
  private formatJSON(data: unknown): string {
    const jsonString = this.pretty ? JSON.stringify(data, null, this.indent) : JSON.stringify(data);

    if (this.colorize) {
      return this.colorizeJSON(jsonString);
    }

    return jsonString;
  }

  /**
   * Colorize JSON output
   * @param json - JSON string to colorize
   * @returns Colorized JSON string
   */
  private colorizeJSON(json: string): string {
    return json
      .replace(/"([^"]+)":/g, chalk.blue('"$1":'))
      .replace(/: "([^"]*)"/g, `: ${chalk.green('"$1"')}`)
      .replace(/: (\d+)/g, `: ${chalk.yellow('$1')}`)
      .replace(/: (true|false)/g, (_match, bool) => `: ${chalk.cyan(bool)}`)
      .replace(/: null/g, `: ${chalk.gray('null')}`);
  }

  /**
   * Format data as a table
   * @param data - Data to format
   * @param columns - Column configuration
   * @returns Table formatted string
   */
  private formatTable(data: unknown, columns?: ITableColumn[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data to display';
    }

    // Auto-detect columns if not provided
    const tableColumns = columns ?? this.autoDetectColumns(data);

    // Create table
    const table = new Table({
      head: tableColumns.map((col) => (this.colorize ? chalk.cyan(col.header) : col.header)),
      colWidths: tableColumns.map((col) => col.width),
      colAligns: tableColumns.map((col) => col.align ?? 'left'),
      style: {
        head: [],
        border: this.colorize ? ['gray'] : [],
      },
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
    });

    // Add rows
    for (const row of data) {
      const rowData = tableColumns.map((col) => {
        const value = this.getNestedValue(row, col.key);
        if (col.formatter) {
          return col.formatter(value);
        }
        return String(value ?? '');
      });
      table.push(rowData);
    }

    return table.toString();
  }

  /**
   * Auto-detect columns from data
   * @param data - Array of data objects
   * @returns Array of column configurations
   */
  private autoDetectColumns(data: unknown[]): ITableColumn[] {
    if (data.length === 0) {
      return [];
    }

    const firstRow = data[0];
    if (typeof firstRow !== 'object' || firstRow === null) {
      return [{ key: 'value', header: 'Value' }];
    }

    return Object.keys(firstRow).map((key) => ({
      key,
      header: this.formatHeaderName(key),
    }));
  }

  /**
   * Format header name (convert camelCase to Title Case)
   * @param key - Key to format
   * @returns Formatted header name
   */
  private formatHeaderName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Get nested value from object using dot notation
   * @param obj - Object to get value from
   * @param path - Dot-notated path
   * @returns Value at path
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current !== null && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Format data as YAML-like output
   * @param data - Data to format
   * @param level - Indentation level
   * @returns YAML formatted string
   */
  private formatYAML(data: unknown, level: number = 0): string {
    const indent = ' '.repeat(level * this.indent);

    if (data === null || data === undefined) {
      return `${indent}null`;
    }

    if (typeof data === 'string') {
      return `${indent}${this.colorize ? chalk.green(`"${data}"`) : `"${data}"`}`;
    }

    if (typeof data === 'number') {
      return `${indent}${this.colorize ? chalk.yellow(data) : data}`;
    }

    if (typeof data === 'boolean') {
      return `${indent}${this.colorize ? chalk.cyan(String(data)) : data}`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `${indent}[]`;
      }
      return data
        .map((item) => {
          const formattedItem = this.formatYAML(item, 0);
          return `${indent}- ${formattedItem.trim()}`;
        })
        .join('\n');
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return `${indent}{}`;
      }
      return entries
        .map(([key, value]) => {
          const coloredKey = this.colorize ? chalk.blue(key) : key;
          const formattedValue = this.formatYAML(value, level + 1);
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return `${indent}${coloredKey}:\n${formattedValue}`;
          }
          return `${indent}${coloredKey}: ${formattedValue.trim()}`;
        })
        .join('\n');
    }

    return `${indent}${String(data)}`;
  }

  /**
   * Format data as a plain text list
   * @param data - Data to format
   * @returns List formatted string
   */
  private formatList(data: unknown): string {
    if (Array.isArray(data)) {
      return data
        .map((item, index) => {
          const bullet = this.colorize ? chalk.cyan('•') : '•';
          if (typeof item === 'object' && item !== null) {
            const itemStr = JSON.stringify(item);
            return `${bullet} ${itemStr}`;
          }
          return `${bullet} ${String(item)}`;
        })
        .join('\n');
    }

    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => {
          const coloredKey = this.colorize ? chalk.blue(key) : key;
          return `${coloredKey}: ${String(value)}`;
        })
        .join('\n');
    }

    return String(data);
  }

  /**
   * Format data as plain text
   * @param data - Data to format
   * @returns Plain text string
   */
  private formatPlain(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data, null, this.indent);
    }

    return String(data);
  }

  /**
   * Format a success message
   * @param message - Success message
   * @returns Formatted success message
   */
  public success(message: string): string {
    if (this.colorize) {
      return `${chalk.green('✓')} ${chalk.green(message)}`;
    }
    return `✓ ${message}`;
  }

  /**
   * Format an error message
   * @param message - Error message
   * @returns Formatted error message
   */
  public error(message: string): string {
    if (this.colorize) {
      return `${chalk.red('✗')} ${chalk.red(message)}`;
    }
    return `✗ ${message}`;
  }

  /**
   * Format a warning message
   * @param message - Warning message
   * @returns Formatted warning message
   */
  public warning(message: string): string {
    if (this.colorize) {
      return `${chalk.yellow('⚠')} ${chalk.yellow(message)}`;
    }
    return `⚠ ${message}`;
  }

  /**
   * Format an info message
   * @param message - Info message
   * @returns Formatted info message
   */
  public info(message: string): string {
    if (this.colorize) {
      return `${chalk.blue('ℹ')} ${chalk.blue(message)}`;
    }
    return `ℹ ${message}`;
  }
}
