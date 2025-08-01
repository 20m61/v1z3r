/**
 * Performance Stats Component
 * Overview of key performance metrics and system health
 */

import React from 'react';
import { PerformanceSnapshot } from '@/utils/performanceMonitor/types';
import { PerformanceMonitor } from '@/utils/performanceMonitor/core';

interface PerformanceStatsProps {
  metrics: PerformanceSnapshot | null;
  monitor: PerformanceMonitor;
}

export const PerformanceStats: React.FC<PerformanceStatsProps> = ({ metrics, monitor }) => {
  if (!metrics) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">📊</div>
        <div className="text-gray-400 text-sm">Loading performance data...</div>
      </div>
    );
  }

  const summary = monitor.getPerformanceSummary();
  
  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(0)}MB`;
  };

  const getPerformanceGrade = (): { grade: string; color: string; emoji: string } => {
    const avgFPS = summary.avgFps;
    const memoryUsage = metrics.memory.heap.used / metrics.memory.heap.limit;
    const audioLatency = metrics.audio.latency;

    // Calculate overall score (0-100)
    let score = 100;
    
    // FPS scoring (40% weight)
    if (avgFPS < 20) score -= 40;
    else if (avgFPS < 30) score -= 30;
    else if (avgFPS < 45) score -= 20;
    else if (avgFPS < 55) score -= 10;

    // Memory scoring (30% weight)
    if (memoryUsage > 0.9) score -= 30;
    else if (memoryUsage > 0.8) score -= 20;
    else if (memoryUsage > 0.7) score -= 10;
    else if (memoryUsage > 0.6) score -= 5;

    // Audio latency scoring (20% weight)
    if (audioLatency > 200) score -= 20;
    else if (audioLatency > 100) score -= 15;
    else if (audioLatency > 50) score -= 10;
    else if (audioLatency > 20) score -= 5;

    // Alert count scoring (10% weight)
    if (summary.alertCount > 5) score -= 10;
    else if (summary.alertCount > 2) score -= 5;
    else if (summary.alertCount > 0) score -= 2;

    if (score >= 90) return { grade: 'Excellent', color: 'text-green-400', emoji: '🟢' };
    if (score >= 75) return { grade: 'Good', color: 'text-blue-400', emoji: '🔵' };
    if (score >= 60) return { grade: 'Fair', color: 'text-yellow-400', emoji: '🟡' };
    if (score >= 40) return { grade: 'Poor', color: 'text-orange-400', emoji: '🟠' };
    return { grade: 'Critical', color: 'text-red-400', emoji: '🔴' };
  };

  const performance = getPerformanceGrade();

  const getSystemHealth = (): { health: string; color: string; percentage: number } => {
    const issues = [];
    
    if (summary.avgFps < 30) issues.push('Low FPS');
    if (metrics.memory.heap.used / metrics.memory.heap.limit > 0.8) issues.push('High Memory');
    if (metrics.audio.latency > 100) issues.push('High Latency');
    if (metrics.audio.contextState !== 'running') issues.push('Audio Issues');
    if (summary.alertCount > 0) issues.push('Active Alerts');

    const healthPercentage = Math.max(0, 100 - (issues.length * 20));
    
    if (healthPercentage >= 90) return { health: 'Optimal', color: 'text-green-400', percentage: healthPercentage };
    if (healthPercentage >= 70) return { health: 'Good', color: 'text-blue-400', percentage: healthPercentage };
    if (healthPercentage >= 50) return { health: 'Degraded', color: 'text-yellow-400', percentage: healthPercentage };
    return { health: 'Critical', color: 'text-red-400', percentage: healthPercentage };
  };

  const systemHealth = getSystemHealth();

  const getDeviceInfo = (): { platform: string; cores: number; memory?: string } => {
    const platform = navigator.platform || 'Unknown';
    const cores = navigator.hardwareConcurrency || 1;
    const memory = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory}GB` : undefined;
    
    return { platform, cores, memory };
  };

  const deviceInfo = getDeviceInfo();

  return (
    <div className="space-y-4">
      {/* Overall Performance Grade */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">System Performance</h4>
          <div className="flex items-center space-x-1">
            <span className="text-lg">{performance.emoji}</span>
            <span className={`text-sm font-medium ${performance.color}`}>
              {performance.grade}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Avg FPS:</span>
              <span className={`font-mono ${summary.avgFps >= 45 ? 'text-green-400' : summary.avgFps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                {summary.avgFps.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min FPS:</span>
              <span className="text-white font-mono">{summary.minFps.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max FPS:</span>
              <span className="text-white font-mono">{summary.maxFps.toFixed(1)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Memory:</span>
              <span className="text-white font-mono">{formatMemory(summary.avgMemory)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Latency:</span>
              <span className={`font-mono ${summary.avgLatency <= 50 ? 'text-green-400' : summary.avgLatency <= 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                {summary.avgLatency.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Alerts:</span>
              <span className={`font-mono ${summary.alertCount === 0 ? 'text-green-400' : summary.alertCount <= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                {summary.alertCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">System Health</h4>
          <span className={`text-sm font-medium ${systemHealth.color}`}>
            {systemHealth.health}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Health Score</span>
            <span className="text-white">{systemHealth.percentage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                systemHealth.percentage >= 90
                  ? 'bg-green-500'
                  : systemHealth.percentage >= 70
                  ? 'bg-blue-500'
                  : systemHealth.percentage >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${systemHealth.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current Metrics */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Current Metrics</h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Frame Rate:</span>
              <span className="text-white font-mono">{metrics.rendering.fps.toFixed(1)} FPS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Render Time:</span>
              <span className="text-white font-mono">{metrics.rendering.renderTime.toFixed(1)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Dropped Frames:</span>
              <span className={`font-mono ${metrics.rendering.droppedFrames > 10 ? 'text-red-400' : metrics.rendering.droppedFrames > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {metrics.rendering.droppedFrames}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Heap Used:</span>
              <span className="text-white font-mono">{formatMemory(metrics.memory.heap.used)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Audio State:</span>
              <span className={`font-mono capitalize ${metrics.audio.contextState === 'running' ? 'text-green-400' : 'text-yellow-400'}`}>
                {metrics.audio.contextState}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Buffer Underruns:</span>
              <span className={`font-mono ${metrics.audio.underruns > 5 ? 'text-red-400' : metrics.audio.underruns > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {metrics.audio.underruns}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Information */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Device Information</h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Platform:</span>
            <span className="text-white font-mono">{deviceInfo.platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">CPU Cores:</span>
            <span className="text-white font-mono">{deviceInfo.cores}</span>
          </div>
          {deviceInfo.memory && (
            <div className="flex justify-between">
              <span className="text-gray-400">Device Memory:</span>
              <span className="text-white font-mono">{deviceInfo.memory}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Sample Rate:</span>
            <span className="text-white font-mono">{metrics.audio.sampleRate}Hz</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Resources:</span>
            <span className="text-white font-mono">
              T:{metrics.memory.textures} G:{metrics.memory.geometries} M:{metrics.memory.materials}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Metrics (if available) */}
      {metrics.mobile && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Mobile Metrics</h4>
          
          <div className="space-y-2 text-sm">
            {metrics.mobile.battery && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Battery:</span>
                  <span className={`font-mono ${metrics.mobile.battery.level < 20 ? 'text-red-400' : metrics.mobile.battery.level < 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {metrics.mobile.battery.level}% {metrics.mobile.battery.charging ? '⚡' : '🔋'}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Touch Latency:</span>
              <span className={`font-mono ${metrics.mobile.touchLatency > 50 ? 'text-red-400' : metrics.mobile.touchLatency > 25 ? 'text-yellow-400' : 'text-green-400'}`}>
                {metrics.mobile.touchLatency.toFixed(0)}ms
              </span>
            </div>
            {metrics.mobile.network && (
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <span className="text-white font-mono uppercase">{metrics.mobile.network.type}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Device Motion:</span>
              <span className={`font-mono ${metrics.mobile.deviceMotion ? 'text-green-400' : 'text-gray-400'}`}>
                {metrics.mobile.deviceMotion ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};