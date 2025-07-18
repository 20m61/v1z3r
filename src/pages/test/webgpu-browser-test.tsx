/**
 * WebGPU Browser Test Page
 * Real browser testing for WebGPU functionality and performance
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

interface GPUInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

interface TestResults {
  apiSupport: boolean | null;
  adapterRequest: boolean | null;
  deviceCreation: boolean | null;
  shaderCompilation: boolean | null;
  renderPipeline: boolean | null;
  computePipeline: boolean | null;
  renderPerformance: number | null;
}

const WebGPUBrowserTest: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [adapter, setAdapter] = useState<GPUAdapter | null>(null);
  const [device, setDevice] = useState<GPUDevice | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [fps, setFps] = useState(0);
  const [testResults, setTestResults] = useState<TestResults>({
    apiSupport: null,
    adapterRequest: null,
    deviceCreation: null,
    shaderCompilation: null,
    renderPipeline: null,
    computePipeline: null,
    renderPerformance: null,
  });

  useEffect(() => {
    checkWebGPUSupport();
  }, []);

  const checkWebGPUSupport = () => {
    const supported = 'gpu' in navigator;
    setIsSupported(supported);
    setTestResults(prev => ({ ...prev, apiSupport: supported }));
  };

  const initializeWebGPU = async () => {
    try {
      setError(null);
      
      // Request adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      
      if (!adapter) {
        throw new Error('No GPU adapter found');
      }
      
      setAdapter(adapter);
      setTestResults(prev => ({ ...prev, adapterRequest: true }));
      
      // Get adapter info
      const info = await adapter.requestAdapterInfo();
      setGpuInfo({
        vendor: info.vendor || 'Unknown',
        architecture: info.architecture || 'Unknown',
        device: info.device || 'Unknown',
        description: info.description || 'Unknown',
      });
      
      // Request device
      const device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {
          maxTextureDimension2D: 8192,
          maxBufferSize: 268435456, // 256MB
        },
      });
      
      setDevice(device);
      setTestResults(prev => ({ ...prev, deviceCreation: true }));
      
      // Set up error handling
      device.lost.then((info) => {
        setError(`Device lost: ${info.reason}`);
        setDevice(null);
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setTestResults(prev => ({ 
        ...prev, 
        adapterRequest: !errorMessage.includes('adapter'),
        deviceCreation: false 
      }));
    }
  };

  const testShaderCompilation = async () => {
    if (!device) return false;
    
    try {
      const shaderModule = device.createShaderModule({
        label: 'Test shader',
        code: `
          @vertex
          fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 3>(
              vec2<f32>( 0.0,  0.5),
              vec2<f32>(-0.5, -0.5),
              vec2<f32>( 0.5, -0.5)
            );
            return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
          }

          @fragment
          fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
          }
        `,
      });
      
      setTestResults(prev => ({ ...prev, shaderCompilation: true }));
      return true;
    } catch (err) {
      setError(`Shader compilation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, shaderCompilation: false }));
      return false;
    }
  };

  const testRenderPipeline = async () => {
    if (!device || !canvasRef.current) return false;
    
    try {
      const context = canvasRef.current.getContext('webgpu');
      if (!context) throw new Error('WebGPU context not available');
      
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied',
      });
      
      // Create simple render pipeline
      const pipeline = device.createRenderPipeline({
        label: 'Test render pipeline',
        layout: 'auto',
        vertex: {
          module: device.createShaderModule({
            code: `
              @vertex
              fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                var pos = array<vec2<f32>, 3>(
                  vec2<f32>( 0.0,  0.5),
                  vec2<f32>(-0.5, -0.5),
                  vec2<f32>( 0.5, -0.5)
                );
                return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
              }
            `,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: device.createShaderModule({
            code: `
              @fragment
              fn main() -> @location(0) vec4<f32> {
                return vec4<f32>(0.0, 1.0, 0.0, 1.0);
              }
            `,
          }),
          entryPoint: 'main',
          targets: [{
            format: presentationFormat,
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
      
      // Test render
      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      
      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      };
      
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.draw(3);
      passEncoder.end();
      
      device.queue.submit([commandEncoder.finish()]);
      
      setTestResults(prev => ({ ...prev, renderPipeline: true }));
      return true;
    } catch (err) {
      setError(`Render pipeline failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, renderPipeline: false }));
      return false;
    }
  };

  const testComputePipeline = async () => {
    if (!device) return false;
    
    try {
      // Create compute shader
      const computeShaderModule = device.createShaderModule({
        label: 'Compute shader',
        code: `
          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            // Simple compute shader that does nothing
          }
        `,
      });
      
      // Create compute pipeline
      const computePipeline = device.createComputePipeline({
        label: 'Test compute pipeline',
        layout: 'auto',
        compute: {
          module: computeShaderModule,
          entryPoint: 'main',
        },
      });
      
      // Execute compute shader
      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(computePipeline);
      passEncoder.dispatchWorkgroups(1);
      passEncoder.end();
      
      device.queue.submit([commandEncoder.finish()]);
      
      setTestResults(prev => ({ ...prev, computePipeline: true }));
      return true;
    } catch (err) {
      setError(`Compute pipeline failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, computePipeline: false }));
      return false;
    }
  };

  const runAllTests = async () => {
    if (!device) {
      await initializeWebGPU();
    }
    
    await testShaderCompilation();
    await testRenderPipeline();
    await testComputePipeline();
    
    // Start performance test
    startPerformanceTest();
  };

  const startPerformanceTest = useCallback(() => {
    if (!device || !canvasRef.current || isRendering) return;
    
    setIsRendering(true);
    const context = canvasRef.current.getContext('webgpu');
    if (!context) return;
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
    });
    
    let frameCount = 0;
    let lastTime = performance.now();
    
    const render = () => {
      if (!isRendering) return;
      
      const currentTime = performance.now();
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        setTestResults(prev => ({ ...prev, renderPerformance: frameCount }));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      // Render animated triangle
      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      
      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { 
            r: Math.sin(currentTime * 0.001) * 0.5 + 0.5,
            g: Math.cos(currentTime * 0.001) * 0.5 + 0.5,
            b: 0.5,
            a: 1.0 
          },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      };
      
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.end();
      
      device.queue.submit([commandEncoder.finish()]);
      
      requestAnimationFrame(render);
    };
    
    render();
  }, [device, isRendering]);

  const stopPerformanceTest = () => {
    setIsRendering(false);
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return '⚪';
    return status ? '✅' : '❌';
  };

  const getPerformanceRating = (fps: number | null) => {
    if (fps === null) return 'Not tested';
    if (fps >= 60) return 'Excellent';
    if (fps >= 30) return 'Good';
    if (fps >= 15) return 'Fair';
    return 'Poor';
  };

  return (
    <>
      <Head>
        <title>WebGPU Browser Test - v1z3r</title>
        <meta name="description" content="Test WebGPU functionality and performance in your browser" />
      </Head>

      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">WebGPU Browser Test</h1>

          {/* Test Results Summary */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>WebGPU API Support</span>
                <span>{getStatusIcon(testResults.apiSupport)} {testResults.apiSupport ? 'Supported' : 'Not Supported'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>GPU Adapter Request</span>
                <span>{getStatusIcon(testResults.adapterRequest)} {testResults.adapterRequest ? 'Success' : testResults.adapterRequest === false ? 'Failed' : 'Not tested'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Device Creation</span>
                <span>{getStatusIcon(testResults.deviceCreation)} {testResults.deviceCreation ? 'Success' : testResults.deviceCreation === false ? 'Failed' : 'Not tested'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shader Compilation</span>
                <span>{getStatusIcon(testResults.shaderCompilation)} {testResults.shaderCompilation ? 'Success' : testResults.shaderCompilation === false ? 'Failed' : 'Not tested'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Render Pipeline</span>
                <span>{getStatusIcon(testResults.renderPipeline)} {testResults.renderPipeline ? 'Working' : testResults.renderPipeline === false ? 'Failed' : 'Not tested'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Compute Pipeline</span>
                <span>{getStatusIcon(testResults.computePipeline)} {testResults.computePipeline ? 'Working' : testResults.computePipeline === false ? 'Failed' : 'Not tested'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Render Performance</span>
                <span>{testResults.renderPerformance ? `${testResults.renderPerformance} fps` : 'Not tested'} - {getPerformanceRating(testResults.renderPerformance)}</span>
              </div>
            </div>
          </div>

          {/* GPU Information */}
          {gpuInfo && (
            <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">GPU Information</h2>
              <div className="space-y-2">
                <div><span className="text-gray-400">Vendor:</span> {gpuInfo.vendor}</div>
                <div><span className="text-gray-400">Architecture:</span> {gpuInfo.architecture}</div>
                <div><span className="text-gray-400">Device:</span> {gpuInfo.device}</div>
                <div><span className="text-gray-400">Description:</span> {gpuInfo.description}</div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-8">
              <h3 className="text-red-400 font-semibold mb-2">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
            <div className="flex gap-4">
              {!device && isSupported && (
                <button
                  onClick={initializeWebGPU}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Initialize WebGPU
                </button>
              )}
              {device && !isRendering && (
                <button
                  onClick={runAllTests}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Run All Tests
                </button>
              )}
              {isRendering && (
                <button
                  onClick={stopPerformanceTest}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Stop Performance Test
                </button>
              )}
            </div>
          </div>

          {/* Render Canvas */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Render Output</h2>
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full bg-black rounded"
            />
            {isRendering && (
              <div className="mt-4 text-center">
                <p className="text-2xl font-mono">{fps} FPS</p>
              </div>
            )}
          </div>

          {/* Device Limits */}
          {device && (
            <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Device Limits</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Max Texture Size:</span> {device.limits.maxTextureDimension2D}
                </div>
                <div>
                  <span className="text-gray-400">Max Buffer Size:</span> {(device.limits.maxBufferSize / 1024 / 1024).toFixed(0)} MB
                </div>
                <div>
                  <span className="text-gray-400">Max Bind Groups:</span> {device.limits.maxBindGroups}
                </div>
                <div>
                  <span className="text-gray-400">Max Compute Workgroup Size:</span> {device.limits.maxComputeWorkgroupSizeX}
                </div>
              </div>
            </div>
          )}

          {/* Browser Compatibility Note */}
          {!isSupported && (
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
              <h3 className="text-yellow-400 font-semibold mb-2">Browser Not Supported</h3>
              <p className="text-yellow-300">
                Your browser does not support WebGPU. Please use Chrome 113+, Edge 113+, or enable WebGPU flags in your browser.
              </p>
              <p className="text-yellow-300 mt-2">
                For Chrome: chrome://flags/#enable-unsafe-webgpu
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 text-sm text-gray-400">
            <h3 className="font-semibold mb-2">Test Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click &quot;Initialize WebGPU&quot; to detect GPU and create device</li>
              <li>Click &quot;Run All Tests&quot; to execute comprehensive tests</li>
              <li>Monitor the performance test to evaluate rendering capabilities</li>
              <li>Check device limits to understand GPU capabilities</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
};

export default WebGPUBrowserTest;