/**
 * Alerts Panel Component
 * Displays and manages performance alerts
 */

import React, { useState } from 'react';
import { PerformanceAlert } from '@/utils/performanceMonitor/types';
import { PerformanceMonitor } from '@/utils/performanceMonitor/core';

interface AlertsPanelProps {
  alerts: PerformanceAlert[];
  monitor: PerformanceMonitor;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, monitor }) => {
  const [selectedAlert, setSelectedAlert] = useState<PerformanceAlert | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);
  const displayAlerts = showResolved ? resolvedAlerts : activeAlerts;

  const getSeverityIcon = (severity: PerformanceAlert['severity']): string => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📝';
    }
  };

  const getSeverityColor = (severity: PerformanceAlert['severity']): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-900 bg-opacity-20 border-red-500';
      case 'warning':
        return 'text-yellow-400 bg-yellow-900 bg-opacity-20 border-yellow-500';
      case 'info':
        return 'text-blue-400 bg-blue-900 bg-opacity-20 border-blue-500';
      default:
        return 'text-gray-400 bg-gray-900 bg-opacity-20 border-gray-500';
    }
  };

  const getTypeDescription = (type: PerformanceAlert['type']): string => {
    switch (type) {
      case 'fps_drop':
        return 'Frame Rate Drop';
      case 'memory_leak':
        return 'Memory Leak';
      case 'audio_glitch':
        return 'Audio Glitch';
      case 'battery_low':
        return 'Low Battery';
      case 'latency_high':
        return 'High Latency';
      default:
        return 'Performance Issue';
    }
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  const handleAcknowledge = (alertId: string): void => {
    monitor.acknowledgeAlert(alertId);
  };

  const handleResolve = (alertId: string): void => {
    monitor.resolveAlert(alertId);
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">✅</div>
        <div className="text-gray-400 text-sm">No performance alerts</div>
        <div className="text-gray-500 text-xs mt-1">System is running smoothly</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-semibold text-white">Alerts</h4>
          {activeAlerts.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {activeAlerts.length}
            </span>
          )}
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => setShowResolved(false)}
            className={`text-xs px-2 py-1 rounded ${
              !showResolved 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Active ({activeAlerts.length})
          </button>
          <button
            onClick={() => setShowResolved(true)}
            className={`text-xs px-2 py-1 rounded ${
              showResolved 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Resolved ({resolvedAlerts.length})
          </button>
        </div>
      </div>

      {/* Alerts list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`border rounded-lg p-3 cursor-pointer transition-all ${getSeverityColor(alert.severity)} ${
              selectedAlert?.id === alert.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2 flex-1">
                <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-white">
                      {getTypeDescription(alert.type)}
                    </span>
                    <span className="text-xs px-2 py-1 bg-black bg-opacity-30 rounded">
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1 truncate">
                    {alert.message}
                  </p>
                  <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                    <span>{formatTime(alert.timestamp)}</span>
                    {alert.acknowledged && (
                      <span className="text-green-400">✓ Acknowledged</span>
                    )}
                    {alert.resolved && (
                      <span className="text-blue-400">✓ Resolved</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons for active alerts */}
              {!alert.resolved && (
                <div className="flex flex-col space-y-1 ml-2">
                  {!alert.acknowledged && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcknowledge(alert.id);
                      }}
                      className="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
                    >
                      ACK
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResolve(alert.id);
                    }}
                    className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>

            {/* Expanded details */}
            {selectedAlert?.id === alert.id && (
              <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
                <div className="text-xs">
                  <div className="text-gray-400">Alert ID:</div>
                  <div className="text-white font-mono">{alert.id}</div>
                </div>
                
                {alert.data && (
                  <div className="text-xs">
                    <div className="text-gray-400">Details:</div>
                    <div className="text-white bg-black bg-opacity-30 rounded p-2 mt-1">
                      <pre className="whitespace-pre-wrap text-xs">
                        {JSON.stringify(alert.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="text-xs">
                  <div className="text-gray-400">Timestamp:</div>
                  <div className="text-white">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>

                {alert.resolved && (
                  <div className="text-xs">
                    <div className="text-gray-400">Resolution Time:</div>
                    <div className="text-white">
                      {formatTime(alert.timestamp)} (Duration: {
                        Math.floor((alert.timestamp - alert.timestamp) / 1000)
                      }s)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="border-t border-gray-700 pt-3">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="text-red-400 font-bold">
              {alerts.filter(a => a.severity === 'critical' && !a.resolved).length}
            </div>
            <div className="text-gray-500">Critical</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {alerts.filter(a => a.severity === 'warning' && !a.resolved).length}
            </div>
            <div className="text-gray-500">Warning</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">
              {alerts.filter(a => a.resolved).length}
            </div>
            <div className="text-gray-500">Resolved</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-t border-gray-700 pt-3">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              activeAlerts.forEach(alert => {
                if (!alert.acknowledged) {
                  handleAcknowledge(alert.id);
                }
              });
            }}
            disabled={activeAlerts.filter(a => !a.acknowledged).length === 0}
            className="flex-1 text-xs px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Acknowledge All
          </button>
          <button
            onClick={() => {
              activeAlerts.forEach(alert => {
                handleResolve(alert.id);
              });
            }}
            disabled={activeAlerts.length === 0}
            className="flex-1 text-xs px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Resolve All
          </button>
        </div>
      </div>
    </div>
  );
};