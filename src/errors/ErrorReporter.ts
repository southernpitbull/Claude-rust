/**
 * ErrorReporter.ts
 *
 * Error reporting and monitoring service for the AIrchitect CLI.
 * Integrates with error tracking services and provides anonymous crash reports.
 */

import { BaseError } from './BaseError';
import { Logger, LogLevel } from '../logging';
import { ErrorLogEntry } from './ErrorLogger';

/**
 * Error report interface
 */
export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: BaseError | Error;
  stack?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  environment: ReportEnvironment;
  user?: ReportUser;
  breadcrumbs?: Breadcrumb[];
  handled: boolean;
}

/**
 * Report environment interface
 */
export interface ReportEnvironment {
  platform: string;
  version: string;
  userAgent?: string;
  language: string;
  timezone: string;
  memory?: number;
  cpu?: string;
  os: string;
  osVersion: string;
}

/**
 * Report user interface
 */
export interface ReportUser {
  id?: string;
  email?: string;
  username?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Breadcrumb interface for error context
 */
export interface Breadcrumb {
  timestamp: Date;
  type: 'navigation' | 'http' | 'user' | 'state' | 'error' | 'custom';
  category: string;
  message: string;
  level?: LogLevel;
  data?: Record<string, unknown>;
}

/**
 * Error reporting configuration
 */
export interface ErrorReporterConfig {
  logger?: Logger;
  serviceName?: string;
  environment?: string;
  release?: string;
  enableConsoleReporting?: boolean;
  enableFileReporting?: boolean;
  enableRemoteReporting?: boolean;
  remoteEndpoint?: string;
  includeStack?: boolean;
  includeContext?: boolean;
  includeBreadcrumbs?: boolean;
  maxBreadcrumbs?: number;
  reportUnhandledErrors?: boolean;
  reportUncaughtExceptions?: boolean;
  reportUnhandledRejections?: boolean;
  privacyCompliance?: boolean;
  userIdentification?: boolean;
  optIn?: boolean;
  defaultTags?: Record<string, string>;
  beforeSend?: (report: ErrorReport) => ErrorReport | null;
}

/**
 * Remote error reporting service interface
 */
export interface IRemoteReportingService {
  send(report: ErrorReport): Promise<void>;
  configure(config: ErrorReporterConfig): void;
  close(): Promise<void>;
}

/**
 * Console reporting service
 */
export class ConsoleReportingService implements IRemoteReportingService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger({ level: LogLevel.ERROR });
  }

  async send(report: ErrorReport): Promise<void> {
    this.logger.error(`Error Report: ${report.error.message}`, {
      reportId: report.id,
      timestamp: report.timestamp,
      stack: report.stack,
      errorType: report.error.constructor.name,
      environment: report.environment,
      user: report.user,
      context: report.context,
      metadata: report.metadata,
      handled: report.handled,
    });
  }

  configure(config: ErrorReporterConfig): void {
    // Console reporter doesn't need specific configuration
  }

  async close(): Promise<void> {
    // Console reporter doesn't need cleanup
  }
}

/**
 * File reporting service
 */
export class FileReportingService implements IRemoteReportingService {
  private logger: Logger;
  private filePath: string;

  constructor(filePath: string, logger?: Logger) {
    this.filePath = filePath;
    this.logger =
      logger ||
      new Logger({
        level: LogLevel.ERROR,
        logToFile: true,
        logFilePath: filePath,
      });
  }

  async send(report: ErrorReport): Promise<void> {
    this.logger.error(`Error Report: ${report.error.message}`, {
      reportId: report.id,
      timestamp: report.timestamp,
      stack: report.stack,
      errorType: report.error.constructor.name,
      environment: report.environment,
      user: report.user,
      context: report.context,
      metadata: report.metadata,
      handled: report.handled,
    });
  }

  configure(config: ErrorReporterConfig): void {
    // File reporter configuration
  }

  async close(): Promise<void> {
    // File reporter cleanup
  }
}

/**
 * Custom HTTP reporting service
 */
export class HttpReportingService implements IRemoteReportingService {
  private endpoint: string;
  private apiKey?: string;
  private headers: Record<string, string>;

