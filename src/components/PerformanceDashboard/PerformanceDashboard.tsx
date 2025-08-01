/**
 * Performance Dashboard Component
 * Real-time performance monitoring dashboard with charts and alerts
 */

import React, { useState, useEffect, useRef } from 'react';
import { PerformanceMonitor } from '@/utils/performanceMonitor/core';
import { PerformanceSnapshot, PerformanceAlert } from '@/utils/performanceMonitor/types';
import { FPSChart } from './FPSChart';
import { MemoryChart } from './MemoryChart';
import { AudioLatencyChart } from './AudioLatencyChart';
import { AlertsPanel } from './AlertsPanel';
import { PerformanceStats } from './PerformanceStats';
import { QualityControls } from './QualityControls';

interface PerformanceDashboardProps {
  monitor: PerformanceMonitor;
  className?: string;
  compact?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  monitor,
  className = '',
  compact = false,
  position = 'top-right',
}) => {
  const [metrics, setMetrics] = useState<PerformanceSnapshot | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'alerts' | 'settings'>('overview');
  const [history, setHistory] = useState<PerformanceSnapshot[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Subscribe to performance metrics updates
    unsubscribeRef.current = monitor.subscribe((newMetrics, newAlerts) => {
      setMetrics(newMetrics);
      setAlerts(newAlerts);
      
      // Update history for charts
      setHistory(prevHistory => {
        const newHistory = [...prevHistory, newMetrics];
        // Keep last 300 entries (5 minutes at 1s intervals)
        return newHistory.slice(-300);
      });
    });

    // Get initial data
    const initialMetrics = monitor.getMetrics();
    const initialAlerts = monitor.getActiveAlerts();
    const initialHistory = monitor.getHistory(300000); // 5 minutes

    if (initialMetrics) setMetrics(initialMetrics);
    setAlerts(initialAlerts);
    setHistory(initialHistory);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [monitor]);

  // Auto-show dashboard if there are critical alerts
  useEffect(() => {
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0 && !isVisible) {
      setIsVisible(true);
    }
  }, [alerts, isVisible]);

  const getPositionClasses = (): string => {
    const baseClasses = 'fixed z-50';
    switch (position) {
      case 'top-left':
        return `${baseClasses} top-4 left-4`;
      case 'top-right':
        return `${baseClasses} top-4 right-4`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`;
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4`;
      default:
        return `${baseClasses} top-4 right-4`;
    }
  };

  const getAlertSeverityColor = (severity: PerformanceAlert['severity']): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatFPS = (fps: number): string => {
    return fps > 0 ? fps.toFixed(0) : '--';
  };

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  };

  const formatLatency = (ms: number): string => {
    return `${ms.toFixed(0)}ms`;
  };

  // Toggle button (always visible)
  if (!isVisible) {
    return (
      <button
        className={`${getPositionClasses()} performance-toggle bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm font-mono hover:bg-opacity-90 transition-opacity`}
        onClick={() => setIsVisible(true)}
        title="Show Performance Dashboard"
      >
        <div className="flex items-center space-x-2">
          <span>📊</span>
          <div className="text-xs">
            <div>{formatFPS(metrics?.rendering.fps || 0)} FPS</div>
            {metrics?.memory && (
              <div className="opacity-75">{formatMemory(metrics.memory.heap.used)}</div>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={`${getPositionClasses()} ${className}`}>
      <div className="bg-gray-900 bg-opacity-95 text-white rounded-lg shadow-xl border border-gray-700 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📊</span>
            <h3 className="text-lg font-semibold">Performance Monitor</h3>
            {alerts.length > 0 && (
              <span className={`w-2 h-2 rounded-full ${alerts.some(a => a.severity === 'critical') ? 'bg-red-500' : 'bg-yellow-500'} animate-pulse`}></span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!compact && (
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                <span className="sr-only">Minimize</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {compact ? (
          <CompactView metrics={metrics} alerts={alerts} />
        ) : (
          <DetailedView
            metrics={metrics}
            alerts={alerts}
            history={history}
            monitor={monitor}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
};

const CompactView: React.FC<{
  metrics: PerformanceSnapshot | null;
  alerts: PerformanceAlert[];
}> = ({ metrics, alerts }) => {
  if (!metrics) {
    return (
      <div className="p-4 text-center text-gray-400">
        No performance data available
      </div>
    );
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="p-4 space-y-3">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-xl font-mono text-green-400">
            {(metrics.rendering.fps || 0).toFixed(0)}
          </div>
          <div className="text-gray-400 text-xs">FPS</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-mono text-blue-400">
            {Math.round((metrics.memory.heap.used || 0) / (1024 * 1024))}
          </div>
          <div className="text-gray-400 text-xs">MB</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-mono text-purple-400">
            {(metrics.audio.latency || 0).toFixed(0)}
          </div>
          <div className="text-gray-400 text-xs">ms</div>
        </div>
      </div>

      {/* Alerts Summary */}
      {alerts.length > 0 && (
        <div className="text-xs space-y-1">
          {criticalAlerts.length > 0 && (
            <div className="text-red-400">
              🚨 {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''}
            </div>
          )}
          {warningAlerts.length > 0 && (
            <div className="text-yellow-400">
              ⚠️ {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DetailedView: React.FC<{
  metrics: PerformanceSnapshot | null;
  alerts: PerformanceAlert[];
  history: PerformanceSnapshot[];
  monitor: PerformanceMonitor;
  activeTab: string;
  setActiveTab: (tab: 'overview' | 'charts' | 'alerts' | 'settings') => void;
}> = ({ metrics, alerts, history, monitor, activeTab, setActiveTab }) => {
  return (
    <div className="w-96">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'charts', label: 'Charts', icon: '📈' },
          { id: 'alerts', label: 'Alerts', icon: '🚨', badge: alerts.length },
          { id: 'settings', label: 'Settings', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-1 px-3 py-2 text-sm transition-colors relative ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-xs">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <PerformanceStats metrics={metrics} monitor={monitor} />
        )}
        
        {activeTab === 'charts' && (
          <div className="space-y-4">
            <FPSChart history={history} />
            <MemoryChart history={history} />
            <AudioLatencyChart history={history} />
          </div>
        )}
        
        {activeTab === 'alerts' && (
          <AlertsPanel alerts={alerts} monitor={monitor} />
        )}
        
        {activeTab === 'settings' && (
          <QualityControls monitor={monitor} />
        )}
      </div>
    </div>
  );
};