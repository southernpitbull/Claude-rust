/**
 * Analytics and Monitoring System for AIrchitect CLI
 *
 * This module provides comprehensive analytics and monitoring
 * capabilities for the AIrchitect CLI system.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

/**
 * Interface for analytics event
 */
export interface AnalyticsEvent {
  /**
   * Event type
   */
  type: string;

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Event data
   */
  data: Record<string, any>;

  /**
   * Event metadata
   */
  metadata: {
    /**
     * Session ID
     */
    sessionId: string;

    /**
     * User ID (if available)
     */
    userId?: string;

    /**
     * Application version
     */
    version: string;

    /**
     * Operating system
     */
    os: string;

    /**
     * Architecture
     */
    arch: string;

    /**
     * Node.js version
     */
    nodeVersion: string;
  };
}

/**
 * Interface for analytics configuration
 */
export interface AnalyticsConfig {
  /**
   * Whether analytics collection is enabled
   */
  enabled: boolean;

  /**
   * Analytics collection endpoint
   */
  endpoint?: string;

  /**
   * Analytics collection interval (in milliseconds)
   */
  collectionInterval: number;

  /**
   * Maximum number of events to store locally
   */
  maxLocalEvents: number;

  /**
   * Local storage path for analytics data
   */
  storagePath: string;

  /**
   * Whether to send anonymous usage data
   */
  anonymous: boolean;

  /**
   * Whether to collect performance metrics
   */
  collectPerformance: boolean;

  /**
   * Whether to collect error reports
   */
  collectErrors: boolean;

  /**
   * Whether to collect feature usage data
   */
  collectUsage: boolean;
}

/**
 * Interface for analytics metrics
 */
export interface AnalyticsMetrics {
  /**
   * Application usage metrics
   */
  usage: {
    /**
     * Total sessions
     */
    sessions: number;

    /**
     * Total commands executed
     */
    commands: number;

    /**
     * Total AI interactions
     */
    aiInteractions: number;

    /**
     * Total plugins used
     */
    plugins: number;

    /**
     * Total projects worked on
     */
    projects: number;
  };

  /**
   * Performance metrics
   */
  performance: {
    /**
     * Average command execution time (ms)
     */
    avgCommandTime: number;

    /**
     * Average AI response time (ms)
     */
    avgAIResponseTime: number;

    /**
     * Memory usage (MB)
     */
    memoryUsage: number;

    /**
     * CPU usage (%)
     */
    cpuUsage: number;
  };

  /**
   * Error metrics
   */
  errors: {
    /**
     * Total errors
     */
    total: number;

    /**
     * Fatal errors
     */
    fatal: number;

    /**
     * Recoverable errors
     */
    recoverable: number;

    /**
     * Error rate (%)
     */
    rate: number;
  };

  /**
   * Feature usage metrics
   */
  features: {
    /**
     * Planning mode usage
     */
    planningMode: number;

    /**
     * Work mode usage
     */
    workMode: number;

    /**
     * Agent usage
     */
    agents: number;

    /**
     * Plugin usage
     */
    plugins: number;
  };
}

/**
 * Analytics and Monitoring System
 */
export class AnalyticsSystem extends EventEmitter {
  private config: AnalyticsConfig;
  private events: AnalyticsEvent[];
  private sessionId: string;
  private userId: string;
  private initialized: boolean = false;
  private collectionTimer: NodeJS.Timeout | null = null;
  private metrics: AnalyticsMetrics;

  constructor(config?: Partial<AnalyticsConfig>) {
    super();

    this.config = {
      enabled: config?.enabled !== undefined ? config.enabled : true,
      endpoint: config?.endpoint || 'https://analytics.aichitect.com/api/v1/events',
      collectionInterval: config?.collectionInterval || 30000, // 30 seconds
      maxLocalEvents: config?.maxLocalEvents || 1000,
      storagePath: config?.storagePath || path.join(os.homedir(), '.aichitect', 'analytics'),
      anonymous: config?.anonymous !== undefined ? config.anonymous : true,
      collectPerformance:
        config?.collectPerformance !== undefined ? config.collectPerformance : true,
      collectErrors: config?.collectErrors !== undefined ? config.collectErrors : true,
      collectUsage: config?.collectUsage !== undefined ? config.collectUsage : true,
      ...config,
    };

    this.events = [];
    this.sessionId = this.generateSessionId();
    this.userId = this.generateUserId();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the analytics system
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        console.log('Analytics system disabled');
        return true;
      }

