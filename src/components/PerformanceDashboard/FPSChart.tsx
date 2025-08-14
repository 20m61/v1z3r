/**
 * FPS Chart Component
 * Real-time FPS visualization using HTML5 Canvas
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { PerformanceSnapshot } from '@/utils/performanceMonitor/types';

interface FPSChartProps {
  history: PerformanceSnapshot[];
  width?: number;
  height?: number;
  timeWindow?: number; // seconds
}

export const FPSChart: React.FC<FPSChartProps> = ({
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
        fps: entry.rendering.fps || 0,
      }));

    if (recentData.length < 2) {
      drawNoDataMessage(ctx);
      return;
    }

    // Draw grid and labels
    drawGrid(ctx);
    drawLabels(ctx, recentData);

    // Draw FPS line
    drawFPSLine(ctx, recentData, now, cutoffTime);

    // Draw threshold lines
    drawThresholds(ctx);

    // Draw current value indicator
    drawCurrentValue(ctx, recentData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, width, height, timeWindow]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const drawGrid = (ctx: CanvasRenderingContext2D): void => {
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1;

    // Horizontal grid lines (FPS levels)
    const fpsLevels = [0, 15, 30, 45, 60];
    fpsLevels.forEach(fps => {
      const y = height - (fps / 60) * (height - 40) - 20;
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

  const drawLabels = (ctx: CanvasRenderingContext2D, data: Array<{ timestamp: number; fps: number }>): void => {
    ctx.fillStyle = '#9CA3AF'; // gray-400
    ctx.font = '10px monospace';

    // FPS labels
    const fpsLevels = [0, 15, 30, 45, 60];
    fpsLevels.forEach(fps => {
      const y = height - (fps / 60) * (height - 40) - 20;
      ctx.fillText(fps.toString(), 5, y + 3);
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

  const drawFPSLine = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; fps: number }>,
    now: number,
    cutoffTime: number
  ): void => {
    if (data.length < 2) return;

    ctx.strokeStyle = '#10B981'; // green-500
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = 40 + ((point.timestamp - cutoffTime) / (now - cutoffTime)) * (width - 50);
      const y = height - (Math.min(point.fps, 60) / 60) * (height - 40) - 20;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under the curve
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#10B981';
    ctx.lineTo(40 + (width - 50), height - 20); // Bottom right
    ctx.lineTo(40, height - 20); // Bottom left
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const drawThresholds = (ctx: CanvasRenderingContext2D): void => {
    // 60 FPS target line
    ctx.strokeStyle = '#3B82F6'; // blue-500
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const targetY = height - (60 / 60) * (height - 40) - 20;
    ctx.beginPath();
    ctx.moveTo(40, targetY);
    ctx.lineTo(width - 10, targetY);
    ctx.stroke();

    // 30 FPS warning line
    ctx.strokeStyle = '#F59E0B'; // yellow-500
    const warningY = height - (30 / 60) * (height - 40) - 20;
    ctx.beginPath();
    ctx.moveTo(40, warningY);
    ctx.lineTo(width - 10, warningY);
    ctx.stroke();

    ctx.setLineDash([]); // Reset dash pattern
  };

  const drawCurrentValue = (
    ctx: CanvasRenderingContext2D,
    data: Array<{ timestamp: number; fps: number }>
  ): void => {
    if (data.length === 0) return;

    const currentFPS = data[data.length - 1].fps;
    const currentY = height - (Math.min(currentFPS, 60) / 60) * (height - 40) - 20;

    // Draw current value dot
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(width - 10, currentY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw current value text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(
      `${currentFPS.toFixed(1)} FPS`,
      width - 80,
      currentY - 10
    );
  };

  const drawNoDataMessage = (ctx: CanvasRenderingContext2D): void => {
    ctx.fillStyle = '#6B7280'; // gray-500
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'No FPS data available',
      width / 2,
      height / 2
    );
    ctx.textAlign = 'left';
  };

  const formatTimeAgo = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getCurrentFPS = (): number => {
    if (history.length === 0) return 0;
    return history[history.length - 1].rendering.fps || 0;
  };

  const getAverageFPS = (): number => {
    if (history.length === 0) return 0;
    const fpsValues = history.map(entry => entry.rendering.fps || 0).filter(fps => fps > 0);
    return fpsValues.length > 0 ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length : 0;
  };

  const getMinFPS = (): number => {
    if (history.length === 0) return 0;
    const fpsValues = history.map(entry => entry.rendering.fps || 0).filter(fps => fps > 0);
    return fpsValues.length > 0 ? Math.min(...fpsValues) : 0;
  };

  const getPerformanceGrade = (): { grade: string; color: string } => {
    const avgFPS = getAverageFPS();
    if (avgFPS >= 55) return { grade: 'Excellent', color: 'text-green-400' };
    if (avgFPS >= 45) return { grade: 'Good', color: 'text-blue-400' };
    if (avgFPS >= 30) return { grade: 'Fair', color: 'text-yellow-400' };
    return { grade: 'Poor', color: 'text-red-400' };
  };

  const performanceGrade = getPerformanceGrade();

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-semibold text-white">Frame Rate</h4>
          <span className={`text-xs px-2 py-1 rounded ${performanceGrade.color} bg-opacity-20`}>
            {performanceGrade.grade}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {getCurrentFPS().toFixed(1)} FPS
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
          <span className="text-gray-500">Avg:</span>{' '}
          <span className="text-white">{getAverageFPS().toFixed(1)}</span>
        </div>
        <div>
          <span className="text-gray-500">Min:</span>{' '}
          <span className="text-white">{getMinFPS().toFixed(1)}</span>
        </div>
        <div>
          <span className="text-gray-500">Target:</span>{' '}
          <span className="text-blue-400">60.0</span>
        </div>
      </div>
    </div>
  );
};