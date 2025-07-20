/**
 * Performance Dashboard Component
 * Real-time monitoring for WebGL/WebGPU performance and error tracking
 */

import React, { useState, useEffect } from 'react';
import { usePerformanceMonitor } from '@/utils/performanceMonitor';
import { performanceMonitor } from '@/utils/performanceMonitor';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit = '', 
  status = 'good',
  description 
}) => {
  const statusColors = {
    good: 'bg-green-900/20 border-green-500/30 text-green-300',
    warning: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300',
    critical: 'bg-red-900/20 border-red-500/30 text-red-300'
  };

  return (
    <div className={`p-4 rounded-lg border ${statusColors[status]}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
      <div className="text-2xl font-bold">
        {value}
        {unit && <span className="text-sm ml-1 opacity-75">{unit}</span>}
      </div>
      {description && (
        <p className="text-xs mt-2 opacity-75">{description}</p>
      )}
    </div>
  );
};

interface PerformanceDashboardProps {
  className?: string;
  compact?: boolean;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ 
  className = '',
  compact = false 
}) => {
  const { metrics, budgetStatus } = usePerformanceMonitor();
  const [errorHistory, setErrorHistory] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Load error history from sessionStorage
    const loadErrorHistory = () => {
      try {
        const errors = JSON.parse(sessionStorage.getItem('vj-app-errors') || '[]');
        setErrorHistory(errors);
      } catch {
        setErrorHistory([]);
      }
    };

    loadErrorHistory();
    
    // Refresh error history every 5 seconds
    const interval = setInterval(loadErrorHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize WebGPU support check
  useEffect(() => {
    performanceMonitor.measureWebGPUSupport();
  }, []);

  if (!metrics) {
    return (
      <div className={`p-4 bg-gray-900 rounded-lg ${className}`}>
        <p className="text-gray-400">Loading performance metrics...</p>
      </div>
    );
  }

  const getFPSStatus = (fps: number): 'good' | 'warning' | 'critical' => {
    if (fps >= 45) return 'good';
    if (fps >= 30) return 'warning';
    return 'critical';
  };

  const getMemoryStatus = (memory: number): 'good' | 'warning' | 'critical' => {
    const memoryMB = memory / 1024 / 1024;
    if (memoryMB <= 100) return 'good';
    if (memoryMB <= 200) return 'warning';
    return 'critical';
  };

  const getRenderModeColor = (mode?: string) => {
    switch (mode) {
      case 'webgpu': return 'text-green-400';
      case 'webgl': return 'text-yellow-400';
      case 'fallback': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (compact) {
    return (
      <div className={`bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="text-gray-400">FPS:</span>
              <span className={`ml-1 font-mono ${getFPSStatus(metrics.frameRate) === 'good' ? 'text-green-400' : 
                getFPSStatus(metrics.frameRate) === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                {metrics.frameRate || 0}
              </span>
            </div>
            {metrics.renderMode && (
              <div className="text-sm">
                <span className="text-gray-400">Mode:</span>
                <span className={`ml-1 ${getRenderModeColor(metrics.renderMode)}`}>
                  {metrics.renderMode.toUpperCase()}
                </span>
              </div>
            )}
            {metrics.particleCount && (
              <div className="text-sm">
                <span className="text-gray-400">Particles:</span>
                <span className="ml-1 text-blue-400 font-mono">
                  {metrics.particleCount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {isVisible ? 'Hide' : 'Details'}
          </button>
        </div>
        
        {isVisible && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <PerformanceDashboard className="!bg-transparent !border-0 !p-0" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Performance Monitor</h2>
        <div className="flex items-center space-x-2">
          {budgetStatus && (
            <span className={`text-xs px-2 py-1 rounded ${
              budgetStatus.passed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {budgetStatus.passed ? 'Performance Good' : `${budgetStatus.violations.length} Issues`}
            </span>
          )}
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Live monitoring active" />
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Frame Rate"
          value={metrics.frameRate || 0}
          unit="fps"
          status={getFPSStatus(metrics.frameRate || 0)}
          description="Target: >45fps for smooth experience"
        />
        <MetricCard
          title="Memory Usage"
          value={Math.round((metrics.memoryUsage || 0) / 1024 / 1024)}
          unit="MB"
          status={getMemoryStatus(metrics.memoryUsage || 0)}
          description="JavaScript heap memory"
        />
        <MetricCard
          title="Render Mode"
          value={metrics.renderMode?.toUpperCase() || 'UNKNOWN'}
          status={metrics.renderMode === 'webgpu' ? 'good' : metrics.renderMode === 'webgl' ? 'warning' : 'critical'}
          description="Current rendering backend"
        />
        <MetricCard
          title="WebGPU Support"
          value={metrics.webgpuSupported ? 'YES' : 'NO'}
          status={metrics.webgpuSupported ? 'good' : 'warning'}
          description="Browser WebGPU capability"
        />
      </div>

      {/* Performance Details */}
      {(metrics.particleCount || metrics.textureUploadTime || metrics.webgpuInitTime) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Rendering Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {metrics.particleCount && (
              <MetricCard
                title="Particle Count"
                value={metrics.particleCount.toLocaleString()}
                status={metrics.particleCount > 100000 ? 'warning' : 'good'}
              />
            )}
            {metrics.textureUploadTime && (
              <MetricCard
                title="Texture Upload"
                value={metrics.textureUploadTime.toFixed(1)}
                unit="ms"
                status={metrics.textureUploadTime > 50 ? 'warning' : 'good'}
              />
            )}
            {metrics.webgpuInitTime && (
              <MetricCard
                title="WebGPU Init"
                value={metrics.webgpuInitTime.toFixed(1)}
                unit="ms"
                status={metrics.webgpuInitTime > 100 ? 'warning' : 'good'}
              />
            )}
          </div>
        </div>
      )}

      {/* Render Mode Statistics */}
      {metrics.renderModeStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Render Mode Usage</h3>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex space-x-6">
              {Object.entries(metrics.renderModeStats).map(([mode, count]) => (
                <div key={mode} className="text-center">
                  <div className={`text-2xl font-bold ${getRenderModeColor(mode)}`}>
                    {count}
                  </div>
                  <div className="text-xs text-gray-400 uppercase">{mode}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error History */}
      {errorHistory.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Recent Errors</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {errorHistory.slice(-5).reverse().map((error, index) => (
              <div key={index} className="bg-red-900/20 border border-red-500/30 rounded p-3">
                <div className="flex items-center justify-between">
                  <span className="text-red-300 font-medium">{error.errorType}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(error.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-1 truncate">{error.errorMessage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Budget Violations */}
      {budgetStatus && !budgetStatus.passed && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Performance Issues</h3>
          <div className="space-y-2">
            {budgetStatus.violations.map((violation, index) => (
              <div key={index} className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                <p className="text-yellow-300 text-sm">{violation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="text-xs text-gray-500 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>User Agent:</strong>
            <div className="truncate">{metrics.userAgent}</div>
          </div>
          <div>
            <strong>Last Update:</strong>
            <div>{new Date(metrics.timestamp).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;