      // Create storage directory
      await fs.mkdir(this.config.storagePath, { recursive: true });

      // Load existing events
      await this.loadEvents();

      // Start collection timer
      this.startCollectionTimer();

      this.initialized = true;
      console.log('Analytics system initialized successfully');

      // Record initialization event
      this.recordEvent('system_initialized', {
        config: this.config,
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize analytics system:', error);
      return false;
    }
  }

  /**
   * Record an analytics event
   */
  public recordEvent(type: string, data: Record<string, any> = {}): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    const event: AnalyticsEvent = {
      type,
      timestamp: new Date(),
      data,
      metadata: {
        sessionId: this.sessionId,
        userId: this.config.anonymous ? undefined : this.userId,
        version: process.env.npm_package_version || '1.0.0',
        os: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
    };

    this.events.push(event);

    // Emit event for real-time listeners
    this.emit('event', event);

    // Trim events if we exceed the maximum
    if (this.events.length > this.config.maxLocalEvents) {
      this.events = this.events.slice(-this.config.maxLocalEvents);
    }

    // Update metrics based on event type
    this.updateMetrics(event);
  }

  /**
   * Record a command execution
   */
  public recordCommand(command: string, duration: number, success: boolean): void {
    this.recordEvent('command_executed', {
      command,
      duration,
      success,
    });
  }

  /**
   * Record an AI interaction
   */
  public recordAIInteraction(
    provider: string,
    model: string,
    promptTokens: number,
    responseTokens: number,
    duration: number,
    success: boolean
  ): void {
    this.recordEvent('ai_interaction', {
      provider,
      model,
      promptTokens,
      responseTokens,
      duration,
      success,
    });
  }

  /**
   * Record a plugin usage
   */
  public recordPluginUsage(plugin: string, action: string): void {
    this.recordEvent('plugin_used', {
      plugin,
      action,
    });
  }

