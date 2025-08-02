/**
 * Performance Monitor System
 * Export all performance monitoring components
 */

// Core system
export { PerformanceMonitor } from './core';
export { AdaptiveQualityManager } from './adaptiveQuality';

// Types
export type {
  PerformanceSnapshot,
  PerformanceAlert,
  PerformanceHistory,
  PerformanceMonitorConfig,
  MetricCollector,
  QualityProfile,
  DeviceTier,
  DeviceCapabilities,
  AlertRule,
  MetricsCallback,
  RenderingMetrics,
  MemoryMetrics,
  AudioMetrics,
  MobileMetrics,
  GPUMemoryInfo,
} from './types';

export {
  DEFAULT_CONFIG,
  QUALITY_PROFILES,
  DEFAULT_ALERT_RULES,
} from './types';

// Collectors
export { RenderingCollector } from './collectors/renderingCollector';
export { MemoryCollector } from './collectors/memoryCollector';
export { AudioCollector } from './collectors/audioCollector';
export { MobileCollector } from './collectors/mobileCollector';

// Legacy exports for backward compatibility
export { performanceMonitor, usePerformanceMonitor } from '../performanceMonitorLegacy';