  constructor(endpoint: string, apiKey?: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
  }

  async send(report: ErrorReport): Promise<void> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send error report:', error);
      // Don't throw here as we don't want to crash due to reporting failure
    }
  }

  configure(config: ErrorReporterConfig): void {
    // HTTP-specific configuration
  }

  async close(): Promise<void> {
    // HTTP reporter cleanup
  }
}

/**
 * ErrorReporter class for comprehensive error reporting
 */
export class ErrorReporter {
  private config: ErrorReporterConfig;
  private logger: Logger;
  private breadcrumbs: Breadcrumb[];
  private reportingServices: IRemoteReportingService[];
  private initialized: boolean;
  private consentGiven: boolean;

  constructor(config: ErrorReporterConfig = {}) {
    this.config = {
      serviceName: config.serviceName || 'aichitect-cli',
      environment: config.environment || 'production',
      release: config.release || '0.1.0',
      enableConsoleReporting: config.enableConsoleReporting ?? true,
      enableFileReporting: config.enableFileReporting ?? true,
      enableRemoteReporting: config.enableRemoteReporting ?? false,
      remoteEndpoint: config.remoteEndpoint,
      includeStack: config.includeStack ?? true,
      includeContext: config.includeContext ?? true,
      includeBreadcrumbs: config.includeBreadcrumbs ?? true,
      maxBreadcrumbs: config.maxBreadcrumbs ?? 100,
      reportUnhandledErrors: config.reportUnhandledErrors ?? true,
      reportUncaughtExceptions: config.reportUncaughtExceptions ?? true,
      reportUnhandledRejections: config.reportUnhandledRejections ?? true,
      privacyCompliance: config.privacyCompliance ?? true,
      userIdentification: config.userIdentification ?? false,
      optIn: config.optIn ?? true,
      defaultTags: config.defaultTags || {},
      beforeSend: config.beforeSend,
      logger: config.logger,
    };

    // Create logger if not provided
    if (!this.config.logger) {
      this.config.logger = new Logger({ level: LogLevel.ERROR });
    }

    this.logger = this.config.logger;
    this.breadcrumbs = [];
    this.reportingServices = [];
    this.initialized = false;
    this.consentGiven = this.config.optIn ?? true;

    this.setupReportingServices();
  }

  /**
   * Initialize the error reporter
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Setup global error handlers if configured
    if (this.config.reportUncaughtExceptions) {
      this.setupUncaughtExceptionHandler();
    }

    if (this.config.reportUnhandledRejections) {
      this.setupUnhandledRejectionHandler();
    }

    this.initialized = true;
  }

  /**
   * Setup reporting services based on configuration
   */
  private setupReportingServices(): void {
    if (this.config.enableConsoleReporting) {
      this.reportingServices.push(new ConsoleReportingService(this.config.logger));
    }

    if (this.config.enableFileReporting) {
      this.reportingServices.push(
        new FileReportingService('./error-reports.log', this.config.logger)
      );
    }

    if (this.config.enableRemoteReporting && this.config.remoteEndpoint) {
      this.reportingServices.push(
        new HttpReportingService(this.config.remoteEndpoint, process.env.ERROR_REPORTING_API_KEY)
      );
    }
  }

