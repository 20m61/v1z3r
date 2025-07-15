/**
 * Production monitoring and alerting system
 * Implements comprehensive monitoring, alerting, and incident management
 */

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'critical' | 'warning' | 'info';
  duration: number; // milliseconds
  enabled: boolean;
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  message: string;
}

export interface MonitoringMetrics {
  // Performance metrics
  responseTime: number;
  errorRate: number;
  throughput: number;
  cpuUsage: number;
  memoryUsage: number;
  
  // Application metrics
  webglFrameRate: number;
  audioLatency: number;
  effectSwitchTime: number;
  stateUpdateTime: number;
  
  // Infrastructure metrics
  databaseConnections: number;
  cacheHitRate: number;
  websocketConnections: number;
  
  // Core Web Vitals
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Alert Manager for handling monitoring and alerting
 */
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private channels: AlertChannel[] = [];
  private metricsHistory: Array<{ timestamp: number; metrics: MonitoringMetrics }> = [];
  private alertHistory: Array<{ timestamp: number; alert: Alert }> = [];
  
  private readonly DEFAULT_RULES: AlertRule[] = [
    {
      id: 'high-response-time',
      name: 'High Response Time',
      metric: 'responseTime',
      threshold: 1000,
      operator: 'gt',
      severity: 'warning',
      duration: 30000, // 30 seconds
      enabled: true,
      description: 'API response time is above 1 second',
    },
    {
      id: 'critical-response-time',
      name: 'Critical Response Time',
      metric: 'responseTime',
      threshold: 3000,
      operator: 'gt',
      severity: 'critical',
      duration: 10000, // 10 seconds
      enabled: true,
      description: 'API response time is critically high (>3s)',
    },
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      metric: 'errorRate',
      threshold: 5,
      operator: 'gt',
      severity: 'warning',
      duration: 60000, // 1 minute
      enabled: true,
      description: 'Error rate is above 5%',
    },
    {
      id: 'critical-error-rate',
      name: 'Critical Error Rate',
      metric: 'errorRate',
      threshold: 10,
      operator: 'gt',
      severity: 'critical',
      duration: 30000, // 30 seconds
      enabled: true,
      description: 'Error rate is critically high (>10%)',
    },
    {
      id: 'low-frame-rate',
      name: 'Low WebGL Frame Rate',
      metric: 'webglFrameRate',
      threshold: 30,
      operator: 'lt',
      severity: 'warning',
      duration: 30000,
      enabled: true,
      description: 'WebGL frame rate dropped below 30 FPS',
    },
    {
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      metric: 'memoryUsage',
      threshold: 85,
      operator: 'gt',
      severity: 'warning',
      duration: 120000, // 2 minutes
      enabled: true,
      description: 'Memory usage is above 85%',
    },
    {
      id: 'poor-lcp',
      name: 'Poor Largest Contentful Paint',
      metric: 'lcp',
      threshold: 2500,
      operator: 'gt',
      severity: 'warning',
      duration: 60000,
      enabled: true,
      description: 'LCP is above 2.5 seconds (poor user experience)',
    },
    {
      id: 'poor-fid',
      name: 'Poor First Input Delay',
      metric: 'fid',
      threshold: 100,
      operator: 'gt',
      severity: 'warning',
      duration: 60000,
      enabled: true,
      description: 'FID is above 100ms (poor interactivity)',
    },
    {
      id: 'low-cache-hit-rate',
      name: 'Low Cache Hit Rate',
      metric: 'cacheHitRate',
      threshold: 70,
      operator: 'lt',
      severity: 'info',
      duration: 300000, // 5 minutes
      enabled: true,
      description: 'Cache hit rate is below 70%',
    },
  ];

  constructor() {
    this.initializeDefaultRules();
    this.setupCleanupInterval();
  }

  private initializeDefaultRules(): void {
    this.DEFAULT_RULES.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  private setupCleanupInterval(): void {
    // Clean up old metrics and alerts every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.set(ruleId, { ...rule, ...updates });
    }
  }

  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  async processMetrics(metrics: MonitoringMetrics): Promise<void> {
    const timestamp = Date.now();
    
    // Store metrics
    this.metricsHistory.push({ timestamp, metrics });
    
    // Check each rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      const metricValue = this.getMetricValue(metrics, rule.metric);
      if (metricValue === undefined) continue;
      
      const isTriggered = this.evaluateRule(rule, metricValue);
      
      if (isTriggered) {
        await this.handleRuleTriggered(rule, metricValue, timestamp);
      } else {
        // Check if we should resolve existing alerts
        this.checkAlertResolution(rule, metricValue, timestamp);
      }
    }
  }

  private getMetricValue(metrics: MonitoringMetrics, metricName: string): number | undefined {
    return (metrics as any)[metricName];
  }

  private evaluateRule(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'lte': return value <= rule.threshold;
      case 'eq': return value === rule.threshold;
      default: return false;
    }
  }

  private async handleRuleTriggered(rule: AlertRule, value: number, timestamp: number): Promise<void> {
    // Check if alert already exists and is not resolved
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.ruleId === rule.id && !alert.resolved
    );

    if (existingAlert) {
      // Update existing alert timestamp
      existingAlert.timestamp = timestamp;
      existingAlert.value = value;
      return;
    }

    // Check duration threshold
    const recentMetrics = this.getRecentMetrics(rule.duration);
    const violatingDuration = this.calculateViolatingDuration(rule, recentMetrics);
    
    if (violatingDuration >= rule.duration) {
      // Create new alert
      const alert: Alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        severity: rule.severity,
        timestamp,
        acknowledged: false,
        resolved: false,
        message: this.generateAlertMessage(rule, value),
      };

      this.alerts.set(alert.id, alert);
      this.alertHistory.push({ timestamp, alert });
      
      // Send notifications
      await this.sendNotifications(alert);
    }
  }

  private checkAlertResolution(rule: AlertRule, value: number, timestamp: number): void {
    const activeAlert = Array.from(this.alerts.values()).find(
      alert => alert.ruleId === rule.id && !alert.resolved
    );

    if (activeAlert && !this.evaluateRule(rule, value)) {
      // Mark alert as resolved
      activeAlert.resolved = true;
      activeAlert.timestamp = timestamp;
      
      // Send resolution notification
      this.sendResolutionNotification(activeAlert);
    }
  }

  private getRecentMetrics(duration: number): Array<{ timestamp: number; metrics: MonitoringMetrics }> {
    const cutoff = Date.now() - duration;
    return this.metricsHistory.filter(entry => entry.timestamp >= cutoff);
  }

  private calculateViolatingDuration(
    rule: AlertRule, 
    recentMetrics: Array<{ timestamp: number; metrics: MonitoringMetrics }>
  ): number {
    if (recentMetrics.length === 0) return 0;

    let violatingDuration = 0;
    let lastViolatingTimestamp = 0;

    for (const entry of recentMetrics.reverse()) {
      const value = this.getMetricValue(entry.metrics, rule.metric);
      if (value !== undefined && this.evaluateRule(rule, value)) {
        if (lastViolatingTimestamp === 0) {
          lastViolatingTimestamp = entry.timestamp;
        }
        violatingDuration = lastViolatingTimestamp - entry.timestamp;
      } else {
        lastViolatingTimestamp = 0;
        violatingDuration = 0;
      }
    }

    return violatingDuration;
  }

  private generateAlertMessage(rule: AlertRule, value: number): string {
    return `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold}). ${rule.description}`;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const enabledChannels = this.channels.filter(channel => channel.enabled);
    
    const notifications = enabledChannels.map(async channel => {
      try {
        await this.sendToChannel(channel, alert);
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error);
      }
    });

    await Promise.allSettled(notifications);
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailAlert(channel.config, alert);
        break;
      case 'slack':
        await this.sendSlackAlert(channel.config, alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(channel.config, alert);
        break;
      case 'sms':
        await this.sendSMSAlert(channel.config, alert);
        break;
      default:
        console.warn(`Unknown alert channel type: ${channel.type}`);
    }
  }

  private async sendEmailAlert(config: any, alert: Alert): Promise<void> {
    // Implementation would integrate with email service (SES, SendGrid, etc.)
    console.log('Email alert:', {
      to: config.recipients,
      subject: `${alert.severity.toUpperCase()}: ${alert.message}`,
      body: this.formatAlertForEmail(alert),
    });
  }

  private async sendSlackAlert(config: any, alert: Alert): Promise<void> {
    // Implementation would integrate with Slack API
    const payload = {
      channel: config.channel,
      text: `🚨 ${alert.severity.toUpperCase()} Alert`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Alert', value: alert.message, short: false },
            { title: 'Metric', value: alert.metric, short: true },
            { title: 'Value', value: alert.value.toString(), short: true },
            { title: 'Threshold', value: alert.threshold.toString(), short: true },
            { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true },
          ],
        },
      ],
    };

    console.log('Slack alert:', payload);
  }

  private async sendWebhookAlert(config: any, alert: Alert): Promise<void> {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        },
        body: JSON.stringify({
          alert,
          timestamp: Date.now(),
          source: 'v1z3r-monitoring',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook alert failed:', error);
      throw error;
    }
  }

  private async sendSMSAlert(config: any, alert: Alert): Promise<void> {
    // Implementation would integrate with SMS service (SNS, Twilio, etc.)
    const message = `${alert.severity.toUpperCase()}: ${alert.message.substring(0, 160)}`;
    console.log('SMS alert:', {
      to: config.phoneNumbers,
      message,
    });
  }

  private async sendResolutionNotification(alert: Alert): Promise<void> {
    console.log('Alert resolved:', alert.message);
    // Send resolution notifications to channels
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return 'good';
    }
  }

  private formatAlertForEmail(alert: Alert): string {
    return `
Alert Details:
- Message: ${alert.message}
- Severity: ${alert.severity.toUpperCase()}
- Metric: ${alert.metric}
- Current Value: ${alert.value}
- Threshold: ${alert.threshold}
- Time: ${new Date(alert.timestamp).toISOString()}

Alert ID: ${alert.id}
Rule ID: ${alert.ruleId}
    `.trim();
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = Date.now();
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory
      .slice(-limit)
      .map(entry => entry.alert)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getMetricsHistory(duration: number): Array<{ timestamp: number; metrics: MonitoringMetrics }> {
    const cutoff = Date.now() - duration;
    return this.metricsHistory.filter(entry => entry.timestamp >= cutoff);
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    // Clean up old metrics
    this.metricsHistory = this.metricsHistory.filter(
      entry => entry.timestamp >= cutoff
    );
    
    // Clean up old alert history
    this.alertHistory = this.alertHistory.filter(
      entry => entry.timestamp >= cutoff
    );
    
    // Clean up resolved alerts older than 24 hours
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.timestamp < cutoff) {
        this.alerts.delete(id);
      }
    }
  }

  exportConfiguration(): object {
    return {
      rules: Array.from(this.rules.values()),
      channels: this.channels,
    };
  }

  importConfiguration(config: { rules: AlertRule[]; channels: AlertChannel[] }): void {
    this.rules.clear();
    config.rules.forEach(rule => this.rules.set(rule.id, rule));
    this.channels = [...config.channels];
  }
}

// Global alert manager instance
export const alertManager = new AlertManager();

// Initialize with default channels for production
if (process.env.NODE_ENV === 'production') {
  // Add production alert channels
  if (process.env.SLACK_WEBHOOK_URL) {
    alertManager.addChannel({
      type: 'slack',
      config: {
        url: process.env.SLACK_WEBHOOK_URL,
        channel: '#alerts',
      },
      enabled: true,
    });
  }

  if (process.env.ALERT_EMAIL_RECIPIENTS) {
    alertManager.addChannel({
      type: 'email',
      config: {
        recipients: process.env.ALERT_EMAIL_RECIPIENTS.split(','),
      },
      enabled: true,
    });
  }

  if (process.env.ALERT_WEBHOOK_URL) {
    alertManager.addChannel({
      type: 'webhook',
      config: {
        url: process.env.ALERT_WEBHOOK_URL,
        headers: {
          'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`,
        },
      },
      enabled: true,
    });
  }
}