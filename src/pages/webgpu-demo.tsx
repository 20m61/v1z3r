/**
 * WebGPU Demo Page
 * Demonstrates AI-powered visual intelligence with WebGPU acceleration
 */

import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { useVisualizerStore } from '@/store/visualizerStore';
import { useWebGPUCapabilities } from '@/components/webgpu/WebGPUCompatibilityChecker';
import { errorHandler } from '@/utils/errorHandler';

// Dynamically import WebGPU components to avoid SSR issues
const WebGPUVisualizer = dynamic(
  () => import('@/components/visualizer/WebGPUVisualizer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    ),
  }
);

interface WebGPUDemoProps {
  isWebGPUSupported: boolean;
}

const WebGPUDemoPage: React.FC<WebGPUDemoProps> = ({ isWebGPUSupported }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioContext, setAudioContextState] = useState<AudioContext | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { capabilities, isLoading } = useWebGPUCapabilities();
  const {
    setAudioContext,
    setAudioSource,
    setMicrophoneEnabled,
    setAudioAnalyzing,
    sensitivity,
    setSensitivity,
    colorTheme,
    setColorTheme,
    currentEffectType,
    setEffectType,
  } = useVisualizerStore();

  // Initialize audio context
  useEffect(() => {
    const initAudio = async () => {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContextState(context);
        setAudioContext(context);
        
        errorHandler.info('Audio context initialized for WebGPU demo');
      } catch (err) {
        errorHandler.error('Failed to initialize audio context', err as Error);
        setError('Failed to initialize audio. Please check your browser permissions.');
      }
    };

    initAudio();
  }, [setAudioContext]);

  // Handle microphone input
  const toggleMicrophone = async () => {
    if (!audioContext) return;

    try {
      if (mediaStream) {
        // Stop microphone
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
        setMicrophoneEnabled(false);
        setAudioAnalyzing(false);
        setIsPlaying(false);
      } else {
        // Start microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(stream);
        
        // Create audio source
        const source = audioContext.createMediaStreamSource(stream);
        setAudioSource(source);
        
        setMicrophoneEnabled(true);
        setAudioAnalyzing(true);
        setIsPlaying(true);
      }
    } catch (err) {
      errorHandler.error('Failed to access microphone', err as Error);
      setError('Failed to access microphone. Please check your permissions.');
    }
  };

  const handleWebGPUError = (error: Error) => {
    errorHandler.error('WebGPU visualizer error', error);
    setError(`WebGPU Error: ${error.message}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading WebGPU capabilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-2">WebGPU Visual Intelligence Demo</h1>
          <p className="text-gray-300">
            AI-powered visual effects with hardware acceleration
          </p>
          
          {/* Status indicators */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${capabilities?.isSupported ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">WebGPU: {capabilities?.isSupported ? 'Supported' : 'Not Supported'}</span>
            </div>
            
            {capabilities?.isSupported && (
              <>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${capabilities.computeShaderSupport ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-sm">Compute Shaders: {capabilities.computeShaderSupport ? 'Available' : 'Limited'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    capabilities.performanceRating === 'excellent' ? 'bg-green-500' :
                    capabilities.performanceRating === 'good' ? 'bg-blue-500' :
                    capabilities.performanceRating === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm">Performance: {capabilities.performanceRating}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            {/* Audio Controls */}
            <button
              onClick={toggleMicrophone}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isPlaying 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isPlaying ? 'Stop Microphone' : 'Start Microphone'}
            </button>

            {/* Sensitivity */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Sensitivity:</label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm w-8">{sensitivity.toFixed(1)}</span>
            </div>

            {/* Color Theme */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Color:</label>
              <input
                type="color"
                value={colorTheme}
                onChange={(e) => setColorTheme(e.target.value)}
                className="w-8 h-8 rounded border-none"
              />
            </div>

            {/* Effect Type */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Effect:</label>
              <select
                value={currentEffectType}
                onChange={(e) => setEffectType(e.target.value as any)}
                className="bg-gray-700 text-white px-2 py-1 rounded"
              >
                <option value="particles">Particles</option>
                <option value="waveform">Waveform</option>
                <option value="spectrum">Spectrum</option>
                <option value="lyrics">Lyrics</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-600 text-white p-4">
          <div className="container mx-auto">
            <p className="font-medium">Error: {error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 px-4 py-1 bg-red-700 hover:bg-red-800 rounded text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Visualizer */}
      <div className="relative flex-1" style={{ height: 'calc(100vh - 200px)' }}>
        {capabilities?.isSupported ? (
          <WebGPUVisualizer
            className="w-full h-full"
            onError={handleWebGPUError}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-red-400">WebGPU Not Available</h2>
              <p className="text-gray-300 mb-4">
                Your browser does not support WebGPU. Please use Chrome 113+, Edge 113+, or Firefox Nightly with WebGPU enabled.
              </p>
              <a
                href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Check Browser Support
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Feature Info */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">🎵 AI Music Analysis</h3>
              <p className="text-gray-400">
                Real-time audio feature extraction with spectral analysis, onset detection, and harmonic content analysis.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">⚡ WebGPU Acceleration</h3>
              <p className="text-gray-400">
                Hardware-accelerated particle systems with compute shaders supporting millions of particles.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🤖 Intelligent Mapping</h3>
              <p className="text-gray-400">
                AI-driven mapping from audio features to visual parameters with smooth transitions and reactive effects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Check if WebGPU is potentially supported (server-side approximation)
  const userAgent = context.req.headers['user-agent'] || '';
  const isWebGPUSupported = /Chrome\/11[3-9]|Chrome\/1[2-9]\d|Edge\/11[3-9]|Edge\/1[2-9]\d/.test(userAgent);

  return {
    props: {
      isWebGPUSupported,
    },
  };
};

export default WebGPUDemoPage;