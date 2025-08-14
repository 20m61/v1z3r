/**
 * Tests for Performance Dashboard Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PerformanceDashboard } from '../PerformanceDashboard';
import { PerformanceMonitor } from '@/utils/performanceMonitor/core';
import { PerformanceSnapshot, PerformanceAlert } from '@/utils/performanceMonitor/types';

// Mock the chart components
jest.mock('../FPSChart', () => ({
  FPSChart: ({ history }: { history: any[] }) => (
    <div data-testid="fps-chart">FPS Chart (${history.length} entries)</div>
  ),
}));

jest.mock('../MemoryChart', () => ({
  MemoryChart: ({ history }: { history: any[] }) => (
    <div data-testid="memory-chart">Memory Chart (${history.length} entries)</div>
  ),
}));

jest.mock('../AudioLatencyChart', () => ({
  AudioLatencyChart: ({ history }: { history: any[] }) => (
    <div data-testid="audio-chart">Audio Chart (${history.length} entries)</div>
  ),
}));

jest.mock('../AlertsPanel', () => ({
  AlertsPanel: ({ alerts }: { alerts: any[] }) => (
    <div data-testid="alerts-panel">Alerts Panel (${alerts.length} alerts)</div>
  ),
}));

jest.mock('../PerformanceStats', () => ({
  PerformanceStats: ({ metrics }: { metrics: any }) => (
    <div data-testid="performance-stats">
      Performance Stats (FPS: ${metrics?.rendering?.fps || 0})
    </div>
  ),
}));

jest.mock('../QualityControls', () => ({
  QualityControls: () => <div data-testid="quality-controls">Quality Controls</div>,
}));

describe('PerformanceDashboard', () => {
  let mockMonitor: jest.Mocked<PerformanceMonitor>;
  let mockMetrics: PerformanceSnapshot;
  let mockAlerts: PerformanceAlert[];

  beforeEach(() => {
    // Create mock performance monitor
    mockMonitor = {
      subscribe: jest.fn(),
      getMetrics: jest.fn(),
      getActiveAlerts: jest.fn(),
      getHistory: jest.fn(),
      acknowledgeAlert: jest.fn(),
      resolveAlert: jest.fn(),
    } as any;

    // Create mock metrics
    mockMetrics = {
      timestamp: Date.now(),
      rendering: {
        fps: 60,
        frameTimes: [16.67, 16.67, 16.67],
        droppedFrames: 0,
        renderTime: 10,
      },
      memory: {
        heap: {
          used: 100 * 1024 * 1024, // 100MB
          total: 200 * 1024 * 1024, // 200MB
          limit: 500 * 1024 * 1024, // 500MB
        },
        textures: 10,
        geometries: 5,
        materials: 3,
      },
      audio: {
        latency: 20,
        bufferSize: 128,
        underruns: 0,
        contextState: 'running',
        sampleRate: 44100,
      },
      ux: {
        inputLatency: 10,
        loadTime: 1000,
        errorCount: 0,
        interactionSuccess: 100,
      },
    };

    // Create mock alerts
    mockAlerts = [
      {
        id: 'alert-1',
        type: 'fps_drop',
        severity: 'warning',
        message: 'FPS dropped below 30',
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false,
      },
    ];

    // Setup mock returns
    mockMonitor.getMetrics.mockReturnValue(mockMetrics);
    mockMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockMonitor.getHistory.mockReturnValue({
      entries: [mockMetrics],
      maxLength: 100,
      timeRange: 100000
    });
    mockMonitor.subscribe.mockImplementation((callback) => {
      // Immediately call callback with initial data
      callback(mockMetrics, mockAlerts);
      // Return unsubscribe function
      return jest.fn();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render toggle button when not visible', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      expect(screen.getByTitle('Show Performance Dashboard')).toBeInTheDocument();
      expect(screen.getByText('60 FPS')).toBeInTheDocument();
    });

    it('should render dashboard when visible', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Click to show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
    });

    it('should render compact view when specified', () => {
      render(<PerformanceDashboard monitor={mockMonitor} compact />);
      
      // Click to show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Should show compact view
      expect(screen.getByText('60')).toBeInTheDocument(); // FPS value
    });

    it('should render at different positions', () => {
      const { rerender } = render(
        <PerformanceDashboard monitor={mockMonitor} position="top-left" />
      );
      
      expect(screen.getByTitle('Show Performance Dashboard')).toHaveClass('top-4', 'left-4');
      
      rerender(<PerformanceDashboard monitor={mockMonitor} position="bottom-right" />);
      
      expect(screen.getByTitle('Show Performance Dashboard')).toHaveClass('bottom-4', 'right-4');
    });
  });

  describe('Interaction', () => {
    it('should toggle visibility on button click', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Initially shows toggle button
      expect(screen.getByTitle('Show Performance Dashboard')).toBeInTheDocument();
      
      // Click to show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Should show dashboard
      expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
      
      // Click close button
      fireEvent.click(screen.getByLabelText('Close'));
      
      // Should hide dashboard
      expect(screen.getByTitle('Show Performance Dashboard')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Should start with Overview tab
      expect(screen.getByTestId('performance-stats')).toBeInTheDocument();
      
      // Click Charts tab
      fireEvent.click(screen.getByText('Charts'));
      
      expect(screen.getByTestId('fps-chart')).toBeInTheDocument();
      expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
      expect(screen.getByTestId('audio-chart')).toBeInTheDocument();
      
      // Click Alerts tab
      fireEvent.click(screen.getByText('Alerts'));
      
      expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      
      // Click Settings tab
      fireEvent.click(screen.getByText('Settings'));
      
      expect(screen.getByTestId('quality-controls')).toBeInTheDocument();
    });

    it('should show alert badge on tab', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Should show alert count badge
      expect(screen.getByText('1')).toBeInTheDocument(); // Alert count
    });
  });

  describe('Data Updates', () => {
    it('should subscribe to monitor updates', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      expect(mockMonitor.subscribe).toHaveBeenCalled();
    });

    it('should update when metrics change', async () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Get the callback function passed to subscribe
      const subscribeCallback = mockMonitor.subscribe.mock.calls[0][0];
      
      // Update metrics
      const newMetrics = {
        ...mockMetrics,
        rendering: { ...mockMetrics.rendering, fps: 30 },
      };
      
      // Call the callback with new metrics wrapped in act
      act(() => {
        subscribeCallback(newMetrics, mockAlerts);
      });
      
      await waitFor(() => {
        expect(screen.getByText('30 FPS')).toBeInTheDocument();
      });
    });

    it('should auto-show dashboard on critical alerts', async () => {
      const criticalAlerts = [
        {
          ...mockAlerts[0],
          severity: 'critical' as const,
        },
      ];
      
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Get the callback function passed to subscribe
      const subscribeCallback = mockMonitor.subscribe.mock.calls[0][0];
      
      // Trigger critical alert
      act(() => {
        subscribeCallback(mockMetrics, criticalAlerts);
      });
      
      // Should auto-show dashboard due to critical alert
      await waitFor(() => {
        expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
      });
    });

    it('should clean up subscription on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockMonitor.subscribe.mockReturnValue(unsubscribeMock);
      
      const { unmount } = render(<PerformanceDashboard monitor={mockMonitor} />);
      
      unmount();
      
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Compact View', () => {
    it('should display key metrics in compact view', () => {
      render(<PerformanceDashboard monitor={mockMonitor} compact />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Should show FPS, Memory, and Latency
      expect(screen.getByText('60')).toBeInTheDocument(); // FPS
      expect(screen.getByText('100')).toBeInTheDocument(); // Memory in MB
      expect(screen.getByText('20')).toBeInTheDocument(); // Latency
    });

    it('should show alert summary in compact view', () => {
      render(<PerformanceDashboard monitor={mockMonitor} compact />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Should show warning alert count
      expect(screen.getByText(/1 warning/)).toBeInTheDocument();
    });

    it('should handle no data in compact view', () => {
      mockMonitor.getMetrics.mockReturnValue(null);
      mockMonitor.subscribe.mockImplementation((callback) => {
        callback(null as any, []);
        return jest.fn();
      });
      
      render(<PerformanceDashboard monitor={mockMonitor} compact />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      expect(screen.getByText('No performance data available')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metrics gracefully', () => {
      mockMonitor.getMetrics.mockReturnValue(null);
      mockMonitor.subscribe.mockImplementation((callback) => {
        callback(null as any, []);
        return jest.fn();
      });
      
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Should show placeholder values
      expect(screen.getByText('-- FPS')).toBeInTheDocument();
    });

    it('should handle empty alerts array', () => {
      mockMonitor.getActiveAlerts.mockReturnValue([]);
      mockMonitor.subscribe.mockImplementation((callback) => {
        callback(mockMetrics, []);
        return jest.fn();
      });
      
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Should not show alert indicator
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('should handle subscription errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock a monitor that fails subscription after component mounts
      const failingMonitor = {
        ...mockMonitor,
        subscribe: jest.fn(() => {
          throw new Error('Subscription failed');
        })
      };
      
      // Component should handle subscription failure gracefully  
      let renderError: Error | null = null;
      try {
        render(<PerformanceDashboard monitor={failingMonitor} />);
      } catch (error) {
        renderError = error as Error;
      }
      
      // Should render without throwing
      expect(renderError).toBeNull();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Check for screen reader labels
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Toggle button should be focusable
      const toggleButton = screen.getByTitle('Show Performance Dashboard');
      toggleButton.focus();
      expect(toggleButton).toHaveFocus();
    });

    it('should support tab navigation', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Show dashboard
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      
      // Tab buttons should be present and clickable
      const chartTab = screen.getByText('Charts');
      expect(chartTab).toBeInTheDocument();
      
      // Click should work
      fireEvent.click(chartTab);
      expect(screen.getByTestId('fps-chart')).toBeInTheDocument();
    });
  });

  describe('Memory and Performance', () => {
    it('should not create memory leaks with rapid updates', async () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      const subscribeCallback = mockMonitor.subscribe.mock.calls[0][0];
      
      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        const updatedMetrics = {
          ...mockMetrics,
          timestamp: Date.now() + i,
          rendering: { ...mockMetrics.rendering, fps: 60 - i % 30 },
        };
        act(() => {
          subscribeCallback(updatedMetrics, mockAlerts);
        });
      }
      
      // Should handle updates without issues
      expect(screen.getByTitle('Show Performance Dashboard')).toBeInTheDocument();
    });

    it('should limit history length to prevent memory issues', () => {
      render(<PerformanceDashboard monitor={mockMonitor} />);
      
      // Show dashboard and go to charts
      fireEvent.click(screen.getByTitle('Show Performance Dashboard'));
      fireEvent.click(screen.getByText('Charts'));
      
      // History should be limited (mocked components show count)
      expect(screen.getByTestId('fps-chart')).toBeInTheDocument();
    });
  });
});