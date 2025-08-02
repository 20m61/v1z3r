/**
 * Mock for WebGPU Performance Monitor
 */

export const getWebGPUPerformanceMonitor = () => {
  return {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      memory: { used: 100, total: 200 },
      renderTime: 16.67,
    })),
  };
};

export default { getWebGPUPerformanceMonitor };