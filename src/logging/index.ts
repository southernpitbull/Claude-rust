/**
 * Logging System - Main Export Module
 * Comprehensive logging system with structured logging, performance tracking, and audit trails
 */

// Core types
export * from './types.js';

// Core logging components
export { Logger } from './Logger.js';
export { LogManager } from './LogManager.js';
export { LogMetadata } from './LogMetadata.js';
export { LogFormatter } from './LogFormatter.js';
export { LogContext } from './LogContext.js';
export { LogTransport } from './LogTransport.js';

// Advanced logging features
export {
  StructuredLogger,
  createStructuredLogger,
  Timed,
  type ITimer,
  type IStructuredLogData,
  type IMetricData,
  type ISamplingConfig,
  type IStructuredLogContext,
} from './StructuredLogger.js';

export {
  PerformanceLogger,
  createPerformanceLogger,
  type IPerformanceThreshold,
  type IPerformanceProfile,
  type IPerformanceReport,
} from './PerformanceLogger.js';

export {
  AuditLogger,
  createAuditLogger,
  type ActorType,
  type AuditAction,
  type AuditResult,
  type IActor,
  type IResource,
  type IAuditEvent,
  type IAuditConfig,
} from './AuditLogger.js';

export {
  LogRotation,
  createLogRotation,
  type RotationStrategy,
  type TimeUnit,
  type IRotationConfig,
  type IRotationMetadata,
  type IRotationEvent,
  type RotationHook,
} from './LogRotation.js';

export {
  LogFilter,
  createLogFilter,
  type FilterType,
  type IFilterConfig,
  type IRateLimitConfig,
  type IDeduplicationConfig,
  type ISamplingConfig as IFilterSamplingConfig,
  type IFilterStats,
} from './LogFilter.js';

export {
  LogAggregator,
  createLogAggregator,
  type AggregationWindow,
  type MetricType,
  type IAlertCondition,
  type IAlert,
  type IAggregationResult,
  type IStatsSummary,
} from './LogAggregator.js';

export {
  RemoteLogger,
  createRemoteLogger,
  type TransportProtocol,
  type IRemoteLoggerConfig,
  type SendStatus,
  type ISendResult,
} from './RemoteLogger.js';

export {
  LogQuery,
  createLogQuery,
  type ITimeRange,
  type IQueryFilter,
  type IQueryOptions,
  type IQueryResult,
  type IAggregationQuery,
  type IAggregationResult as IQueryAggregationResult,
} from './LogQuery.js';

/**
 * Create a complete logging setup with all features
 */
export interface ICompleteLoggerConfig {
  /** Base logger configuration */
  baseConfig?: {
    level: string;
    console: boolean;
    file: boolean;
    filePath?: string;
  };

  /** Structured logger configuration */
  structured?: {
    enabled: boolean;
    sampling?: Partial<ISamplingConfig>;
  };

  /** Performance logger configuration */
  performance?: {
    enabled: boolean;
    defaultLogLevel?: string;
  };

  /** Audit logger configuration */
  audit?: {
    enabled: boolean;
    config?: Partial<IAuditConfig>;
  };

  /** Log rotation configuration */
  rotation?: {
    enabled: boolean;
    config?: Partial<IRotationConfig>;
  };

  /** Log filtering configuration */
  filtering?: {
    enabled: boolean;
  };

  /** Log aggregation configuration */
  aggregation?: {
    enabled: boolean;
    maxEntries?: number;
  };

  /** Remote logging configuration */
  remote?: {
    enabled: boolean;
    config?: IRemoteLoggerConfig;
  };
}

/**
 * Complete logger instance with all features
 */
export interface ICompleteLogger {
  /** Base logger */
  base: Logger;

  /** Structured logger */
  structured?: StructuredLogger;

  /** Performance logger */
  performance?: PerformanceLogger;

  /** Audit logger */
  audit?: AuditLogger;

  /** Log rotation */
  rotation?: LogRotation;

  /** Log filter */
  filter?: LogFilter;

  /** Log aggregator */
  aggregator?: LogAggregator;

  /** Remote logger */
  remote?: RemoteLogger;

  /** Log query */
  query?: LogQuery;

  /** Shutdown all loggers */
  shutdown(): Promise<void>;
}

/**
 * Create a complete logger with all features enabled
 */
export function createCompleteLogger(config?: ICompleteLoggerConfig): ICompleteLogger {
  // This would need the actual Logger implementation
  // For now, we'll throw an error indicating implementation needed
  throw new Error('createCompleteLogger requires Logger class implementation');
}

/**
 * Default export for convenience
 */
export default {
  Logger,
  LogManager,
  createStructuredLogger,
  createPerformanceLogger,
  createAuditLogger,
  createLogRotation,
  createLogFilter,
  createLogAggregator,
  createRemoteLogger,
  createLogQuery,
  createCompleteLogger,
};
