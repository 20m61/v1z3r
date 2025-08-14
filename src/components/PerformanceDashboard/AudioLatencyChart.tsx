/**
 * Audio Latency Chart Component
 * Real-time audio latency and buffer visualization
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { PerformanceSnapshot } from '@/utils/performanceMonitor/types';

interface AudioLatencyChartProps {
  history: PerformanceSnapshot[];
  width?: number;
  height?: number;
  timeWindow?: number; // seconds
}

export const AudioLatencyChart: React.FC<AudioLatencyChartProps> = ({
  history,
  width = 320,
  height = 120,
  timeWindow = 60, // 1 minute
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawChart = useCallback((): void => {

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get recent data within time window
    const now = Date.now();
    const cutoffTime = now - (timeWindow * 1000);
    const recentData = history
      .filter(entry => entry.timestamp >= cutoffTime)
      .map(entry => ({
        timestamp: entry.timestamp,
        latency: entry.audio.latency || 0,
        underruns: entry.audio.underruns || 0,
        contextState: entry.audio.contextState,
      }));

    if (recentData.length < 2) {
      drawNoDataMessage(ctx);
      return;
    }

    // Calculate max latency for scaling (min 200ms for good scale)
    const maxLatency = Math.max(
      ...recentData.map(d => d.latency),
      200 // At least 200ms for scale
    );

    // Draw grid and labels
    drawGrid(ctx, maxLatency);
    drawLabels(ctx, recentData, maxLatency);

    // Draw latency line
    drawLatencyLine(ctx, recentData, now, cutoffTime, maxLatency);

    // Draw threshold lines
    drawThresholds(ctx, maxLatency);

    // Draw context state indicators
    drawContextStates(ctx, recentData, now, cutoffTime);

    // Draw underrun indicators
    drawUnderrunIndicators(ctx, recentData, now, cutoffTime);

    // Draw current value indicator
    drawCurrentValue(ctx, recentData, maxLatency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, width, height, timeWindow]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const drawGrid = (ctx: CanvasRenderingContext2D, maxLatency: number): void => {
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1;

    // Horizontal grid lines (latency levels)
    const latencyLevels = getLatencyLevels(maxLatency);
    latencyLevels.forEach(latency => {
      const y = height - (latency / maxLatency) * (height - 40) - 20;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    });

    // Vertical grid lines (time intervals)
    const timeIntervals = 6;
    for (let i = 0; i <= timeIntervals; i++) {
      const x = 40 + (i / timeIntervals) * (width - 50);
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, height - 20);
      ctx.stroke();
    }
  };

  const drawLabels = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; latency: number; underruns: number; contextState: string }>,
    maxLatency: number
  ): void => {
    ctx.fillStyle = '#9CA3AF'; // gray-400
    ctx.font = '10px monospace';

    // Latency labels
    const latencyLevels = getLatencyLevels(maxLatency);
    latencyLevels.forEach(latency => {
      const y = height - (latency / maxLatency) * (height - 40) - 20;
      ctx.fillText(`${latency}ms`, 2, y + 3);
    });

    // Time labels
    if (data.length > 0) {
      const oldestTime = data[0].timestamp;
      const newestTime = data[data.length - 1].timestamp;
      
      ctx.fillText(
        formatTimeAgo(newestTime - oldestTime),
        40,
        height - 5
      );
      ctx.fillText('now', width - 25, height - 5);
    }
  };

  const drawLatencyLine = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; latency: number; underruns: number; contextState: string }>,
    now: number,
    cutoffTime: number,
    maxLatency: number
  ): void => {
    if (data.length < 2) return;

    ctx.strokeStyle = '#8B5CF6'; // purple-500
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      const y = height - (Math.min(point.latency, maxLatency) / maxLatency) * (height - 40) - 20;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under the curve
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#8B5CF6';
    ctx.lineTo(40 + (width - 50), height - 20); // Bottom right
    ctx.lineTo(40, height - 20); // Bottom left
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const drawThresholds = (ctx: CanvasRenderingContext2D, maxLatency: number): void => {
    const thresholds = [
      { value: 20, color: '#10B981', label: 'Excellent' }, // green
      { value: 50, color: '#3B82F6', label: 'Good' }, // blue
      { value: 100, color: '#F59E0B', label: 'Warning' }, // yellow
      { value: 200, color: '#EF4444', label: 'Critical' }, // red
    ];

    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    thresholds.forEach(threshold => {
      if (threshold.value <= maxLatency) {
        ctx.strokeStyle = threshold.color;
        const y = height - (threshold.value / maxLatency) * (height - 40) - 20;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 10, y);
        ctx.stroke();
      }
    });

    ctx.setLineDash([]); // Reset dash pattern
  };

  const drawContextStates = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; latency: number; underruns: number; contextState: string }>,
    now: number,
    cutoffTime: number
  ): void => {
    // Draw context state indicators at the top
    data.forEach(point => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      
      let color: string;
      switch (point.contextState) {
        case 'running':
          color = '#10B981'; // green
          break;
        case 'suspended':
          color = '#F59E0B'; // yellow
          break;
        case 'closed':
          color = '#EF4444'; // red
          break;
        default:
          color = '#6B7280'; // gray
      }

      ctx.fillStyle = color;
      ctx.fillRect(x - 1, 5, 2, 10);
    });

    // Legend for context states
    ctx.font = '8px monospace';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Context State:', width - 80, 12);
  };

  const drawUnderrunIndicators = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; latency: number; underruns: number; contextState: string }>,
    now: number,
    cutoffTime: number
  ): void => {
    // Draw underrun spikes as red marks
    data.forEach((point, index) => {
      if (point.underruns > 0) {
        const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
        
        ctx.strokeStyle = '#EF4444'; // red
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, height - 20);
        ctx.lineTo(x, height - 35);
        ctx.stroke();

        // Draw underrun count if significant
        if (point.underruns > 1) {
          ctx.fillStyle = '#EF4444';
          ctx.font = '8px monospace';
          ctx.fillText(point.underruns.toString(), x - 3, height - 37);
        }
      }
    });
  };

  const drawCurrentValue = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; latency: number; underruns: number; contextState: string }>,
    maxLatency: number
  ): void => {
    if (data.length === 0) return;

    const current = data[data.length - 1];
    const currentY = height - (Math.min(current.latency, maxLatency) / maxLatency) * (height - 40) - 20;

    // Draw current value dot
    ctx.fillStyle = '#8B5CF6';
    ctx.beginPath();
    ctx.arc(width - 10, currentY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw current value text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      `${current.latency.toFixed(1)}ms`,
      width - 55,
      currentY - 10
    );
  };

  const drawNoDataMessage = (ctx: CanvasRenderingContext2D): void => {
    ctx.fillStyle = '#6B7280'; // gray-500
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'No audio data available',
      width / 2,
      height / 2
    );
    ctx.textAlign = 'left';
  };

  const getLatencyLevels = (maxLatency: number): number[] => {
    if (maxLatency <= 100) {
      return [0, 20, 40, 60, 80, 100];
    } else if (maxLatency <= 200) {
      return [0, 50, 100, 150, 200];
    } else if (maxLatency <= 500) {
      return [0, 100, 200, 300, 400, 500];
    } else {
      const step = Math.ceil(maxLatency / 5 / 50) * 50;
      return [0, step, step * 2, step * 3, step * 4, step * 5];
    }
  };

  const formatTimeAgo = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getCurrentAudio = (): { latency: number; underruns: number; contextState: string } => {
    if (history.length === 0) {
      return { latency: 0, underruns: 0, contextState: 'suspended' };
    }
    const latest = history[history.length - 1];
    return {
      latency: latest.audio.latency || 0,
      underruns: latest.audio.underruns || 0,
      contextState: latest.audio.contextState,
    };
  };

  const getAverageLatency = (): number => {
    if (history.length === 0) return 0;
    const latencyValues = history.map(entry => entry.audio.latency || 0);
    return latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length;
  };

  const getTotalUnderruns = (): number => {
    if (history.length === 0) return 0;
    return Math.max(...history.map(entry => entry.audio.underruns || 0));
  };

  const getLatencyGrade = (): { grade: string; color: string } => {
    const avgLatency = getAverageLatency();
    if (avgLatency <= 20) return { grade: 'Excellent', color: 'text-green-400' };
    if (avgLatency <= 50) return { grade: 'Good', color: 'text-blue-400' };
    if (avgLatency <= 100) return { grade: 'Fair', color: 'text-yellow-400' };
    return { grade: 'Poor', color: 'text-red-400' };
  };

  const getContextStability = (): number => {
    if (history.length === 0) return 0;
    const runningCount = history.filter(entry => entry.audio.contextState === 'running').length;
    return (runningCount / history.length) * 100;
  };

  const current = getCurrentAudio();
  const latencyGrade = getLatencyGrade();
  const contextStability = getContextStability();

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-semibold text-white">Audio Latency</h4>
          <span className={`text-xs px-2 py-1 rounded ${latencyGrade.color} bg-opacity-20`}>
            {latencyGrade.grade}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {current.latency.toFixed(1)}ms
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-800 rounded p-2">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto"
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        {/* Context State Legend */}
        <div className="flex items-center justify-center space-x-4 mt-2 text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded"></div>
            <span>Running</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-500 rounded"></div>
            <span>Suspended</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded"></div>
            <span>Closed</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-400">
        <div>
          <span className="text-gray-500">Avg:</span>{' '}
          <span className="text-white">{getAverageLatency().toFixed(1)}ms</span>
        </div>
        <div>
          <span className="text-gray-500">Underruns:</span>{' '}
          <span className={getTotalUnderruns() > 5 ? 'text-red-400' : 'text-white'}>
            {getTotalUnderruns()}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Stability:</span>{' '}
          <span className={contextStability > 80 ? 'text-green-400' : 'text-yellow-400'}>
            {contextStability.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Audio Context Status */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Audio Context:</span>
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${
            current.contextState === 'running' ? 'bg-green-500' :
            current.contextState === 'suspended' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-white capitalize">{current.contextState}</span>
        </div>
      </div>
    </div>
  );
};