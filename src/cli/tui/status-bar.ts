import { LayoutManager } from './layout-manager';

/**
 * StatusBar displays system information, metrics,
 * and status indicators at the bottom of the main screen
 */
export class StatusBar {
  private layoutManager: LayoutManager;
  private statusElement: any;
  private metrics: Map<string, any>;
  private healthStatus: Map<string, boolean>;
  private performanceData: Map<string, number>;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
    this.metrics = new Map();
    this.healthStatus = new Map();
    this.performanceData = new Map();

    this.createStatusBar();
    this.initializeDefaultMetrics();
    this.startMetricsRefresh();
  }

  private createStatusBar(): void {
    // Create the status bar element
    this.statusElement = new (require('blessed').box)({
      parent: this.layoutManager.getMainScreen(),
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Add initial status content
    const statusText = new (require('blessed').text)({
      parent: this.statusElement,
      top: 0,
      left: 1,
      content: this.generateStatusString(),
      style: {
        fg: 'white',
        bg: 'blue',
      },
    });
  }

  private initializeDefaultMetrics(): void {
    // Initialize default metrics
    this.metrics.set('memory', {
      used: 0,
      total: 0,
      unit: 'MB',
    });

    this.metrics.set('cpu', {
      usage: 0,
      unit: '%',
    });

    this.metrics.set('api_requests', {
      count: 0,
      rate: 0,
      unit: 'req/min',
    });

    this.metrics.set('agents_active', {
      count: 0,
      total: 0,
      unit: 'agents',
    });

    // Initialize health status
    this.healthStatus.set('api_connection', true);
    this.healthStatus.set('database', true);
    this.healthStatus.set('cache', true);
    this.healthStatus.set('file_system', true);

    // Initialize performance data
    this.performanceData.set('response_time', 0);
    this.performanceData.set('throughput', 0);
    this.performanceData.set('error_rate', 0);
  }

  private startMetricsRefresh(): void {
    // In a real implementation, this would update metrics regularly
    // For this example, we'll just update with mock data every 3 seconds
    setInterval(() => {
      this.updateMetrics();
      this.updateStatusDisplay();
    }, 3000);
  }

  /**
   * Updates a specific metric value
   */
  public updateMetric(key: string, value: any): void {
    if (this.metrics.has(key)) {
      const metric = this.metrics.get(key);
      if (typeof metric === 'object') {
        Object.assign(metric, value);
      } else {
        this.metrics.set(key, value);
      }
    } else {
      this.metrics.set(key, value);
    }
  }

  /**
   * Updates a health status indicator
   */
  public updateHealthStatus(key: string, status: boolean): void {
    this.healthStatus.set(key, status);
  }

  /**
   * Updates performance metrics
   */
  public updatePerformance(key: string, value: number): void {
    this.performanceData.set(key, value);
  }

  /**
   * Updates all metrics with mock data for demonstration
   */
  private updateMetrics(): void {
    // Update memory metrics with mock data
    const mem = process.memoryUsage();
    this.updateMetric('memory', {
      used: Math.round(mem.heapUsed / 1024 / 1024),
      total: Math.round(mem.heapTotal / 1024 / 1024),
      unit: 'MB',
    });

    // Update CPU usage with mock data
    this.updateMetric('cpu', {
      usage: Math.floor(Math.random() * 30) + 10, // Random between 10-40%
      unit: '%',
    });

    // Update API requests with mock data
    this.updateMetric('api_requests', {
      count: Math.floor(Math.random() * 1000),
      rate: Math.floor(Math.random() * 50),
      unit: 'req/min',
    });

    // Update active agents with mock data
    this.updateMetric('agents_active', {
      count: Math.floor(Math.random() * 10) + 1, // 1-10 agents
      total: 20,
      unit: 'agents',
    });

    // Randomly toggle health status for demonstration
    if (Math.random() > 0.9) {
      // 10% chance to toggle a service status
      const services = Array.from(this.healthStatus.keys());
      const randomService = services[Math.floor(Math.random() * services.length)];
      this.updateHealthStatus(randomService, !this.healthStatus.get(randomService));
    }

    // Update performance data with mock values
    this.updatePerformance('response_time', Math.floor(Math.random() * 500) + 50); // 50-550ms
    this.updatePerformance('throughput', Math.floor(Math.random() * 100) + 10); // 10-110 req/sec
    this.updatePerformance('error_rate', Math.random() * 5); // 0-5% error rate
  }

  /**
   * Generates the status string to display in the status bar
   */
  private generateStatusString(): string {
    const mem = this.metrics.get('memory');
    const cpu = this.metrics.get('cpu');
    const api = this.metrics.get('api_requests');
    const agents = this.metrics.get('agents_active');

    // Format the status string
    const memStr = mem ? `${mem.used}/${mem.total}${mem.unit}` : 'N/A';
    const cpuStr = cpu ? `${cpu.usage}${cpu.unit}` : 'N/A';
    const apiStr = api ? `${api.rate}${api.unit}` : 'N/A';
    const agentsStr = agents ? `${agents.count}/${agents.total}` : 'N/A';

    // Health indicators
    const healthIndicators = [];
    for (const [service, status] of this.healthStatus.entries()) {
      const indicator = status ? '{green}●{/green}' : '{red}●{/red}';
      healthIndicators.push(`${indicator}${service}`);
    }

    // Performance indicators
    const responseTime = this.performanceData.get('response_time') || 0;
    const perfStr = `{bold}RT:{/bold}${responseTime}ms`;

    const statusString =
      `MEM: ${memStr} | CPU: ${cpuStr} | API: ${apiStr} | ` +
      `Agents: ${agentsStr} | ${healthIndicators.join(' ')} | ${perfStr}`;

    return statusString;
  }

  /**
   * Updates the status display with current metrics
   */
  private updateStatusDisplay(): void {
    // Remove existing text element
    if (this.statusElement.children.length > 0) {
      this.statusElement.children.forEach((child) => {
        this.statusElement.remove(child);
      });
    }

    // Create new text element with updated status
    const statusText = new (require('blessed').text)({
      parent: this.statusElement,
      top: 0,
      left: 1,
      content: this.generateStatusString(),
      style: {
        fg: 'white',
        bg: 'blue',
      },
    });

    this.layoutManager.render();
  }

  /**
   * Gets the current value of a metric
   */
  public getMetric(key: string): any {
    return this.metrics.get(key);
  }

  /**
   * Gets the current health status of a service
   */
  public getHealthStatus(key: string): boolean | undefined {
    return this.healthStatus.get(key);
  }

  /**
   * Gets the current performance data
   */
  public getPerformance(key: string): number | undefined {
    return this.performanceData.get(key);
  }

  /**
   * Gets all metrics as an object
   */
  public getAllMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }

  /**
   * Gets all health statuses as an object
   */
  public getAllHealthStatuses(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }

  /**
   * Gets all performance data as an object
   */
  public getAllPerformanceData(): Map<string, number> {
    return new Map(this.performanceData);
  }

  /**
   * Renders the status bar
   */
  public render(): void {
    this.updateStatusDisplay();
  }
}
