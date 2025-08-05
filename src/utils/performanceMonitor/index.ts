/**
 * Performance Monitor System
 * Export all performance monitoring components
 */

// Core system - re-export everything
export * from './core';
export * from './adaptiveQuality';
export * from './types';

// Collectors
export * from './collectors/renderingCollector';
export * from './collectors/memoryCollector';
export * from './collectors/audioCollector';
export * from './collectors/mobileCollector';

// Backward compatibility exports
import { PerformanceMonitor } from './core';
// Create singleton instance
const monitorInstance = new PerformanceMonitor();
export const performanceMonitor = monitorInstance;
export { PerformanceMonitor };

// React hook for performance monitoring
import { useEffect, useState } from 'react';
import type { PerformanceSnapshot } from './types';

export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceSnapshot | null>(null);

  useEffect(() => {
    // Get initial metrics
    setMetrics(performanceMonitor.getMetrics());
    
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return metrics || {
    timestamp: Date.now(),
    fps: { current: 60, average: 60, min: 60, max: 60 },
    memory: { used: 0, total: 0, percentage: 0 },
    renderModeStats: {},
    gpu: { utilization: 0, temperature: 0 },
    network: { latency: 0, throughput: 0 },
    cpu: { usage: 0, cores: navigator.hardwareConcurrency || 4 }
  };
}