  /**
   * Record an error
   */
  public recordError(error: Error, context: string): void {
    this.recordEvent('error_occurred', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  /**
   * Record a feature usage
   */
  public recordFeatureUsage(feature: string): void {
    this.recordEvent('feature_used', {
      feature,
    });
  }

  /**
   * Record a performance metric
   */
  public recordPerformanceMetric(metric: string, value: number): void {
    this.recordEvent('performance_metric', {
      metric,
      value,
    });
  }

  /**
   * Get current analytics metrics
   */
  public getMetrics(): AnalyticsMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset analytics metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Export analytics data
   */
  public async exportData(filePath: string): Promise<boolean> {
    try {
      const data = {
        events: this.events,
        metrics: this.metrics,
        exportedAt: new Date().toISOString(),
      };

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to export analytics data to ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Import analytics data
   */
  public async importData(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      if (data.events && Array.isArray(data.events)) {
        this.events = data.events.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
        }));
      }

      if (data.metrics) {
        this.metrics = data.metrics;
      }

      return true;
    } catch (error) {
      console.error(`Failed to import analytics data from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Clear analytics data
   */
  public async clearData(): Promise<boolean> {
    try {
      this.events = [];
      this.resetMetrics();

      // Clear local storage
      const eventsFile = path.join(this.config.storagePath, 'events.json');
      await fs.unlink(eventsFile).catch(() => {}); // Ignore errors if file doesn't exist

      return true;
    } catch (error) {
      console.error('Failed to clear analytics data:', error);
      return false;
    }
  }

  /**
   * Get analytics configuration
   */
  public getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update analytics configuration
   */
  public async updateConfig(newConfig: Partial<AnalyticsConfig>): Promise<boolean> {
    try {
      this.config = { ...this.config, ...newConfig };

      // Restart collection timer if interval changed
      if (newConfig.collectionInterval !== undefined) {
        this.restartCollectionTimer();
      }

      // Save configuration
      await this.saveConfig();

      return true;
    } catch (error) {
      console.error('Failed to update analytics configuration:', error);
      return false;
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a user ID
   */
  private generateUserId(): string {
    // Generate a persistent user ID based on machine info
    const machineId = os.hostname() + os.platform() + os.arch();
    return `user_${require('crypto').createHash('sha256').update(machineId).digest('hex').substring(0, 16)}`;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): AnalyticsMetrics {
    return {
      usage: {
        sessions: 0,
        commands: 0,
        aiInteractions: 0,
        plugins: 0,
        projects: 0,
      },
      performance: {
        avgCommandTime: 0,
        avgAIResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      errors: {
        total: 0,
        fatal: 0,
        recoverable: 0,
        rate: 0,
      },
      features: {
        planningMode: 0,
        workMode: 0,
        agents: 0,
        plugins: 0,
      },
    };
  }

  /**
   * Update metrics based on an event
   */
  private updateMetrics(event: AnalyticsEvent): void {
    switch (event.type) {
      case 'command_executed':
        this.metrics.usage.commands++;
        this.metrics.performance.avgCommandTime =
          (this.metrics.performance.avgCommandTime * (this.metrics.usage.commands - 1) +
            event.data.duration) /
          this.metrics.usage.commands;
        break;

      case 'ai_interaction':
        this.metrics.usage.aiInteractions++;
        this.metrics.performance.avgAIResponseTime =
          (this.metrics.performance.avgAIResponseTime * (this.metrics.usage.aiInteractions - 1) +
            event.data.duration) /
          this.metrics.usage.aiInteractions;
        break;

      case 'plugin_used':
        this.metrics.usage.plugins++;
        break;

      case 'feature_used':
        switch (event.data.feature) {
          case 'planning':
            this.metrics.features.planningMode++;
            break;
          case 'work':
            this.metrics.features.workMode++;
            break;
          case 'agent':
            this.metrics.features.agents++;
            break;
          case 'plugin':
            this.metrics.features.plugins++;
            break;
        }
        break;

      case 'error_occurred':
        this.metrics.errors.total++;
        this.metrics.errors.rate =
          (this.metrics.errors.total /
            (this.metrics.usage.commands + this.metrics.usage.aiInteractions + 1)) *
          100;
        break;
    }
  }

  /**
   * Load events from local storage
   */
  private async loadEvents(): Promise<void> {
    try {
      const eventsFile = path.join(this.config.storagePath, 'events.json');
      const content = await fs.readFile(eventsFile, 'utf8');
      const data = JSON.parse(content);

      if (data.events && Array.isArray(data.events)) {
        this.events = data.events.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
        }));
      }
    } catch (error) {
      // Ignore errors if file doesn't exist or is invalid
      console.debug('No existing analytics events found or file is invalid');
    }
  }

  /**
   * Save events to local storage
   */
  private async saveEvents(): Promise<void> {
    try {
      const eventsFile = path.join(this.config.storagePath, 'events.json');
      const data = {
        events: this.events,
        metrics: this.metrics,
        savedAt: new Date().toISOString(),
      };

      await fs.writeFile(eventsFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save analytics events:', error);
    }
  }

  /**
   * Save configuration to local storage
   */
  private async saveConfig(): Promise<void> {
    try {
      const configFile = path.join(this.config.storagePath, 'config.json');
      await fs.writeFile(configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save analytics configuration:', error);
    }
  }

  /**
   * Start the collection timer
   */
  private startCollectionTimer(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }

    this.collectionTimer = setInterval(() => {
      this.collectAndSendData();
    }, this.config.collectionInterval);
  }

  /**
   * Restart the collection timer
   */
  private restartCollectionTimer(): void {
    this.startCollectionTimer();
  }

  /**
   * Collect and send analytics data
   */
  private async collectAndSendData(): Promise<void> {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    try {
      // Update system metrics
      this.updateSystemMetrics();

      // Save events locally
      await this.saveEvents();

      // Send data to remote endpoint if configured
      if (this.config.endpoint) {
        await this.sendDataToEndpoint();
      }
    } catch (error) {
      console.error('Failed to collect and send analytics data:', error);
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.performance.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);

    // Update CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.metrics.performance.cpuUsage = Math.round(cpuUsage.user / 1000000); // Convert microseconds to milliseconds
  }

  /**
   * Send data to remote endpoint
   */
  private async sendDataToEndpoint(): Promise<void> {
    // In a real implementation, this would send data to the analytics endpoint
    // For now, we'll just log that we would send data
    console.debug(`Would send ${this.events.length} events to ${this.config.endpoint}`);
  }

  /**
   * Clean up analytics system resources
   */
  public async cleanup(): Promise<void> {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    // Save final events
    await this.saveEvents();

    // Save final configuration
    await this.saveConfig();

    this.initialized = false;
    console.log('Analytics system cleaned up');
  }
}