  /**
   * Setup uncaught exception handler
   */
  private setupUncaughtExceptionHandler(): void {
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught exception:', error);
      this.captureException(error, { handled: false });

      // Allow the process to exit gracefully after reporting
      setImmediate(() => {
        process.exit(1);
      });
    });
  }

  /**
   * Setup unhandled rejection handler
   */
  private setupUnhandledRejectionHandler(): void {
    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.logger.error('Unhandled promise rejection:', error);
      this.captureException(error, { handled: false });
    });
  }

  /**
   * Capture an exception and create a report
   */
  public captureException(error: BaseError | Error, context?: ReportContext): string {
    if (!this.consentGiven) {
      // If no consent, only log locally if configured
      if (this.config.enableConsoleReporting) {
        this.config.logger.error('Error occurred (not reported due to opt-out)', error);
      }
      return '';
    }

    const reportId = this.generateReportId();
    const report: ErrorReport = {
      id: reportId,
      timestamp: new Date(),
      error,
      stack: this.config.includeStack ? error.stack : undefined,
      context: context?.context,
      metadata: {
        ...context?.metadata,
        tags: {
          ...this.config.defaultTags,
          ...context?.tags,
        },
      },
      environment: this.getEnvironmentInfo(),
      user: this.config.userIdentification ? context?.user : undefined,
      breadcrumbs: this.config.includeBreadcrumbs ? [...this.breadcrumbs] : undefined,
      handled: context?.handled ?? true,
    };

    // Apply beforeSend hook if configured
    if (this.config.beforeSend) {
      const processedReport = this.config.beforeSend(report);
      if (!processedReport) {
        return reportId; // Don't send if beforeSend returned null
      }
      Object.assign(report, processedReport);
    }

    // Send to all reporting services
    this.sendReport(report);

    // Clear breadcrumbs for next report if configured
    if (context?.clearBreadcrumbs) {
      this.clearBreadcrumbs();
    }

    return reportId;
  }

  /**
   * Capture a message and create a report
   */
  public captureMessage(message: string, context?: ReportContext): string {
    const error = new Error(message);
    return this.captureException(error, context);
  }

  /**
   * Add a breadcrumb to the current error context
   */
  public addBreadcrumb(breadcrumb: Breadcrumb): void {
    if (!this.config.includeBreadcrumbs) {
      return;
    }

    this.breadcrumbs.push(breadcrumb);

    // Limit the number of breadcrumbs
    if (this.breadcrumbs.length > (this.config.maxBreadcrumbs || 100)) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs!);
    }
  }

  /**
   * Clear all breadcrumbs
   */
  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Get current breadcrumbs
   */
  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Send a report to all configured services
   */
  private async sendReport(report: ErrorReport): Promise<void> {
    // Send to all configured reporting services
    const promises = this.reportingServices.map((service) =>
      service.send(report).catch((err) => {
        this.logger.warn(`Failed to send report to service: ${err.message}`);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): ReportEnvironment {
    return {
      platform: process.platform,
      version: process.version,
      language: process.env.LANG || 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      memory: process.memoryUsage().heapUsed,
      cpu: process.arch,
      os: require('os').type(),
      osVersion: require('os').release(),
    };
  }

  /**
   * Generate a unique report ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set user information for error reports
   */
  public setUser(user: ReportUser): void {
    if (this.config.privacyCompliance && !this.config.userIdentification) {
      // In privacy-compliant mode without identification, store minimal info
      return;
    }
    // Store user info for next report
  }

  /**
   * Set tags for error reports
   */
  public setTags(tags: Record<string, string>): void {
    Object.assign(this.config.defaultTags || {}, tags);
  }

  /**
   * Set extra metadata for error reports
   */
  public setExtra(key: string, value: unknown): void {
    // Store extra metadata for next report
  }

  /**
   * Give consent for error reporting
   */
  public giveConsent(): void {
    this.consentGiven = true;
  }

  /**
   * Withdraw consent for error reporting
   */
  public withdrawConsent(): void {
    this.consentGiven = false;
  }

  /**
   * Check if consent has been given
   */
  public hasConsent(): boolean {
    return this.consentGiven;
  }

  /**
   * Configure the error reporter
   */
  public configure(config: ErrorReporterConfig): void {
    Object.assign(this.config, config);

    if (config.logger) {
      this.logger = config.logger;
    }

    // Re-setup reporting services with new config
    this.setupReportingServices();
  }

  /**
   * Close the error reporter and cleanup resources
   */
  public async close(): Promise<void> {
    const promises = this.reportingServices.map((service) => service.close());
    await Promise.all(promises);
  }

  /**
   * Get the number of breadcrumbs
   */
  public getBreadcrumbCount(): number {
    return this.breadcrumbs.length;
  }
}

/**
 * Context for error reporting
 */
export interface ReportContext {
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: Record<string, string>;
  user?: ReportUser;
  handled?: boolean;
  clearBreadcrumbs?: boolean;
}

/**
 * Create an error reporter instance with default configuration
 */
export function createErrorReporter(config?: ErrorReporterConfig): ErrorReporter {
  return new ErrorReporter(config);
}

export default ErrorReporter;
