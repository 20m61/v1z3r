/**
 * Performance Monitor Core
 * Central orchestrator for V1Z3R performance monitoring and optimization
 */

import {
  PerformanceMonitorConfig,
  PerformanceSnapshot,
  PerformanceAlert,
  PerformanceHistory,
  MetricCollector,
  AlertRule,
  MetricsCallback,
  MetricsSubscriber,
  DEFAULT_CONFIG,
  DEFAULT_ALERT_RULES,
} from './types';

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private collectors: Map<string, MetricCollector> = new Map();
  private history: PerformanceHistory;
  private subscribers: Set<MetricsSubscriber> = new Set();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private running: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private currentSnapshot?: PerformanceSnapshot;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.history = {
      entries: [],
      maxLength: this.config.historyLength,
      timeRange: this.config.historyLength * this.config.updateInterval,
    };

    // Initialize default alert rules
    DEFAULT_ALERT_RULES.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Start performance monitoring
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('Performance monitoring is already running');
      return;
    }

    console.log('Starting performance monitoring system...');

    // Initialize all collectors
    for (const [name, collector] of this.collectors) {
      try {
        if (collector.initialize) {
          await collector.initialize();
        }
        console.log(`Initialized collector: ${name}`);
      } catch (error) {
        console.error(`Failed to initialize collector ${name}:`, error);
      }
    }

    this.running = true;

    // Start collection interval
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.config.updateInterval);

    // Perform initial collection
    await this.collectMetrics();

    console.log('Performance monitoring started successfully');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    console.log('Stopping performance monitoring system...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Cleanup collectors
    for (const [name, collector] of this.collectors) {
      try {
        if (collector.cleanup) {
          collector.cleanup();
        }
      } catch (error) {
        console.error(`Failed to cleanup collector ${name}:`, error);
      }
    }

    this.running = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Get current performance metrics snapshot
   */
  getMetrics(): PerformanceSnapshot | null {
    return this.currentSnapshot || null;
  }

  /**
   * Check if monitoring is currently running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get performance history for specified duration
   */
  getHistory(duration?: number): PerformanceHistory {
    let entries: PerformanceSnapshot[];
    
    if (!duration) {
      entries = [...this.history.entries];
    } else {
      const cutoffTime = Date.now() - duration;
      entries = this.history.entries.filter(entry => entry.timestamp >= cutoffTime);
    }

    return {
      entries,
      maxLength: this.history.maxLength,
      timeRange: this.history.timeRange
    };
  }

  /**
   * Subscribe to performance metrics updates
   */
  subscribe(callback: MetricsCallback): () => void {
    const subscriber: MetricsSubscriber = {
      id: Math.random().toString(36).substr(2, 9),
      callback,
    };

    this.subscribers.add(subscriber);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Add alert rule
   */
  addAlert(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlert(id: string): void {
    this.alertRules.delete(id);
    console.log(`Removed alert rule: ${id}`);
  }

  /**
   * Get active (unresolved) alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts (including resolved ones)
   */
  getAllAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`Alert acknowledged: ${alertId}`);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = Date.now();
      console.log(`Alert resolved: ${alertId}`);
    }
  }

  /**
   * Add metric collector
   */
  addCollector(collector: MetricCollector): void {
    this.collectors.set(collector.name, collector);
    console.log(`Added performance collector: ${collector.name}`);
  }

  /**
   * Remove metric collector
   */
  removeCollector(name: string): void {
    const collector = this.collectors.get(name);
    if (collector && collector.cleanup) {
      collector.cleanup();
    }
    this.collectors.delete(name);
    console.log(`Removed performance collector: ${name}`);
  }

  /**
   * Integrate with external store (like Zustand)
   */
  integrateWithStore(store: any): void {
    if (!store) {
      console.warn('Store is not available for integration');
      return;
    }

    // Subscribe to updates and sync with store
    this.subscribe((metrics, alerts) => {
      try {
        if (store.setState) {
          const updateData: any = {
            performanceMetrics: metrics,
            performanceAlerts: alerts,
          };

          // Auto-show dashboard on critical alerts
          const criticalAlerts = alerts.filter(alert => 
            alert.severity === 'critical' && !alert.acknowledged
          );

          if (criticalAlerts.length > 0) {
            updateData.showPerformanceDashboard = true;
          }

          store.setState(updateData);
        }
      } catch (error) {
        console.error('Failed to sync with store:', error);
      }
    });

    console.log('Performance monitor integrated with store');
  }

  /**
   * Collect metrics from all collectors
   */
  private async collectMetrics(): Promise<void> {
    if (!this.running) {
      return;
    }

    const timestamp = Date.now();
    const snapshot: PerformanceSnapshot = {
      timestamp,
      rendering: {
        fps: 0,
        frameTimes: [],
        droppedFrames: 0,
        renderTime: 0,
      },
      memory: {
        heap: {
          used: 0,
          total: 0,
          limit: 0,
        },
        textures: 0,
        geometries: 0,
        materials: 0,
      },
      audio: {
        latency: 0,
        bufferSize: 0,
        underruns: 0,
        contextState: 'suspended',
        sampleRate: 44100,
      },
      ux: {
        inputLatency: 0,
        loadTime: 0,
        errorCount: 0,
        interactionSuccess: 0,
      },
    };

    // Collect metrics from all active collectors
    const collectionPromises = Array.from(this.collectors.values())
      .filter(collector => collector.enabled)
      .map(async collector => {
        try {
          const metrics = await collector.collect();
          // Merge metrics into snapshot
          if (metrics.rendering) {
            Object.assign(snapshot.rendering, metrics.rendering);
          }
          if (metrics.memory) {
            Object.assign(snapshot.memory, metrics.memory);
          }
          if (metrics.audio) {
            Object.assign(snapshot.audio, metrics.audio);
          }
          if (metrics.mobile) {
            snapshot.mobile = metrics.mobile;
          }
          if (metrics.ux) {
            Object.assign(snapshot.ux, metrics.ux);
          }
        } catch (error) {
          console.error(`Error collecting metrics from ${collector.name}:`, error);
        }
      });

    await Promise.all(collectionPromises);

    // Store snapshot
    this.currentSnapshot = snapshot;
    this.addToHistory(snapshot);

    // Process alerts
    this.processAlerts(snapshot);

    // Notify subscribers
    const activeAlerts = this.getActiveAlerts();
    this.notifySubscribers(snapshot, activeAlerts);
  }

  /**
   * Add snapshot to history
   */
  private addToHistory(snapshot: PerformanceSnapshot): void {
    this.history.entries.push(snapshot);

    // Maintain history size limit
    if (this.history.entries.length > this.history.maxLength) {
      this.history.entries.shift();
    }

    // Clean old entries based on time range
    const cutoffTime = Date.now() - this.history.timeRange;
    this.history.entries = this.history.entries.filter(
      entry => entry.timestamp >= cutoffTime
    );
  }

  /**
   * Process alert rules against current metrics
   */
  private processAlerts(snapshot: PerformanceSnapshot): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const metricValue = this.getMetricValue(snapshot, rule.metric);
        if (metricValue !== undefined) {
          this.evaluateAlertRule(rule, metricValue, snapshot.timestamp);
        }
      } catch (error) {
        console.error(`Error processing alert rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Get metric value from snapshot using dot notation
   */
  private getMetricValue(snapshot: PerformanceSnapshot, metricPath: string): number | undefined {
    const path = metricPath.split('.');
    let value: any = snapshot;

    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * Evaluate alert rule against metric value
   */
  private evaluateAlertRule(rule: AlertRule, value: number, timestamp: number): void {
    const violated = this.evaluateCondition(rule, value);
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.ruleId === rule.id && !alert.resolved
    );

    if (violated) {
      if (!existingAlert) {
        // Check if violation persists for required duration
        const violationHistory = this.getViolationHistory(rule, rule.duration);
        if (violationHistory.length > 0) {
          this.createAlert(rule, value, timestamp);
        }
      }
    } else if (existingAlert) {
      // Violation resolved
      this.resolveAlert(existingAlert.id);
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Get violation history for a rule within specified duration
   */
  private getViolationHistory(rule: AlertRule, duration: number): PerformanceSnapshot[] {
    const cutoffTime = Date.now() - duration;
    return this.history.entries
      .filter(entry => entry.timestamp >= cutoffTime)
      .filter(entry => {
        const value = this.getMetricValue(entry, rule.metric);
        return value !== undefined && this.evaluateCondition(rule, value);
      });
  }

  /**
   * Create new alert
   */
  private createAlert(rule: AlertRule, value: number, timestamp: number): void {
    const alert: PerformanceAlert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      type: this.mapRuleToAlertType(rule),
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} = ${value} (threshold: ${rule.threshold})`,
      timestamp,
      acknowledged: false,
      resolved: false,
      data: {
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        operator: rule.operator,
      },
    };

    this.alerts.set(alert.id, alert);
    console.warn(`Alert triggered: ${alert.message}`);
  }

  /**
   * Map alert rule to alert type
   */
  private mapRuleToAlertType(rule: AlertRule): PerformanceAlert['type'] {
    if (rule.metric.includes('fps')) return 'fps_drop';
    if (rule.metric.includes('memory')) return 'memory_leak';
    if (rule.metric.includes('audio')) return 'audio_glitch';
    if (rule.metric.includes('battery')) return 'battery_low';
    if (rule.metric.includes('latency')) return 'latency_high';
    return 'fps_drop'; // default
  }

  /**
   * Notify all subscribers of metrics update
   */
  private notifySubscribers(snapshot: PerformanceSnapshot, alerts: PerformanceAlert[]): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.callback(snapshot, alerts);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    }
  }

  /**
   * Get performance summary statistics
   */
  getPerformanceSummary(): {
    avgFps: number;
    minFps: number;
    maxFps: number;
    avgMemory: number;
    avgLatency: number;
    alertCount: number;
  } {
    const entries = this.history.entries;
    if (entries.length === 0) {
      return {
        avgFps: 0,
        minFps: 0,
        maxFps: 0,
        avgMemory: 0,
        avgLatency: 0,
        alertCount: 0,
      };
    }

    const fpsValues = entries.map(e => e.rendering.fps).filter(fps => fps > 0);
    const memoryValues = entries.map(e => e.memory.heap.used).filter(mem => mem > 0);
    const latencyValues = entries.map(e => e.audio.latency).filter(lat => lat > 0);

    return {
      avgFps: fpsValues.length > 0 ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length : 0,
      minFps: fpsValues.length > 0 ? Math.min(...fpsValues) : 0,
      maxFps: fpsValues.length > 0 ? Math.max(...fpsValues) : 0,
      avgMemory: memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0,
      avgLatency: latencyValues.length > 0 ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : 0,
      alertCount: this.getActiveAlerts().length,
    };
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    history: PerformanceSnapshot[];
    alerts: PerformanceAlert[];
    summary: any;
  } {
    return {
      history: [...this.history.entries],
      alerts: Array.from(this.alerts.values()),
      summary: this.getPerformanceSummary(),
    };
  }
}