/**
 * NDI/WebRTC Streaming Browser Test Page
 * Real browser testing for WebRTC and NDI streaming functionality
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { ndiStreamingService } from '@/services/streaming/ndiStreaming';
import type { StreamConfig, StreamMetrics } from '@/services/streaming/ndiStreaming';

const NdiBrowserTest: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isWebRTCSupported, setIsWebRTCSupported] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamConfig, setStreamConfig] = useState<StreamConfig>(() => ndiStreamingService.getConfig());
  const [metrics, setMetrics] = useState<StreamMetrics>(() => ({
    ...ndiStreamingService.getMetrics(),
    fps: 0,
    bitrate: 0,
    packetsSent: 0,
    packetsLost: 0,
    activeStreams: 0,
  }));
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [testResults, setTestResults] = useState<{
    webRTCSupport: boolean | null;
    getUserMedia: boolean | null;
    peerConnection: boolean | null;
    videoCapture: boolean | null;
    canvasCapture: boolean | null;
    streamTransmit: boolean | null;
  }>({
    webRTCSupport: null,
    getUserMedia: null,
    peerConnection: null,
    videoCapture: null,
    canvasCapture: null,
    streamTransmit: null,
  });

  useEffect(() => {
    checkWebRTCSupport();
    setupTestCanvas();
    
    const metricsInterval = setInterval(() => {
      if (isStreaming) {
        const ndiMetrics = ndiStreamingService.getMetrics();
        setMetrics(prev => ({
          ...ndiMetrics,
          fps: prev.fps || 30,
          bitrate: ndiMetrics.bandwidth * 1000000,
          packetsSent: ndiMetrics.framesSent,
          packetsLost: ndiMetrics.droppedFrames,
          activeStreams: ndiMetrics.connectedClients,
        }));
      }
    }, 1000);
    
    return () => {
      clearInterval(metricsInterval);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isStreaming, localStream]);

  const checkWebRTCSupport = () => {
    const supported = !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.RTCPeerConnection
    );
    setIsWebRTCSupported(supported);
    setTestResults(prev => ({ ...prev, webRTCSupport: supported }));
  };

  const setupTestCanvas = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Create animated test pattern
    let hue = 0;
    const animate = () => {
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('NDI/WebRTC Test Pattern', canvas.width / 2, canvas.height / 2 - 30);
      ctx.fillText(new Date().toLocaleTimeString(), canvas.width / 2, canvas.height / 2 + 10);
      ctx.fillText(`Frame: ${Math.floor(hue)}`, canvas.width / 2, canvas.height / 2 + 50);
      
      hue = (hue + 1) % 360;
      requestAnimationFrame(animate);
    };
    animate();
  };

  const testGetUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setLocalStream(stream);
      setTestResults(prev => ({ ...prev, getUserMedia: true, videoCapture: true }));
      return true;
    } catch (err) {
      setError(`getUserMedia failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, getUserMedia: false }));
      return false;
    }
  };

  const testPeerConnection = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Create a test data channel
      const channel = pc.createDataChannel('test');
      await pc.createOffer();
      
      pc.close();
      setTestResults(prev => ({ ...prev, peerConnection: true }));
      return true;
    } catch (err) {
      setError(`RTCPeerConnection test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, peerConnection: false }));
      return false;
    }
  };

  const testCanvasCapture = async () => {
    try {
      if (!canvasRef.current) {
        throw new Error('Canvas not available');
      }
      
      const stream = canvasRef.current.captureStream(30);
      if (stream && stream.getTracks().length > 0) {
        setTestResults(prev => ({ ...prev, canvasCapture: true }));
        return true;
      }
      throw new Error('No tracks in canvas stream');
    } catch (err) {
      setError(`Canvas capture failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, canvasCapture: false }));
      return false;
    }
  };

  const initializeStreaming = async () => {
    try {
      setError(null);
      
      // Run all tests
      const userMediaOk = await testGetUserMedia();
      const peerConnectionOk = await testPeerConnection();
      const canvasCaptureOk = await testCanvasCapture();
      
      if (userMediaOk && peerConnectionOk && canvasCaptureOk) {
        await ndiStreamingService.initialize();
        setIsInitialized(true);
      }
    } catch (err) {
      setError(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const startStreaming = async () => {
    try {
      if (!canvasRef.current) {
        throw new Error('Canvas not available');
      }
      
      const success = await ndiStreamingService.startStream(canvasRef.current);
      if (success) {
        setIsStreaming(true);
        setTestResults(prev => ({ ...prev, streamTransmit: true }));
      } else {
        throw new Error('Failed to start stream');
      }
    } catch (err) {
      setError(`Streaming failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTestResults(prev => ({ ...prev, streamTransmit: false }));
    }
  };

  const stopStreaming = async () => {
    await ndiStreamingService.stopStream();
    setIsStreaming(false);
  };

  const updateConfig = (updates: Partial<StreamConfig>) => {
    // Map StreamConfig to NDIConfig format
    if (updates.frameRate) {
      const validFrameRates = [30, 60, 120];
      const closest = validFrameRates.reduce((prev, curr) =>
        Math.abs(curr - updates.frameRate!) < Math.abs(prev - updates.frameRate!) ? curr : prev
      ) as 30 | 60 | 120;
      updates.frameRate = closest;
    }
    
    ndiStreamingService.setConfig(updates);
    setStreamConfig(ndiStreamingService.getConfig());
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return '⚪';
    return status ? '✅' : '❌';
  };

  const getHealthStatus = () => {
    if (!isInitialized) return 'Not initialized';
    return ndiStreamingService.getHealthStatus();
  };

  return (
    <>
      <Head>
        <title>NDI/WebRTC Browser Test - v1z3r</title>
        <meta name="description" content="Test WebRTC and NDI streaming functionality in your browser" />
      </Head>

      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">NDI/WebRTC Streaming Browser Test</h1>

          {/* Test Results Summary */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>WebRTC Support</span>
                  <span>{getStatusIcon(testResults.webRTCSupport)} {testResults.webRTCSupport ? 'Supported' : 'Not Supported'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>getUserMedia API</span>
                  <span>{getStatusIcon(testResults.getUserMedia)} {testResults.getUserMedia ? 'Working' : testResults.getUserMedia === false ? 'Failed' : 'Not tested'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>RTCPeerConnection</span>
                  <span>{getStatusIcon(testResults.peerConnection)} {testResults.peerConnection ? 'Working' : testResults.peerConnection === false ? 'Failed' : 'Not tested'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Video Capture</span>
                  <span>{getStatusIcon(testResults.videoCapture)} {testResults.videoCapture ? 'Working' : testResults.videoCapture === false ? 'Failed' : 'Not tested'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Canvas Capture</span>
                  <span>{getStatusIcon(testResults.canvasCapture)} {testResults.canvasCapture ? 'Working' : testResults.canvasCapture === false ? 'Failed' : 'Not tested'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stream Transmit</span>
                  <span>{getStatusIcon(testResults.streamTransmit)} {testResults.streamTransmit ? 'Active' : testResults.streamTransmit === false ? 'Failed' : 'Not tested'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Health Status */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Feature Health</h2>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                getHealthStatus() === 'healthy' ? 'bg-green-400' :
                getHealthStatus() === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
              }`}></span>
              <span>{getHealthStatus()}</span>
            </div>
          </div>

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
              {!isInitialized && isWebRTCSupported && (
                <button
                  onClick={initializeStreaming}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Initialize Streaming
                </button>
              )}
              {isInitialized && !isStreaming && (
                <button
                  onClick={startStreaming}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Start Streaming
                </button>
              )}
              {isStreaming && (
                <button
                  onClick={stopStreaming}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Stop Streaming
                </button>
              )}
            </div>
          </div>

          {/* Video Preview */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Test Pattern Canvas */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Test Pattern (Source)</h3>
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                className="w-full bg-black rounded"
              />
            </div>

            {/* Camera Preview */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Camera Preview</h3>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full bg-black rounded"
              />
            </div>
          </div>

          {/* Stream Metrics */}
          {isStreaming && (
            <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Stream Metrics</h2>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-400">Frame Rate</p>
                  <p className="text-2xl font-mono">{metrics.fps.toFixed(1)} fps</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Bitrate</p>
                  <p className="text-2xl font-mono">{(metrics.bitrate / 1000).toFixed(1)} kbps</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Latency</p>
                  <p className="text-2xl font-mono">{metrics.latency.toFixed(0)} ms</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Packets Sent</p>
                  <p className="text-2xl font-mono">{metrics.packetsSent}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Packets Lost</p>
                  <p className="text-2xl font-mono">{metrics.packetsLost}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Active Streams</p>
                  <p className="text-2xl font-mono">{metrics.activeStreams}</p>
                </div>
              </div>
            </div>
          )}

          {/* Configuration */}
          {isInitialized && (
            <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Stream Configuration</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Resolution
                  </label>
                  <select
                    value={`${streamConfig.width}x${streamConfig.height}`}
                    onChange={(e) => {
                      const [width, height] = e.target.value.split('x').map(Number);
                      updateConfig({ width, height });
                    }}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="1920x1080">1920x1080 (Full HD)</option>
                    <option value="1280x720">1280x720 (HD)</option>
                    <option value="960x540">960x540</option>
                    <option value="640x360">640x360</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Frame Rate
                  </label>
                  <select
                    value={streamConfig.frameRate}
                    onChange={(e) => updateConfig({ frameRate: Number(e.target.value) as 30 | 60 | 120 })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value={60}>60 fps</option>
                    <option value={30}>30 fps</option>
                    <option value={25}>25 fps</option>
                    <option value={15}>15 fps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Bitrate (kbps)
                  </label>
                  <input
                    type="number"
                    value={streamConfig.bitrate / 1000}
                    onChange={(e) => updateConfig({ bitrate: Number(e.target.value) * 1000 })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Protocol
                  </label>
                  <select
                    value={streamConfig.protocol}
                    onChange={(e) => updateConfig({ protocol: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="ndi">NDI</option>
                    <option value="webrtc">WebRTC</option>
                    <option value="rtmp">RTMP</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Browser Compatibility Note */}
          {!isWebRTCSupported && (
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
              <h3 className="text-yellow-400 font-semibold mb-2">Browser Not Supported</h3>
              <p className="text-yellow-300">
                Your browser does not support WebRTC. Please use a modern browser like Chrome, Firefox, Safari, or Edge.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 text-sm text-gray-400">
            <h3 className="font-semibold mb-2">Test Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click &quot;Initialize Streaming&quot; to set up WebRTC</li>
              <li>Allow camera access when prompted by the browser</li>
              <li>Click &quot;Start Streaming&quot; to begin transmission</li>
              <li>Monitor metrics and adjust configuration as needed</li>
              <li>Test different protocols (NDI requires NDI runtime installed)</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
};

export default NdiBrowserTest;