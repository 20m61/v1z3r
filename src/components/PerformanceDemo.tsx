/**
 * Performance Optimization Demo Component
 * Showcases WebGPU acceleration and performance monitoring
 */

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import WebGPUParticleSystem from './WebGPUParticleSystem';
import { usePerformanceMonitor } from '@/utils/performanceMonitor';
import { useWebGPUPerformanceMonitor } from '@/utils/webgpuPerformanceMonitor';
import { FiActivity, FiCpu, FiHardDrive, FiZap } from 'react-icons/fi';

interface PerformanceDemoProps {
  audioData?: Uint8Array;
}

export default function PerformanceDemo({ audioData }: PerformanceDemoProps) {
  const [particleCount, setParticleCount] = useState(10000);
  const [webgpuEnabled, setWebgpuEnabled] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);
  
  // Performance monitoring
  const { metrics: generalMetrics, budgetStatus } = usePerformanceMonitor();
  const { metrics: gpuMetrics, status: gpuStatus } = useWebGPUPerformanceMonitor();
  
  // WebGPU support check
  const [webgpuSupported, setWebgpuSupported] = useState(false);
  
  useEffect(() => {
    const checkWebGPU = async () => {
      if ('gpu' in navigator) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          setWebgpuSupported(!!adapter);
        } catch {
          setWebgpuSupported(false);
        }
      }
    };
    checkWebGPU();
  }, []);
  
  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };
  
  const formatTime = (ms: number) => {
    return `${ms.toFixed(2)}ms`;
  };
  
  return (
    <div className="relative w-full h-full bg-black">
      {/* 3D Scene */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 50], fov: 75 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.1} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          
          <WebGPUParticleSystem
            count={particleCount}
            audioData={audioData}
            enabled={webgpuEnabled && webgpuSupported}
          />
          
          {showStats && <Stats />}
        </Canvas>
      </div>
      
      {/* Performance Controls */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FiZap className="text-blue-400" />
          Performance Demo
        </h3>
        
        {/* WebGPU Status */}
        <div className="mb-4 p-2 rounded bg-black/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">WebGPU Status:</span>
            <span className={`text-sm font-medium ${webgpuSupported ? 'text-green-400' : 'text-red-400'}`}>
              {webgpuSupported ? 'Available' : 'Not Supported'}
            </span>
          </div>
          {webgpuSupported && (
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={webgpuEnabled}
                onChange={(e) => setWebgpuEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Enable WebGPU Acceleration</span>
            </label>
          )}
        </div>
        
        {/* Particle Count Control */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Particle Count: {particleCount.toLocaleString()}
          </label>
          <input
            type="range"
            min="1000"
            max="100000"
            step="1000"
            value={particleCount}
            onChange={(e) => setParticleCount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1K</span>
            <span>50K</span>
            <span>100K</span>
          </div>
        </div>
        
        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-black/50 rounded p-2">
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <FiActivity />
              <span>FPS</span>
            </div>
            <div className="text-lg font-mono">
              {generalMetrics?.frameRate || gpuMetrics?.fps || 0}
            </div>
          </div>
          
          <div className="bg-black/50 rounded p-2">
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <FiCpu />
              <span>Frame Time</span>
            </div>
            <div className="text-lg font-mono">
              {formatTime(gpuMetrics?.frameTime || generalMetrics?.frameRate ? 1000 / generalMetrics!.frameRate : 0)}
            </div>
          </div>
          
          <div className="bg-black/50 rounded p-2">
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <FiHardDrive />
              <span>Memory</span>
            </div>
            <div className="text-lg font-mono">
              {formatBytes(generalMetrics?.memoryUsage || 0)}
            </div>
          </div>
          
          <div className="bg-black/50 rounded p-2">
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <FiZap />
              <span>GPU Usage</span>
            </div>
            <div className="text-lg font-mono">
              {gpuMetrics?.gpuUtilization?.toFixed(0) || 0}%
            </div>
          </div>
        </div>
        
        {/* Toggle Options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showStats}
              onChange={(e) => setShowStats(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show FPS Counter</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDetailedMetrics}
              onChange={(e) => setShowDetailedMetrics(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show Detailed Metrics</span>
          </label>
        </div>
      </div>
      
      {/* Detailed Metrics Panel */}
      {showDetailedMetrics && (
        <div className="absolute bottom-4 left-4 right-4 max-w-4xl bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
          <h4 className="text-sm font-semibold mb-3">Detailed Performance Metrics</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Core Web Vitals */}
            <div>
              <h5 className="font-medium text-gray-400 mb-2">Core Web Vitals</h5>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>LCP:</span>
                  <span className="font-mono">{formatTime(generalMetrics?.LCP || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>FID:</span>
                  <span className="font-mono">{formatTime(generalMetrics?.FID || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CLS:</span>
                  <span className="font-mono">{generalMetrics?.CLS?.toFixed(3) || '0.000'}</span>
                </div>
              </div>
            </div>
            
            {/* GPU Timing */}
            {gpuMetrics && (
              <div>
                <h5 className="font-medium text-gray-400 mb-2">GPU Timing</h5>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Compute:</span>
                    <span className="font-mono">{formatTime(gpuMetrics.computePassTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Render:</span>
                    <span className="font-mono">{formatTime(gpuMetrics.renderPassTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total GPU:</span>
                    <span className="font-mono">{formatTime(gpuMetrics.gpuFrameTime)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Memory Usage */}
            <div>
              <h5 className="font-medium text-gray-400 mb-2">Memory Usage</h5>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>JS Heap:</span>
                  <span className="font-mono">{formatBytes(generalMetrics?.memoryUsage || 0)}</span>
                </div>
                {gpuMetrics && (
                  <>
                    <div className="flex justify-between">
                      <span>GPU Buffer:</span>
                      <span className="font-mono">{formatBytes(gpuMetrics.bufferMemory)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GPU Texture:</span>
                      <span className="font-mono">{formatBytes(gpuMetrics.textureMemory)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Performance Budget */}
            <div>
              <h5 className="font-medium text-gray-400 mb-2">Performance Budget</h5>
              <div className="space-y-1">
                {budgetStatus?.violations.map((violation, i) => (
                  <div key={i} className="text-red-400 text-xs">
                    ⚠️ {violation}
                  </div>
                ))}
                {gpuStatus?.violations.map((violation, i) => (
                  <div key={i} className="text-red-400 text-xs">
                    ⚠️ {violation}
                  </div>
                ))}
                {(!budgetStatus?.violations.length && !gpuStatus?.violations.length) && (
                  <div className="text-green-400">✓ All metrics within budget</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}