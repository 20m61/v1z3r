/**
 * Memory Chart Component
 * Real-time memory usage visualization
 */

import React, { useRef, useEffect } from 'react';
import { PerformanceSnapshot } from '@/utils/performanceMonitor/types';

interface MemoryChartProps {
  history: PerformanceSnapshot[];
  width?: number;
  height?: number;
  timeWindow?: number; // seconds
}

export const MemoryChart: React.FC<MemoryChartProps> = ({
  history,
  width = 320,
  height = 120,
  timeWindow = 60, // 1 minute
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawChart();
  }, [history, width, height]);

  const drawChart = (): void => {
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
        heapUsed: entry.memory.heap.used || 0,
        heapTotal: entry.memory.heap.total || 0,
        heapLimit: entry.memory.heap.limit || 0,
      }));

    if (recentData.length < 2) {
      drawNoDataMessage(ctx);
      return;
    }

    // Calculate max memory for scaling
    const maxMemory = Math.max(
      ...recentData.map(d => Math.max(d.heapUsed, d.heapTotal)),
      512 * 1024 * 1024 // At least 512MB for scale
    );

    // Draw grid and labels
    drawGrid(ctx, maxMemory);
    drawLabels(ctx, recentData, maxMemory);

    // Draw memory usage areas
    drawMemoryAreas(ctx, recentData, now, cutoffTime, maxMemory);

    // Draw current value indicator
    drawCurrentValue(ctx, recentData, maxMemory);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, maxMemory: number): void => {
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1;

    // Horizontal grid lines (memory levels)
    const memoryLevels = getMemoryLevels(maxMemory);
    memoryLevels.forEach(memory => {
      const y = height - (memory / maxMemory) * (height - 40) - 20;
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
    data: Array<{ timestamp: number; heapUsed: number; heapTotal: number; heapLimit: number }>,
    maxMemory: number
  ): void => {
    ctx.fillStyle = '#9CA3AF'; // gray-400
    ctx.font = '10px monospace';

    // Memory labels
    const memoryLevels = getMemoryLevels(maxMemory);
    memoryLevels.forEach(memory => {
      const y = height - (memory / maxMemory) * (height - 40) - 20;
      ctx.fillText(formatMemory(memory), 2, y + 3);
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

  const drawMemoryAreas = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; heapUsed: number; heapTotal: number; heapLimit: number }>,
    now: number,
    cutoffTime: number,
    maxMemory: number
  ): void => {
    if (data.length < 2) return;

    // Draw heap total area (background)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; // blue with transparency
    ctx.beginPath();
    ctx.moveTo(40, height - 20);

    data.forEach(point => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      const y = height - (point.heapTotal / maxMemory) * (height - 40) - 20;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(40 + (width - 50), height - 20);
    ctx.closePath();
    ctx.fill();

    // Draw heap used area (foreground)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'; // green with transparency
    ctx.beginPath();
    ctx.moveTo(40, height - 20);

    data.forEach(point => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      const y = height - (point.heapUsed / maxMemory) * (height - 40) - 20;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(40 + (width - 50), height - 20);
    ctx.closePath();
    ctx.fill();

    // Draw heap used line
    ctx.strokeStyle = '#10B981'; // green-500
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      const y = height - (point.heapUsed / maxMemory) * (height - 40) - 20;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw heap total line
    ctx.strokeStyle = '#3B82F6'; // blue-500
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      const y = height - (point.heapTotal / maxMemory) * (height - 40) - 20;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
    ctx.setLineDash([]); // Reset dash pattern

    // Draw memory pressure warning line (80% of limit)
    if (data.length > 0 && data[0].heapLimit > 0) {
      const warningLevel = data[0].heapLimit * 0.8;
      if (warningLevel <= maxMemory) {
        ctx.strokeStyle = '#F59E0B'; // yellow-500
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const warningY = height - (warningLevel / maxMemory) * (height - 40) - 20;
        ctx.beginPath();
        ctx.moveTo(40, warningY);
        ctx.lineTo(width - 10, warningY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const drawCurrentValue = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; heapUsed: number; heapTotal: number; heapLimit: number }>,
    maxMemory: number
  ): void => {
    if (data.length === 0) return;

    const current = data[data.length - 1];
    const currentY = height - (current.heapUsed / maxMemory) * (height - 40) - 20;

    // Draw current value dot
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(width - 10, currentY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw current value text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      formatMemory(current.heapUsed),
      width - 70,
      currentY - 10
    );
  };

  const drawNoDataMessage = (ctx: CanvasRenderingContext2D): void => {
    ctx.fillStyle = '#6B7280'; // gray-500
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'No memory data available',
      width / 2,
      height / 2
    );
    ctx.textAlign = 'left';
  };

  const getMemoryLevels = (maxMemory: number): number[] => {
    const mb = 1024 * 1024;
    const maxMB = maxMemory / mb;

    if (maxMB <= 128) {
      return [0, 32 * mb, 64 * mb, 96 * mb, 128 * mb];
    } else if (maxMB <= 512) {
      return [0, 128 * mb, 256 * mb, 384 * mb, 512 * mb];
    } else if (maxMB <= 1024) {
      return [0, 256 * mb, 512 * mb, 768 * mb, 1024 * mb];
    } else {
      const step = Math.ceil(maxMB / 4 / 256) * 256 * mb;
      return [0, step, step * 2, step * 3, step * 4];
    }
  };

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(0)}MB`;
  };

  const formatTimeAgo = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getCurrentMemory = (): { used: number; total: number; limit: number } => {
    if (history.length === 0) {
      return { used: 0, total: 0, limit: 0 };
    }
    const latest = history[history.length - 1];
    return {
      used: latest.memory.heap.used || 0,
      total: latest.memory.heap.total || 0,
      limit: latest.memory.heap.limit || 0,
    };
  };

  const getMemoryUsagePercent = (): number => {
    const current = getCurrentMemory();
    if (current.limit <= 0) return 0;
    return (current.used / current.limit) * 100;
  };

  const getMemoryPressureGrade = (): { grade: string; color: string } => {
    const percent = getMemoryUsagePercent();
    if (percent < 50) return { grade: 'Low', color: 'text-green-400' };
    if (percent < 75) return { grade: 'Medium', color: 'text-yellow-400' };
    if (percent < 90) return { grade: 'High', color: 'text-orange-400' };
    return { grade: 'Critical', color: 'text-red-400' };
  };

  const getAverageMemoryUsage = (): number => {
    if (history.length === 0) return 0;
    const memoryValues = history.map(entry => entry.memory.heap.used || 0);
    return memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
  };

  const current = getCurrentMemory();
  const pressureGrade = getMemoryPressureGrade();
  const usagePercent = getMemoryUsagePercent();

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-semibold text-white">Memory Usage</h4>
          <span className={`text-xs px-2 py-1 rounded ${pressureGrade.color} bg-opacity-20`}>
            {pressureGrade.grade}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {formatMemory(current.used)}
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
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-400">
        <div>
          <span className="text-gray-500">Used:</span>{' '}
          <span className="text-white">{formatMemory(current.used)}</span>
        </div>
        <div>
          <span className="text-gray-500">Total:</span>{' '}
          <span className="text-blue-400">{formatMemory(current.total)}</span>
        </div>
        <div>
          <span className="text-gray-500">Usage:</span>{' '}
          <span className={pressureGrade.color}>{usagePercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Memory Pressure Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Memory Pressure</span>
          <span>{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              usagePercent < 50
                ? 'bg-green-500'
                : usagePercent < 75
                ? 'bg-yellow-500'
                : usagePercent < 90
                ? 'bg-orange-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
      </div>
    </div>
  );
};